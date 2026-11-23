package com.mzazicare.mickeeper

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

// After the phone restarts (or the app is updated) Android does not restart the location sharing: it may only be
// started while the app is on screen. So, if this phone was sharing (a caretaker's or elder's phone that is signed
// in), show a notification asking to open MzaziCare. Opening it turns the sharing back on.
class ResumeReceiver : BroadcastReceiver() {
  companion object {
    const val PREFS = "mzazicare_resume"
    private const val CHANNEL_ID = "resume"
    private const val NOTIFICATION_ID = 4712

    fun show(context: Context) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      if (!prefs.getBoolean("on", false)) return
      if (Build.VERSION.SDK_INT >= 33 &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
      ) return
      val title = prefs.getString("title", null) ?: "Open MzaziCare to turn it back on"
      val body = prefs.getString("body", null) ?: "Your phone restarted, so MzaziCare stopped. Tap here so care visits keep being recorded."
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
          manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Turn MzaziCare back on", NotificationManager.IMPORTANCE_HIGH).apply {
              description = "When MzaziCare has stopped and needs to be opened once"
            }
          )
        }
      }
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      val tap = PendingIntent.getActivity(context, 1, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      val icon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
        .takeIf { it != 0 } ?: context.applicationInfo.icon
      val notification = NotificationCompat.Builder(context, CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setSmallIcon(icon)
        .setContentIntent(tap)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .build()
      try {
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
      } catch (e: SecurityException) {
        // Notifications turned off: nothing more can be done from here.
      }
    }

    fun clear(context: Context) {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED, "android.intent.action.QUICKBOOT_POWERON" -> show(context)
    }
  }
}
