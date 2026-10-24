<#
.SYNOPSIS
  Starts the Expo dev server for the mobile app. Scan the QR code with Expo Go on a phone on the same Wi-Fi.

.DESCRIPTION
  Creates mobile\.env.local (git-ignored) with this PC's Wi-Fi address if it does not exist yet, so the app
  knows where the backend is.

.PARAMETER Clear
  Clear the Metro cache (use after changing .env.local or app.json).
#>
param([switch]$Clear)

. "$PSScriptRoot\_common.ps1"

$mobile = Join-Path $Root 'mobile'
if (-not (Test-Path (Join-Path $mobile 'node_modules'))) { Fail 'Run scripts\setup.ps1 first (it installs the mobile dependencies).' }

$envLocal = Join-Path $mobile '.env.local'
if (-not (Test-Path $envLocal)) {
    $ip = Get-WifiIp
    if (-not $ip) { Fail 'Could not detect this PC''s Wi-Fi address. Copy mobile\.env.example to mobile\.env.local and edit it.' }
    [IO.File]::WriteAllText($envLocal, "EXPO_PUBLIC_API_URL=http://${ip}:8000`n", (New-Object System.Text.UTF8Encoding($false)))
    Ok "created mobile\.env.local pointing at http://${ip}:8000"
    $Clear = $true
} else {
    Ok ('using ' + ((Get-Content $envLocal | Where-Object { $_ -match '^EXPO_PUBLIC_API_URL=' }) -join ''))
}
$detected = Get-WifiIp
if ($detected -and -not (Select-String -Path $envLocal -Pattern ([regex]::Escape($detected)) -Quiet)) {
    # The PC joined a different Wi-Fi network, so its address changed. Keep the app pointing at it.
    [IO.File]::WriteAllText($envLocal, "EXPO_PUBLIC_API_URL=http://${detected}:8000`n", (New-Object System.Text.UTF8Encoding($false)))
    Ok "this PC's Wi-Fi address changed: updated mobile\.env.local to http://${detected}:8000"
    $Clear = $true
}

# Windows firewall rules from docs\SETUP.md only apply to Private networks.
$wifi = Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|Wireless' -and $_.IPv4Connectivity -eq 'Internet' } | Select-Object -First 1
if ($wifi -and $wifi.NetworkCategory -ne 'Private') {
    Warn "Wi-Fi network '$($wifi.Name)' is set to $($wifi.NetworkCategory), so the firewall will block your phone."
    Warn 'Fix (PowerShell as Administrator):  Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private'
}

Push-Location $mobile
try {
    # Run Expo directly. Do NOT pipe its output (for example through the Run helper): Expo then thinks it is
    # not in a terminal and hides the QR code and the keyboard shortcuts.
    if ($Clear) { & npx expo start -c } else { & npx expo start }
} finally { Pop-Location }
