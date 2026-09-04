package com.campainha.kiosk

import android.Manifest
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.text.InputType
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var prefs: android.content.SharedPreferences
    private var tts: TextToSpeech? = null
    private var lockClient: KioskLockClient? = null
    @Volatile private var locked: Boolean = true

    // Android WebView doesn't reliably implement the Web Speech API
    // (window.speechSynthesis silently no-ops on many WebView versions,
    // even though it works fine in real Chrome) - the assistant's voice
    // was completely silent inside this app because of that. This bridge
    // exposes Android's real TextToSpeech engine to the page instead;
    // frontend/src/utils/speech.ts calls window.AndroidTTS.speak(...)
    // when running inside this WebView and awaits the matching
    // ttsDone(utteranceId) callback injected back into the page.
    inner class TtsBridge {
        @JavascriptInterface
        fun speak(text: String, utteranceId: String) {
            val engine = tts
            if (engine == null) {
                notifyTtsDone(utteranceId)
                return
            }
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, Bundle(), utteranceId)
        }
    }

    private fun notifyTtsDone(utteranceId: String) {
        runOnUiThread {
            webView.evaluateJavascript(
                "window.__ttsDone && window.__ttsDone(" + org.json.JSONObject.quote(utteranceId) + ")",
                null
            )
        }
    }

    private var tapCount = 0
    private var firstTapTime = 0L
    private val tapWindowMs = 3000L
    private val tapsRequired = 5

    companion object {
        private const val DEFAULT_URL = "http://localhost:3000"
        private const val DEFAULT_PIN = "1234"
        private const val PREFS_NAME = "kiosk_prefs"
        private const val KEY_URL = "kiosk_url"
        private const val KEY_PIN = "kiosk_pin"
        private const val KEY_DOORBELL = "doorbell_id"
        private const val KEY_LOCAL_UNLOCK = "local_unlock_until"
        private const val DEFAULT_DOORBELL = 1
        private const val CAMERA_MIC_REQUEST_CODE = 100

        @Volatile @JvmStatic var foreground: Boolean = false
        @JvmStatic fun relaunchSelf(context: Context) {
            val i = Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            context.startActivity(i)
        }
    }

    override fun onStart() { super.onStart(); foreground = true }
    override fun onStop() { super.onStop(); foreground = false }
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (locked) relaunchSelf(applicationContext)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

        setContentView(R.layout.activity_main)
        applyKioskWindowFlags()

        webView = findViewById(R.id.webview)
        setupWebView()
        setupTts()

        findViewById<View>(R.id.exitGestureZone).setOnClickListener { onExitZoneTapped() }

        requestRuntimePermissions()
        webView.loadUrl(urlWithDoorbell())

        bindLockClient()

        val savedLocal = prefs.getLong(KEY_LOCAL_UNLOCK, 0L)
        if (savedLocal > System.currentTimeMillis()) lockClient?.setLocalUnlockUntil(savedLocal)

        // O KioskLockClient pode ainda não ter respondido; tudo bem,
        // onLockStateChanged re-chama quando o estado chegar.
        if (locked) tryStartLockTask() // Task 18
    }

    // (Re)creates the lock client against the current host + doorbell id.
    private fun bindLockClient() {
        lockClient?.stop()
        val host = currentUrl().removeSuffix("/")
        lockClient = KioskLockClient(host, currentDoorbellId(), prefs) { isLocked ->
            runOnUiThread { onLockStateChanged(isLocked) }
        }
        lockClient?.start()
    }

    private fun onLockStateChanged(isLocked: Boolean) {
        locked = isLocked
        if (isLocked) {
            KioskWatchdogService.start(applicationContext)
            tryStartLockTask() // Task 18
        } else {
            KioskWatchdogService.stop(applicationContext)
            tryStopLockTask()  // Task 18
        }
    }

    // Task 18: camada opcional de Lock Task, ativa só quando o app é
    // device owner (adb shell dpm set-device-owner ...). Sem isso, os
    // métodos são no-ops silenciosos e só o watchdog (Task 17) atua.
    private fun dpm() =
        getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager

    private fun tryStartLockTask() {
        try {
            val dpm = dpm()
            if (dpm.isDeviceOwnerApp(packageName)) {
                val admin = android.content.ComponentName(this, DeviceAdminReceiver::class.java)
                dpm.setLockTaskPackages(admin, arrayOf(packageName))
                startLockTask()
            }
        } catch (_: Exception) { /* sem device owner: só o watchdog atua */ }
    }

    private fun tryStopLockTask() {
        try {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            if (am.lockTaskModeState != android.app.ActivityManager.LOCK_TASK_MODE_NONE) {
                stopLockTask()
            }
        } catch (_: Exception) {}
    }

    private fun applyKioskWindowFlags() {
        // Keep the screen on and always fullscreen/immersive - status and
        // navigation bars stay hidden until swiped, and reappear hidden
        // again once the user stops interacting with them.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyKioskWindowFlags()
    }

    private fun setupWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.webViewClient = WebViewClient()

        // getUserMedia() calls from the page (camera/mic for face
        // recognition and the voice assistant) surface here - grant
        // whatever the page asked for automatically, since this is a
        // trusted single-purpose kiosk, not a general browser.
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // Grant synchronously - this callback already runs on the UI
                // thread on modern WebView, and deferring it with
                // runOnUiThread{} could let the PermissionRequest go stale,
                // which showed up in the page as getUserMedia({audio:true})
                // failing with "Could not start audio source".
                try {
                    request.grant(request.resources)
                } catch (_: Exception) {
                    try { request.deny() } catch (_: Exception) {}
                }
            }
        }

        webView.addJavascriptInterface(TtsBridge(), "AndroidTTS")
    }

    private fun setupTts() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale("pt", "BR")
            }
        }
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) {
                if (utteranceId != null) notifyTtsDone(utteranceId)
            }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                if (utteranceId != null) notifyTtsDone(utteranceId)
            }
        })
    }

    private fun requestRuntimePermissions() {
        val needed = mutableListOf<String>()
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA)
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.RECORD_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), CAMERA_MIC_REQUEST_CODE)
        }
    }

    // Consume the back button entirely - there is no "back" out of the
    // kiosk except through the PIN-protected exit menu.
    override fun onBackPressed() {
        if (!locked) super.onBackPressed()
        // travado: consome
    }

    override fun onDestroy() {
        lockClient?.stop()
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }

    private fun currentUrl(): String = prefs.getString(KEY_URL, DEFAULT_URL) ?: DEFAULT_URL
    private fun currentPin(): String = prefs.getString(KEY_PIN, DEFAULT_PIN) ?: DEFAULT_PIN
    private fun currentDoorbellId(): Int = prefs.getInt(KEY_DOORBELL, DEFAULT_DOORBELL)

    private fun urlWithDoorbell(): String {
        val baseUrl = currentUrl()
        val sep = if (baseUrl.contains("?")) "&" else "?"
        return "$baseUrl${sep}doorbell=${currentDoorbellId()}"
    }

    private fun onExitZoneTapped() {
        val now = System.currentTimeMillis()
        if (tapCount == 0 || now - firstTapTime > tapWindowMs) {
            tapCount = 1
            firstTapTime = now
        } else {
            tapCount++
        }

        if (tapCount >= tapsRequired) {
            tapCount = 0
            promptForPin()
        }
    }

    private fun promptForPin() {
        val input = EditText(this)
        input.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD

        AlertDialog.Builder(this)
            .setTitle("PIN de administrador")
            .setView(input)
            .setPositiveButton("OK") { _, _ ->
                if (input.text.toString() == currentPin()) {
                    showAdminMenu()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun showAdminMenu() {
        val options = arrayOf("Recarregar página", "Trocar URL", "Trocar PIN", "ID da campainha", "Desbloquear 15 min", "Sair do app")
        AlertDialog.Builder(this)
            .setTitle("Menu do administrador")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> webView.loadUrl(urlWithDoorbell())
                    1 -> promptForUrl()
                    2 -> promptForNewPin()
                    3 -> promptForDoorbellId()
                    4 -> {
                        val until = System.currentTimeMillis() + 15 * 60_000L
                        prefs.edit().putLong(KEY_LOCAL_UNLOCK, until).apply()
                        lockClient?.setLocalUnlockUntil(until)
                    }
                    5 -> {
                        if (!locked) finishAffinity()
                        else AlertDialog.Builder(this)
                            .setMessage("O modo kiosk está travado. Desbloqueie pelo painel ou use \"Desbloquear 15 min\".")
                            .setPositiveButton("OK", null).show()
                    }
                }
            }
            .setNegativeButton("Fechar", null)
            .show()
    }

    private fun promptForUrl() {
        val input = EditText(this)
        input.inputType = InputType.TYPE_TEXT_VARIATION_URI
        input.setText(currentUrl())

        AlertDialog.Builder(this)
            .setTitle("Endereço do app (URL)")
            .setView(input)
            .setPositiveButton("Salvar") { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotEmpty()) {
                    prefs.edit().putString(KEY_URL, newUrl).apply()
                    webView.loadUrl(urlWithDoorbell())
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun promptForNewPin() {
        val input = EditText(this)
        input.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD

        AlertDialog.Builder(this)
            .setTitle("Novo PIN de administrador")
            .setView(input)
            .setPositiveButton("Salvar") { _, _ ->
                val newPin = input.text.toString().trim()
                if (newPin.length in 4..8) {
                    prefs.edit().putString(KEY_PIN, newPin).apply()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun promptForDoorbellId() {
        val input = EditText(this)
        input.inputType = InputType.TYPE_CLASS_NUMBER
        input.setText(currentDoorbellId().toString())
        AlertDialog.Builder(this)
            .setTitle("ID da campainha")
            .setView(input)
            .setPositiveButton("Salvar") { _, _ ->
                val n = input.text.toString().trim().toIntOrNull()
                if (n != null && n > 0) {
                    // limpa o estado de trava persistido da campainha anterior
                    // (chaves de KioskLockClient + unlock local) para o
                    // próximo launch não restaurar o estado de outra campainha
                    prefs.edit()
                        .putInt(KEY_DOORBELL, n)
                        .remove("srv_locked")
                        .remove("srv_unlock_until")
                        .remove(KEY_LOCAL_UNLOCK)
                        .apply()
                    bindLockClient()
                    webView.loadUrl(urlWithDoorbell())
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
