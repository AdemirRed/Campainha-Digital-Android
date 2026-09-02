package com.campainha.kiosk

import android.content.SharedPreferences
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class KioskLockClient(
    private val baseUrl: String,
    private val doorbellId: Int,
    private val prefs: SharedPreferences? = null,
    private val onLockChange: (locked: Boolean) -> Unit,
) {
    private val http = OkHttpClient()
    private var ws: WebSocket? = null
    private var poller: ScheduledExecutorService? = null

    // Fail-open: stay unlocked until we've heard from the server at least
    // once (bad URL / backend down / no network must NOT hard-lock a
    // freshly launched device). Once the server has confirmed a state we
    // keep enforcing that last known state even while offline.
    @Volatile private var serverLocked = false
    @Volatile private var serverUnlockUntilMs = 0L
    @Volatile private var localUnlockUntilMs = 0L
    @Volatile private var lastReported: Boolean? = null
    @Volatile private var everContactedServer = false

    fun start() {
        // Reboot: re-enforce the real last known server state immediately,
        // without a fail-open window.
        prefs?.let { p ->
            if (p.contains(KEY_SRV_LOCKED)) {
                serverLocked = p.getBoolean(KEY_SRV_LOCKED, false)
                serverUnlockUntilMs = p.getLong(KEY_SRV_UNLOCK_UNTIL, 0L)
                everContactedServer = true
            }
        }
        poller = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "kiosk-lock-poll") }
        poller?.scheduleWithFixedDelay({ pollOnce() }, 0, 10, TimeUnit.SECONDS)
        connectWs()
    }

    fun stop() {
        poller?.shutdownNow(); poller = null
        ws?.close(1000, null); ws = null
    }

    fun currentLocked(): Boolean = compute()

    fun setLocalUnlockUntil(epochMs: Long) {
        localUnlockUntilMs = epochMs
        emitIfChanged()
    }

    private fun compute(): Boolean {
        val gate = maxOf(serverUnlockUntilMs, localUnlockUntilMs)
        return serverLocked && System.currentTimeMillis() >= gate
    }

    private fun emitIfChanged() {
        val now = compute()
        if (lastReported != now) {
            lastReported = now
            onLockChange(now)
        }
    }

    private fun pollOnce() {
        try {
            val req = Request.Builder().url("$baseUrl/api/kiosk/$doorbellId/lock").build()
            http.newCall(req).execute().use { resp: Response ->
                val body = resp.body?.string() ?: return
                val data = JSONObject(body).optJSONObject("data") ?: return
                applyState(data)
            }
        } catch (_: Exception) {
            // offline: só continua enforçando se o servidor já confirmou um
            // estado alguma vez; antes disso, mantém fail-open.
            if (everContactedServer) emitIfChanged()
        }
    }

    private fun applyState(data: JSONObject) {
        // 'locked' já é a verdade calculada no servidor; usamos direto:
        serverLocked = data.optBoolean("locked", true)
        val until = if (data.isNull("unlockUntil")) null else data.optString("unlockUntil", null)
        serverUnlockUntilMs = parseIso(until)
        everContactedServer = true
        prefs?.edit()
            ?.putBoolean(KEY_SRV_LOCKED, serverLocked)
            ?.putLong(KEY_SRV_UNLOCK_UNTIL, serverUnlockUntilMs)
            ?.apply()
        emitIfChanged()
    }

    private fun parseIso(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        return try {
            val fmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
            fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
            fmt.parse(iso)?.time ?: 0L
        } catch (_: Throwable) { 0L }
    }

    companion object {
        private const val KEY_SRV_LOCKED = "srv_locked"
        private const val KEY_SRV_UNLOCK_UNTIL = "srv_unlock_until"
    }

    private fun connectWs() {
        val wsUrl = baseUrl.replaceFirst("http", "ws") + "/ws/calls?deviceId=kiosk:$doorbellId:lock&role=kiosk&label=Campainha"
        val req = Request.Builder().url(wsUrl).build()
        ws = http.newWebSocket(req, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    if (msg.optString("type") == "kiosk-lock") {
                        serverLocked = msg.optBoolean("locked", true)
                        val until = if (msg.isNull("unlockUntil")) null else msg.optString("unlockUntil", null)
                        serverUnlockUntilMs = parseIso(until)
                        everContactedServer = true
                        prefs?.edit()
                            ?.putBoolean(KEY_SRV_LOCKED, serverLocked)
                            ?.putLong(KEY_SRV_UNLOCK_UNTIL, serverUnlockUntilMs)
                            ?.apply()
                        emitIfChanged()
                    }
                } catch (_: Exception) {}
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                // reconecta em 5s
                try {
                    poller?.schedule({ connectWs() }, 5, TimeUnit.SECONDS)
                } catch (_: Exception) {}
            }
        })
    }
}
