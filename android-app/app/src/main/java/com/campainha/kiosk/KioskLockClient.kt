package com.campainha.kiosk

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
    private val onLockChange: (locked: Boolean) -> Unit,
) {
    private val http = OkHttpClient()
    private var ws: WebSocket? = null
    private var poller: ScheduledExecutorService? = null

    @Volatile private var serverLocked = true
    @Volatile private var serverUnlockUntilMs = 0L
    @Volatile private var localUnlockUntilMs = 0L
    @Volatile private var lastReported: Boolean? = null

    fun start() {
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
            // offline: mantém último estado; o gate local ainda vale
            emitIfChanged()
        }
    }

    private fun applyState(data: JSONObject) {
        // 'locked' já é a verdade calculada no servidor; usamos direto:
        serverLocked = data.optBoolean("locked", true)
        val until = if (data.isNull("unlockUntil")) null else data.optString("unlockUntil", null)
        serverUnlockUntilMs = parseIso(until)
        emitIfChanged()
    }

    private fun parseIso(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        return try {
            java.time.Instant.parse(iso).toEpochMilli()
        } catch (_: Exception) { 0L }
    }

    private fun connectWs() {
        val wsUrl = baseUrl.replaceFirst("http", "ws") + "/ws/calls?deviceId=kiosk:$doorbellId&role=kiosk&label=Campainha"
        val req = Request.Builder().url(wsUrl).build()
        ws = http.newWebSocket(req, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    if (msg.optString("type") == "kiosk-lock") {
                        serverLocked = msg.optBoolean("locked", true)
                        val until = if (msg.isNull("unlockUntil")) null else msg.optString("unlockUntil", null)
                        serverUnlockUntilMs = parseIso(until)
                        emitIfChanged()
                    }
                } catch (_: Exception) {}
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                // reconecta em 5s
                poller?.schedule({ connectWs() }, 5, TimeUnit.SECONDS)
            }
        })
    }
}
