package com.mzazicare.mickeeper

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
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
  }
}
