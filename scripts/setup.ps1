<#
.SYNOPSIS
  One-command development setup for MzaziCare on Windows.

.DESCRIPTION
  Checks the required tools, creates the Python virtual environment (outside the repository), installs
  backend and mobile dependencies, and optionally sets up the machine-learning environment.
  Safe to run again: anything already in place is skipped.

  After this, run scripts\create-db.ps1 once (database + backend\.env), then scripts\run-backend.ps1
  and scripts\run-mobile.ps1.

.PARAMETER WithML
  Also create the ML environment (PyTorch CPU, ONNX Runtime, audio libraries). About 1 GB download.

.PARAMETER SkipMobile
  Skip `npm install` for the mobile app.
#>
param([switch]$WithML, [switch]$SkipMobile)

. "$PSScriptRoot\_common.ps1"

Step 'Checking required tools'
foreach ($t in 'git', 'python', 'node', 'npm') {
    if (Test-Tool $t) { Ok "$t found" } else { Fail "$t is not installed or not on PATH. See docs\SETUP.md." }
}
$pyVersion = [version]((python -c "import sys; print('%d.%d' % sys.version_info[:2])").Trim())
if ($pyVersion -lt [version]'3.12') { Fail "Python 3.12 or newer is required (found $pyVersion)." } else { Ok "Python $pyVersion" }
$nodeMajor = [int](((node -v).Trim().TrimStart('v')).Split('.')[0])
if ($nodeMajor -lt 20) { Fail "Node 20 or newer is required (found $(node -v))." } else { Ok "Node $(node -v)" }
if (Find-Psql) { Ok 'PostgreSQL client found' } else { Warn 'PostgreSQL (psql) not found. Install PostgreSQL 15+ before running create-db.ps1.' }
if ($Root -match 'OneDrive') {
    Warn 'This folder is inside OneDrive. OneDrive can turn project files into placeholders and break the mobile build.'
    Warn 'Prefer a folder such as C:\dev\MzaziCare. (Virtual environments are already kept outside the repo.)'
}

Step "Backend virtual environment ($VenvDir)"
if (-not (Test-Path $Py)) { Run python @('-m', 'venv', $VenvDir) }
Run $Py @('-m', 'pip', 'install', '--quiet', '--upgrade', 'pip')
Run $Py @('-m', 'pip', 'install', '--quiet', '-r', (Join-Path $Root 'backend\requirements.txt'))
Ok 'backend dependencies installed'

if (-not (Test-Path (Join-Path $Root 'backend\.env'))) {
    Warn 'backend\.env is missing. Run scripts\create-db.ps1 to create the database and this file.'
} else { Ok 'backend\.env present' }

if (-not $SkipMobile) {
    Step 'Mobile dependencies (npm install)'
    Push-Location (Join-Path $Root 'mobile')
    try { Run npm @('install', '--no-audit', '--no-fund') } finally { Pop-Location }
    Ok 'mobile dependencies installed'
}

if ($WithML) {
    Step "ML virtual environment ($MlVenvDir)"
    if (-not (Test-Path $MlPy)) { Run python @('-m', 'venv', $MlVenvDir) }
    Run $MlPy @('-m', 'pip', 'install', '--quiet', '--upgrade', 'pip')
    Run $MlPy @('-m', 'pip', 'install', '--quiet', 'torch', '--index-url', 'https://download.pytorch.org/whl/cpu')
    Run $MlPy @('-m', 'pip', 'install', '--quiet', '-r', (Join-Path $Root 'ml\voice\requirements.txt'))
    Ok 'ML dependencies installed'
}

Write-Host ''
Write-Host 'Setup finished. Next:' -ForegroundColor Green
Write-Host '  1. scripts\create-db.ps1     (once: database + backend\.env)'
Write-Host '  2. scripts\run-backend.ps1   (API on port 8000)'
Write-Host '  3. scripts\run-mobile.ps1    (Expo; scan the QR code with Expo Go)'
Write-Host '  4. scripts\test.ps1          (run all checks)'
