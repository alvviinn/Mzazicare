<#
.SYNOPSIS
  Applies migrations and starts the API on all network interfaces (port 8000), so a phone on the same Wi-Fi can reach it.
#>
param([int]$Port = 8000)

. "$PSScriptRoot\_common.ps1"

if (-not (Test-Path $Py)) { Fail 'Run scripts\setup.ps1 first.' }
if (-not (Test-Path (Join-Path $Root 'backend\.env'))) { Fail 'backend\.env is missing. Run scripts\create-db.ps1 first.' }

Push-Location (Join-Path $Root 'backend')
try {
    Step 'Applying migrations'
    Run $Py @('manage.py', 'migrate')
    Step "Starting the API on http://0.0.0.0:$Port (Ctrl+C to stop)"
    & $Py manage.py runserver "0.0.0.0:$Port"
} finally { Pop-Location }
