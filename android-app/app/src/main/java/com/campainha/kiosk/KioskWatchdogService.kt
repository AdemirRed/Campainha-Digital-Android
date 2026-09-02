package com.campainha.kiosk

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager

class KioskWatchdogService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var running = false

    private val tick = object : Runnable {
        override fun run() {
            if (!running) return
            val interactive = (getSystemService(POWER_SERVICE) as PowerManager).isInteractive
            if (interactive && !MainActivity.foreground) {
                MainActivity.relaunchSelf(applicationContext)
            }
            handler.postDelayed(this, 700)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopSelf(); return START_NOT_STICKY }
        }
        startForeground(NOTIF_ID, buildNotification())
        if (!running) { running = true; handler.post(tick) }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val channelId = "kiosk_watchdog"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(channelId, "Campainha ativa", NotificationManager.IMPORTANCE_LOW)
            )
        }
        return Notification.Builder(this, channelId)
            .setContentTitle("Campainha ativa")
            .setContentText("O modo campainha está ligado neste aparelho.")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val NOTIF_ID = 4711
        const val ACTION_START = "com.campainha.kiosk.WATCHDOG_START"
        const val ACTION_STOP = "com.campainha.kiosk.WATCHDOG_STOP"

        fun start(ctx: Context) {
            val i = Intent(ctx, KioskWatchdogService::class.java).setAction(ACTION_START)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
        }
        fun stop(ctx: Context) {
            ctx.startService(Intent(ctx, KioskWatchdogService::class.java).setAction(ACTION_STOP))
        }
    }
}
