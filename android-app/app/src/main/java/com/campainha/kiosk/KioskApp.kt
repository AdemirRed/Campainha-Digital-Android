package com.campainha.kiosk

import android.app.Activity
import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import kotlin.system.exitProcess

// Last-ditch self-healing: if anything throws an uncaught exception, don't
// just die silently - schedule the app to relaunch a couple of seconds
// later (via AlarmManager, which the system holds even after our process
// is gone) and then exit. This is what keeps the doorbell coming back
// when the operator isn't there to reopen it by hand.
class KioskApp : Application() {

    override fun onCreate() {
        super.onCreate()

        val previous = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                Log.e("Campainha", "uncaught exception - scheduling restart", throwable)
                scheduleRestart(this)
            } catch (_: Throwable) {
                // nothing else we can do
            } finally {
                previous?.uncaughtException(thread, throwable)
                exitProcess(2)
            }
        }
    }

    companion object {
        fun scheduleRestart(ctx: Context, delayMs: Long = 2500L) {
            val launch = Intent(ctx, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val flags = PendingIntent.FLAG_ONE_SHOT or
                (if (android.os.Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
            val pi = PendingIntent.getActivity(ctx, 4712, launch, flags)
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            try {
                am.setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + delayMs,
                    pi,
                )
            } catch (_: Throwable) {
                am.set(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + delayMs,
                    pi,
                )
            }
        }

        // Called from an Activity when it detects it was closed while it
        // should still be running.
        fun scheduleRestartFrom(activity: Activity) = scheduleRestart(activity.applicationContext)
    }
}
