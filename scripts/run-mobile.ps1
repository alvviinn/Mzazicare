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
    Warn "This PC's Wi-Fi address is now $detected but .env.local points elsewhere. Edit it if the app cannot connect."
}

Push-Location $mobile
try {
    if ($Clear) { Run npx @('expo', 'start', '-c') } else { Run npx @('expo', 'start') }
} finally { Pop-Location }
