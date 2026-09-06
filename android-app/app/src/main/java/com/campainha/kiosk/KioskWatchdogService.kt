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
import android.content.pm.ServiceInfo
import androidx.core.app.NotificationCompat

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
        try {
            // Android 14 (API 34) rejects the 2-arg startForeground for a
            // service typed "specialUse" - it must be given the type. And a
            // background start can still be refused (ForegroundServiceStart
            // NotAllowedException) - either way, never crash the whole app;
            // MainActivity's own onStop/onUserLeaveHint relaunch still runs.
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIF_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            } else {
                startForeground(NOTIF_ID, buildNotification())
            }
        } catch (e: Exception) {
            stopSelf()
            return START_NOT_STICKY
        }
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
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("Campainha ativa")
            .setContentText("O modo campainha está ligado neste aparelho.")
            .setSmallIcon(R.drawable.ic_stat_campainha)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        const val NOTIF_ID = 4711
        const val ACTION_START = "com.campainha.kiosk.WATCHDOG_START"
        const val ACTION_STOP = "com.campainha.kiosk.WATCHDOG_STOP"

        fun start(ctx: Context) {
            val i = Intent(ctx, KioskWatchdogService::class.java).setAction(ACTION_START)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
            } catch (e: Exception) {
                // e.g. started from the background on a device that forbids it
            }
        }
        fun stop(ctx: Context) {
            try {
                ctx.startService(Intent(ctx, KioskWatchdogService::class.java).setAction(ACTION_STOP))
            } catch (e: Exception) {
            }
        }
    }
}
