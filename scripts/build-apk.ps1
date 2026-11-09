<#
.SYNOPSIS
  Builds the MzaziCare Android app as an installable, signed release APK (no Play Store), and can install it on a
  phone plugged in by USB.
.DESCRIPTION
  The app is built from a copy in C:\mzb\mobile: OneDrive locks files during big builds, and the Android native
  build fails on Windows paths longer than 260 characters.

  The APK is signed with your own release key, created on the first run in %LOCALAPPDATA%\mzazicare-deploy
  (never in Git or OneDrive). KEEP THAT FOLDER: an update only installs over the old app if it is signed with the
  same key.

  The backend address is built into the app, so pass the deployed API address (https://...azurewebsites.net).
.EXAMPLE
  scripts\build-apk.ps1 -Api https://mzazicare-api.azurewebsites.net -Install
#>
param(
    [Parameter(Mandatory = $true)][string]$Api,
    [switch]$Install,          # install on the phone connected by USB (USB debugging on)
    [string]$Work = 'C:\mzb'
)

. "$PSScriptRoot\_common.ps1"

if (-not (Test-Tool 'node')) { Fail 'Node.js is not installed.' }
$Api = $Api.TrimEnd('/')
if ($Api -notmatch '^https://') { Warn 'The address is not https. Android blocks plain http in release builds unless allowed.' }

# ---- Android SDK and Java (from Android Studio) ----
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $LocalData 'Android\Sdk' }
if (-not (Test-Path (Join-Path $sdk 'platform-tools'))) { Fail "Android SDK not found at $sdk. Install Android Studio (it installs the SDK)." }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$jbr = 'C:\Program Files\Android\Android Studio\jbr'
if (-not $env:JAVA_HOME -and (Test-Path $jbr)) { $env:JAVA_HOME = $jbr }
if (-not $env:JAVA_HOME) { Fail 'JAVA_HOME is not set and Android Studio''s Java was not found.' }
$env:Path = "$env:JAVA_HOME\bin;$sdk\platform-tools;$env:Path"

# ---- Release signing key (made once, kept outside the project) ----
$keyDir = Join-Path $LocalData 'mzazicare-deploy'
$keystore = Join-Path $keyDir 'mzazicare-release.jks'
$keyProps = Join-Path $keyDir 'keystore.properties'
New-Item -ItemType Directory -Force $keyDir | Out-Null
if (-not (Test-Path $keystore)) {
    Step 'Creating your release signing key (first build only)'
    $pass = New-RandomString 24
    Run (Join-Path $env:JAVA_HOME 'bin\keytool.exe') @('-genkeypair', '-v', '-storetype', 'PKCS12', '-keystore', $keystore,
        '-alias', 'mzazicare', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
        '-storepass', $pass, '-keypass', $pass, '-dname', 'CN=MzaziCare, O=MzaziCare, C=KE')
    [IO.File]::WriteAllText($keyProps, "storePassword=$pass`nkeyPassword=$pass`nkeyAlias=mzazicare`n", (New-Object Text.UTF8Encoding($false)))
    Ok "Key saved in $keyDir (back this folder up)"
}
$props = @{}
foreach ($line in Get-Content $keyProps) { if ($line -match '^(\w+)=(.*)$') { $props[$Matches[1]] = $Matches[2] } }

# ---- Copy the app to the short build folder ----
$app = Join-Path $Work 'mobile'
Step "Copying mobile\ to $app"
New-Item -ItemType Directory -Force $app | Out-Null
& robocopy (Join-Path $Root 'mobile') $app /MIR /XD node_modules android ios .expo /XF .env.local /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Fail "Could not copy the app (robocopy $LASTEXITCODE)." }

# The backend address and optional Google IDs are built into the app.
$envLines = @("EXPO_PUBLIC_API_URL=$Api")
$localEnv = Join-Path $Root 'mobile\.env.local'
if (Test-Path $localEnv) { $envLines += Get-Content $localEnv | Where-Object { $_ -match '^EXPO_PUBLIC_GOOGLE_' } }
[IO.File]::WriteAllText((Join-Path $app '.env.local'), ($envLines -join "`n") + "`n", (New-Object Text.UTF8Encoding($false)))

Push-Location $app
try {
    Step 'Installing packages'
    Run 'npm.cmd' @('ci', '--no-audit', '--no-fund')

    Step 'Generating the Android project'
    Run 'npx.cmd' @('expo', 'prebuild', '--platform', 'android', '--clean', '--no-install')

    # Sign release builds with the key above (Expo's template signs them with the debug key).
    $gradleFile = Join-Path $app 'android\app\build.gradle'
    $gradle = [IO.File]::ReadAllText($gradleFile)
    $releaseSigning = @"
        release {
            storeFile file('$($keystore -replace '\\', '/')')
            storePassword '$($props.storePassword)'
            keyAlias '$($props.keyAlias)'
            keyPassword '$($props.keyPassword)'
        }
"@
    $gradle = $gradle -replace '(signingConfigs \{\s*\r?\n)', "`$1$releaseSigning`n"  # newline: Groovy must not join it with "debug {"
    $gradle = $gradle -replace '(release \{[^{}]*?)signingConfig signingConfigs\.debug', '$1signingConfig signingConfigs.release'
    if ($gradle -notmatch 'signingConfig signingConfigs\.release') { Fail 'Could not set up release signing in android/app/build.gradle.' }
    [IO.File]::WriteAllText($gradleFile, $gradle, (New-Object Text.UTF8Encoding($false)))

    # Real phones only: 64-bit and 32-bit ARM (budget phones often run 32-bit Android). Skipping the emulator
    # types (x86, x86_64) makes the build faster and the APK about half the size.
    if (-not $env:ORG_GRADLE_PROJECT_reactNativeArchitectures) { $env:ORG_GRADLE_PROJECT_reactNativeArchitectures = 'armeabi-v7a,arm64-v8a' }
    Step 'Building the release APK (the first build downloads Gradle and takes a while)'
    Push-Location (Join-Path $app 'android')
    try { Run '.\gradlew.bat' @('assembleRelease', '--no-daemon') } finally { Pop-Location }
} finally { Pop-Location }

$built = Join-Path $app 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path $built)) { Fail 'The APK was not produced.' }
$outDir = Join-Path $Root 'dist'
New-Item -ItemType Directory -Force $outDir | Out-Null
$apk = Join-Path $outDir 'MzaziCare.apk'
Copy-Item $built $apk -Force
Ok ("APK ready: $apk ({0:N1} MB)" -f ((Get-Item $apk).Length / 1MB))

if ($Install) {
    Step 'Installing on the phone connected by USB'
    Run 'adb' @('install', '-r', $apk)
    Ok 'Installed. Open MzaziCare on the phone.'
} else {
    Write-Host 'To install: plug the phone in (USB debugging on) and run  adb install -r dist\MzaziCare.apk'
    Write-Host 'or copy dist\MzaziCare.apk to the phone, open it, and allow "Install unknown apps" when asked.'
}
