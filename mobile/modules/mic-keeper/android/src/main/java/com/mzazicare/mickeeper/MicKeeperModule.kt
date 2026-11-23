package com.mzazicare.mickeeper

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android only lets an app use the microphone in the background from a "microphone" foreground service
// that was started while the app was on screen. Visits start by themselves (often with the screen off),
// so the app starts this service while it is open and keeps it until voice monitoring is turned off or
// the user signs out. The service itself never records: expo-audio does, and only during a verified visit.
class MicKeeperModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MzaziMicKeeper")

    // Returns false when it cannot start (no microphone permission). Call only while the app is on screen.
    Function("start") { title: String, body: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        return@Function false
      }
      if (MicKeeperService.running) return@Function true
      val intent = Intent(context, MicKeeperService::class.java)
        .putExtra("title", title)
        .putExtra("body", body)
      ContextCompat.startForegroundService(context, intent)
      true
    }

    Function("stop") {
      val context = appContext.reactContext ?: return@Function false
      context.stopService(Intent(context, MicKeeperService::class.java))
    }

    Function("isRunning") { MicKeeperService.running }

    // Battery saving ("Optimised" or "Restricted") is what puts MzaziCare to sleep when it has not been opened
    // for a while. True when the phone leaves it alone ("Unrestricted").
    Function("batteryUnrestricted") {
      val context = appContext.reactContext ?: return@Function true
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      power.isIgnoringBatteryOptimizations(context.packageName)
    }

    // Shows Android's "Let MzaziCare always run in the background?" question; if a phone maker removed it,
    // opens the battery settings list instead.
    Function("askBatteryUnrestricted") {
      val activity = appContext.currentActivity ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function false
      try {
        activity.startActivity(
          Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${activity.packageName}"))
        )
        true
      } catch (e: Exception) {
        try {
          activity.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
          true
        } catch (e2: Exception) {
          false
        }
      }
    }

    // On while this phone shares its location: after a restart or an update, ResumeReceiver then asks the
    // person to open MzaziCare. Off when they sign out.
    Function("setResumeReminder") { on: Boolean, title: String, body: String ->
      val context = appContext.reactContext ?: return@Function false
      context.getSharedPreferences(ResumeReceiver.PREFS, Context.MODE_PRIVATE).edit()
        .putBoolean("on", on).putString("title", title).putString("body", body).apply()
      ResumeReceiver.clear(context) // the app is open now, so any "open MzaziCare" reminder is done
      true
    }
  }
}
