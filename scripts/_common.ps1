# Shared helpers for the scripts in this folder. Dot-source it: . "$PSScriptRoot\_common.ps1"
# Plain ASCII only: Windows PowerShell 5.1 reads BOM-less files as ANSI.

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
# Virtual environments live OUTSIDE the repository (and outside OneDrive, which breaks them).
# (LOCALAPPDATA is Windows only; the fallback lets check-secrets.ps1 also run in Linux CI.)
$LocalData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $HOME '.local/share' }
$VenvDir = if ($env:MZAZI_VENV) { $env:MZAZI_VENV } else { Join-Path $LocalData 'mzazicare-venv' }
$MlVenvDir = if ($env:MZAZI_ML_VENV) { $env:MZAZI_ML_VENV } else { Join-Path $LocalData 'mzazicare-ml' }
$Py = Join-Path $VenvDir 'Scripts\python.exe'
$MlPy = Join-Path $MlVenvDir 'Scripts\python.exe'

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  ok  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "  XX  $msg" -ForegroundColor Red; exit 1 }

# Run a native command and stop the script if it fails.
function Run {
    param([string]$Exe, [string[]]$Arguments)
    # Many tools (pip, Django, npm) print progress to stderr. That is not a failure: trust the exit code.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Exe @Arguments 2>&1 | ForEach-Object { $line = "$_"; if ($line -ne 'System.Management.Automation.RemoteException') { Write-Host $line } } } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { Fail "Command failed ($LASTEXITCODE): $Exe $($Arguments -join ' ')" }
}

function Test-Tool($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Find-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $found = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

function New-RandomString([int]$Length = 24) {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Get-WifiIp {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|Wireless' -and $_.IPAddress -notmatch '^(127|169\.254)' } |
        Select-Object -First 1
    if ($ip) { return $ip.IPAddress }
    $any = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|VirtualBox|VMware|Bluetooth' } |
        Select-Object -First 1
    if ($any) { return $any.IPAddress }
    return $null
}
