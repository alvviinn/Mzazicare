package com.mzazicare.mickeeper

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

// A foreground service of type "microphone" that only keeps the app ALLOWED to record in the background.
// It does not open the microphone; the phone's green microphone dot shows only while a clip is recorded.
class MicKeeperService : Service() {
  companion object {
    @Volatile
    var running = false
    private const val CHANNEL_ID = "voice_check"
    private const val NOTIFICATION_ID = 4711
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra("title") ?: "MzaziCare voice check"
    val body = intent?.getStringExtra("body") ?: ""
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
          manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Voice check", NotificationManager.IMPORTANCE_LOW).apply {
              description = "Shown while MzaziCare may check the tone of voice during care visits"
              setShowBadge(false)
            }
          )
        }
      }
      val launch = packageManager.getLaunchIntentForPackage(packageName)
      val tap = launch?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
      val icon = resources.getIdentifier("notification_icon", "drawable", packageName).takeIf { it != 0 } ?: applicationInfo.icon
      val notification = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setSmallIcon(icon)
        .setContentIntent(tap)
        .setOngoing(true)
        .setSilent(true)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
      running = true
    } catch (e: Exception) {
      // E.g. the microphone permission was taken away, or Android refused the start: just don't run.
      running = false
      stopSelf()
    }
    // If Android kills it, don't restart in the background (that start would be refused); the app restarts it when opened.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    running = false
    super.onDestroy()
  }
}
