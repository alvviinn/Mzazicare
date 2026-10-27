<#
.SYNOPSIS
  Starts the family web dashboard (Next.js) on http://localhost:3000. The backend must be running (scripts\run-backend.ps1).
.DESCRIPTION
  OneDrive locks files while npm installs thousands of them, so by default the dashboard is run from a copy in
  %LOCALAPPDATA%\mzazicare-web (the source in web\ is copied over on every start; edit web\, then restart this script).
  Use -InPlace if the project lives outside OneDrive and you want hot reload straight from web\.
#>
param([int]$Port = 3000, [switch]$InPlace, [string]$Api = 'http://127.0.0.1:8000')

. "$PSScriptRoot\_common.ps1"

if (-not (Test-Tool 'node')) { Fail 'Node.js is not installed. Install the LTS version from https://nodejs.org and try again.' }
$source = Join-Path $Root 'web'

if ($InPlace) {
    $work = $source
} else {
    $work = Join-Path $LocalData 'mzazicare-web'
    Step "Copying web\ to $work"
    New-Item -ItemType Directory -Force $work | Out-Null
    # /XD keeps the installed packages and the build cache; everything else in the source wins.
    & robocopy $source $work /E /XD node_modules .next /XF .env.local /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Fail "Could not copy the web app (robocopy $LASTEXITCODE)." }
}

# Where the dashboard finds the backend (read in the browser, so it must be reachable from this PC).
$envFile = Join-Path $work '.env.local'
if (-not (Test-Path $envFile)) {
    [IO.File]::WriteAllText($envFile, "NEXT_PUBLIC_API_URL=$Api`n", (New-Object Text.UTF8Encoding($false)))
}

Push-Location $work
try {
    if (-not (Test-Path (Join-Path $work 'node_modules\.bin\next.cmd'))) {
        Step 'Installing the dashboard packages (first time only, a few minutes)'
        Run 'npm' @('install', '--no-audit', '--no-fund')
    }
    Step "Starting the dashboard on http://localhost:$Port (Ctrl+C to stop)"
    & npx next dev -p $Port
} finally { Pop-Location }
