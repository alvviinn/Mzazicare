<#
.SYNOPSIS
  Runs every automated check: secret scan, backend tests, migration consistency, ML unit tests, mobile type-check.
  Exits non-zero if anything fails.
#>
. "$PSScriptRoot\_common.ps1"

$failed = @()
function Check($name, [scriptblock]$body) {
    Step $name
    $global:LASTEXITCODE = 0
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'   # tools print progress to stderr; the exit code decides pass or fail
    try { & $body 2>&1 | ForEach-Object { $line = "$_"; if ($line -ne 'System.Management.Automation.RemoteException') { Write-Host $line } } }
    catch { Write-Host "  XX  $_" -ForegroundColor Red; $script:failed += $name; return }
    finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { Write-Host "  XX  exit code $LASTEXITCODE" -ForegroundColor Red; $script:failed += $name } else { Ok 'passed' }
}

Check 'Secret scan' { & "$PSScriptRoot\check-secrets.ps1" }

if (Test-Path $Py) {
    Push-Location (Join-Path $Root 'backend')
    try {
        Check 'Backend: Django system check'      { & $Py manage.py check --settings=config.settings_test }
        Check 'Backend: no missing migrations'    { & $Py manage.py makemigrations --check --dry-run --settings=config.settings_test }
        Check 'Backend: unit and API tests'       { & $Py manage.py test --settings=config.settings_test -v 1 }
    } finally { Pop-Location }
} else { Warn 'Backend venv missing: run scripts\setup.ps1. Skipping backend checks.'; $failed += 'Backend (not set up)' }

if (Test-Path $MlPy) {
    Push-Location (Join-Path $Root 'ml')
    try { Check 'ML: unit tests' { & $MlPy -m unittest discover -s voice/tests -t . -v } } finally { Pop-Location }
} else { Warn 'ML venv missing (scripts\setup.ps1 -WithML). Skipping ML tests.' }

if (Test-Path (Join-Path $Root 'mobile\node_modules')) {
    Push-Location (Join-Path $Root 'mobile')
    try { Check 'Mobile: TypeScript type-check' { & npx tsc --noEmit } } finally { Pop-Location }
} else { Warn 'mobile\node_modules missing: skipping the type-check.' }

Write-Host ''
if ($failed.Count -gt 0) { Write-Host ("FAILED: " + ($failed -join '; ')) -ForegroundColor Red; exit 1 }
Write-Host 'All checks passed.' -ForegroundColor Green
