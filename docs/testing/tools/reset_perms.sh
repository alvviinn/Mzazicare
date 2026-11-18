# usage: bash reset_perms.sh <serial>   revoke the app's location and camera permissions before a session (setup only)
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
for p in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION ACCESS_BACKGROUND_LOCATION CAMERA RECORD_AUDIO; do
  "$ADB" -s "$1" shell pm revoke com.mzazicare.app android.permission.$p 2>/dev/null
done
"$ADB" -s "$1" shell pm clear-permission-flags com.mzazicare.app android.permission.ACCESS_FINE_LOCATION user-set user-fixed 2>/dev/null
"$ADB" -s "$1" shell dumpsys package com.mzazicare.app | grep -E "LOCATION|CAMERA|RECORD_AUDIO" | grep granted | head
