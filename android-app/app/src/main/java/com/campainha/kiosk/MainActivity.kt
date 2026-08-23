package com.campainha.kiosk

import android.Manifest
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var prefs: android.content.SharedPreferences

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
        private const val CAMERA_MIC_REQUEST_CODE = 100
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

        setContentView(R.layout.activity_main)
        applyKioskWindowFlags()

        webView = findViewById(R.id.webview)
        setupWebView()

        findViewById<View>(R.id.exitGestureZone).setOnClickListener { onExitZoneTapped() }

        requestRuntimePermissions()
        webView.loadUrl(currentUrl())
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
                runOnUiThread { request.grant(request.resources) }
            }
        }
    }

    private fun requestRuntimePermissions() {
        val needed = mutableListOf<String>()
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA)
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.RECORD_AUDIO)
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), CAMERA_MIC_REQUEST_CODE)
        }
    }

    // Consume the back button entirely - there is no "back" out of the
    // kiosk except through the PIN-protected exit menu.
    override fun onBackPressed() {
        // no-op on purpose
    }

    private fun currentUrl(): String = prefs.getString(KEY_URL, DEFAULT_URL) ?: DEFAULT_URL
    private fun currentPin(): String = prefs.getString(KEY_PIN, DEFAULT_PIN) ?: DEFAULT_PIN

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
        val options = arrayOf("Recarregar página", "Trocar URL", "Trocar PIN", "Sair do app")
        AlertDialog.Builder(this)
            .setTitle("Menu do administrador")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> webView.loadUrl(currentUrl())
                    1 -> promptForUrl()
                    2 -> promptForNewPin()
                    3 -> finishAffinity()
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
                    webView.loadUrl(newUrl)
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
}
