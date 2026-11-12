<#
.SYNOPSIS
  Deploys MzaziCare to Azure: the Django API (App Service, Linux), its PostgreSQL database (Flexible Server) and
  the family web dashboard (static files on an Azure Storage static website). Safe to run again: it reuses what exists and redeploys the code.
.DESCRIPTION
  Needs the Azure CLI signed in (az login). Resource names, the database password and the Django secret are made on
  the first run and kept in %LOCALAPPDATA%\mzazicare-deploy\azure.json (outside Git and OneDrive).

  Cost on Azure for Students: App Service B1 (about US$13 a month, from the free credit), PostgreSQL B1ms
  (free for 12 months), Storage static website (a few cents a month).
  Azure for Students only allows some regions (here: South Africa North); Static Web Apps is not offered there. Stop the web app when not needed:  az webapp stop -g <group> -n <app>
.EXAMPLE
  scripts\deploy-azure.ps1
  scripts\deploy-azure.ps1 -Only web      # just rebuild and upload the dashboard
#>
param(
    [string]$Location = 'southafricanorth',   # closest allowed region to Kenya
    [ValidateSet('all', 'api', 'web')][string]$Only = 'all'
)

. "$PSScriptRoot\_common.ps1"

$az = Join-Path $LocalData 'azcli\Scripts\az.bat'  # the Azure CLI installed with pip in its own venv
if (-not (Test-Path $az)) { $cmd = Get-Command az -ErrorAction SilentlyContinue; if ($cmd) { $az = $cmd.Source } else { Fail 'Azure CLI not found.' } }

# Plain functions (no param block) so options like -n, -l and -o reach az instead of PowerShell.
function Az {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $out = & $az @args --only-show-errors 2>&1 } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { Fail ("az $($args[0..2] -join ' ') failed:`n" + ($out -join "`n")) }
    return ($out | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }) -join "`n"
}
function AzJson { (Az @args -o json) | ConvertFrom-Json }
function AzTry {
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & $az @args --only-show-errors -o json 2>$null } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0 -or -not $out) { return $null }
    return ($out -join "`n") | ConvertFrom-Json
}

# ---- Signed in? ----
$account = AzTry account show
if (-not $account) { Fail "Not signed in to Azure. Run:  & '$az' login" }
Ok "Azure subscription: $($account.name)"

# ---- Names and secrets, made once ----
$stateDir = Join-Path $LocalData 'mzazicare-deploy'
$stateFile = Join-Path $stateDir 'azure.json'
New-Item -ItemType Directory -Force $stateDir | Out-Null
if (Test-Path $stateFile) {
    $state = Get-Content $stateFile -Raw | ConvertFrom-Json
} else {
    $suffix = (New-RandomString 6).ToLower()
    $state = [pscustomobject]@{
        group = 'mzazicare-rg'
        db_server = "mzazicare-db-$suffix"
        db_name = 'mzazicare'
        db_user = 'mzaziadmin'
        db_password = (New-RandomString 28) + 'aA1'
        plan = 'mzazicare-plan'
        api = "mzazicare-api-$suffix"
        storage = "mzazicareweb$suffix"   # 3-24 lowercase letters and digits
        secret_key = New-RandomString 60
    }
    $state | ConvertTo-Json | Set-Content $stateFile -Encoding UTF8
    Ok "Names and secrets saved in $stateFile (keep this file private)"
}
$apiHost = "$($state.api).azurewebsites.net"

Step "Resource group $($state.group) ($Location)"
Az group create -n $state.group -l $Location -o none | Out-Null

# ---- Dashboard storage first: the API must know the dashboard's address (CORS) ----
$storage = AzTry storage account show -n $state.storage -g $state.group
if (-not $storage) {
    Step "Creating the dashboard storage $($state.storage) (static website)"
    $storage = AzJson storage account create -n $state.storage -g $state.group -l $Location `
        --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 --allow-blob-public-access false
}
$storageKey = (AzJson storage account keys list -n $state.storage -g $state.group)[0].value
Az storage blob service-properties update --account-name $state.storage --account-key $storageKey `
    --static-website --index-document index.html --404-document 404.html -o none | Out-Null
$webHost = ([uri]$storage.primaryEndpoints.web).Host
Ok "Dashboard address: https://$webHost"

if ($Only -in 'all', 'api') {
    # ---- PostgreSQL ----
    $db = AzTry postgres flexible-server show -n $state.db_server -g $state.group
    if (-not $db) {
        Step "Creating PostgreSQL $($state.db_server) (B1ms; takes about 5-10 minutes)"
        Az postgres flexible-server create -n $state.db_server -g $state.group -l $Location `
            --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 `
            --admin-user $state.db_user --admin-password $state.db_password `
            --public-access 0.0.0.0 --yes -o none | Out-Null   # 0.0.0.0 = only Azure services (the API) may connect
    }
    if (-not (AzTry postgres flexible-server db show -s $state.db_server -g $state.group -n $state.db_name)) {
        Az postgres flexible-server db create -s $state.db_server -g $state.group -n $state.db_name -o none | Out-Null
    }
    Ok 'Database ready'

    # ---- App Service ----
    if (-not (AzTry appservice plan show -n $state.plan -g $state.group)) {
        Step 'Creating the App Service plan (Linux B1)'
        Az appservice plan create -n $state.plan -g $state.group -l $Location --is-linux --sku B1 -o none | Out-Null
    }
    if (-not (AzTry webapp show -n $state.api -g $state.group)) {
        # Each line starts with e.g. "PYTHON|3.14". 3.14 is what the backend is developed and tested on.
        $runtimes = ((Az webapp list-runtimes --os-type linux -o tsv) -split "`n") | ForEach-Object { ($_ -split "`t")[0].Trim() }
        $runtime = @('PYTHON|3.14', 'PYTHON|3.13') | Where-Object { $runtimes -contains $_ } | Select-Object -First 1
        if (-not $runtime) { Fail 'No supported Python runtime (3.14 or 3.13) offered by App Service.' }
        $runtime = $runtime -replace '\|', ':'
        Step "Creating the API web app $($state.api) ($runtime)"
        Az webapp create -n $state.api -g $state.group -p $state.plan --runtime $runtime -o none | Out-Null
    }
    Az webapp update -n $state.api -g $state.group --https-only true -o none | Out-Null
    Az webapp config set -n $state.api -g $state.group --always-on true --http20-enabled true `
        --startup-file 'python manage.py migrate --noinput && gunicorn config.wsgi --bind=0.0.0.0:8000 --workers 2 --timeout 120' -o none | Out-Null

    # Settings (secrets stay in Azure; nothing is written into the code).
    $settings = @(
        'SCM_DO_BUILD_DURING_DEPLOYMENT=true',
        "DJANGO_SECRET_KEY=$($state.secret_key)",
        'DJANGO_DEBUG=0',
        "DJANGO_ALLOWED_HOSTS=$apiHost",
        "DB_NAME=$($state.db_name)",
        "DB_USER=$($state.db_user)",
        "DB_PASSWORD=$($state.db_password)",
        "DB_HOST=$($state.db_server).postgres.database.azure.com",
        'DB_PORT=5432',
        'DB_SSLMODE=require',
        "CORS_ALLOWED_ORIGINS=https://$webHost",
        'VOICE_AI_ROOT=/home/site/wwwroot/ml'
    )
    # Optional extras from backend\.env: Google sign-in and the email server for sign-in codes.
    $localEnv = Join-Path $Root 'backend\.env'
    if (Test-Path $localEnv) {
        foreach ($line in Get-Content $localEnv) {
            if ($line -match '^(GOOGLE_CLIENT_IDS|EMAIL_HOST|EMAIL_PORT|EMAIL_HOST_USER|EMAIL_HOST_PASSWORD|EMAIL_USE_TLS|EMAIL_FROM)=(.+)$') { $settings += $line }
        }
    }
    # Push notifications: the Firebase key is kept outside the project; Azure gets it as a secret setting.
    $firebaseKey = Join-Path $stateDir 'firebase-service-account.json'
    if (Test-Path $firebaseKey) {
        $settings += "FIREBASE_CREDENTIALS_B64=$([Convert]::ToBase64String([IO.File]::ReadAllBytes($firebaseKey)))"
    } else {
        Write-Host "  (no $firebaseKey - push notifications stay off)"
    }
    Step 'Saving the API settings'
    Az webapp config appsettings set -n $state.api -g $state.group --settings @settings -o none | Out-Null

    # ---- Package: the backend plus the parts of ml\voice the server uses (code + the ONNX model) ----
    Step 'Packaging the API'
    $pkg = Join-Path $stateDir 'api'
    if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
    New-Item -ItemType Directory -Force $pkg | Out-Null
    & robocopy (Join-Path $Root 'backend') $pkg /E /XD __pycache__ staticfiles /XF .env *.pyc db.sqlite3 /NFL /NDL /NJH /NJS /NP | Out-Null
    $voice = Join-Path $pkg 'ml\voice'
    New-Item -ItemType Directory -Force (Join-Path $voice 'artifacts') | Out-Null
    foreach ($f in '__init__.py', 'config.py', 'features.py', 'infer.py') { Copy-Item (Join-Path $Root "ml\voice\$f") $voice }
    foreach ($f in 'tone_cnn.onnx', 'labels.json') { Copy-Item (Join-Path $Root "ml\voice\artifacts\$f") (Join-Path $voice 'artifacts') }
    # First-aid assistant: its runtime code, the vetted guide and the fine-tuned question model (8-bit ONNX).
    $firstaid = Join-Path $pkg 'ml\firstaid'
    New-Item -ItemType Directory -Force (Join-Path $firstaid 'artifacts') | Out-Null
    Set-Content -Path (Join-Path $firstaid '__init__.py') -Value '' -Encoding ascii
    Copy-Item (Join-Path $Root 'ml\firstaid\assistant.py') $firstaid
    Copy-Item (Join-Path $Root 'ml\firstaid\safety.py') $firstaid  # round-3 policy (numpy only)
    foreach ($f in 'guide.json', 'intent.onnx', 'intent.json', 'tokenizer.json', 'policy.json',
                   'baseline.npz', 'baseline_vocab.json', 'danger.npz', 'danger_vocab.json',
                   'oos_gate.npz', 'oos_gate_vocab.json') {
        $src = Join-Path $Root "ml\firstaid\artifacts\$f"
        if (Test-Path $src) { Copy-Item $src (Join-Path $firstaid 'artifacts') } else { Warn "First-aid file missing: $f (run python -m firstaid.export in ml)" }
    }
    $zip = Join-Path $stateDir 'api.zip'
    if (Test-Path $zip) { Remove-Item $zip -Force }
    # Zipped with Python: Windows PowerShell's Compress-Archive writes backslashes, which Linux unpacks wrongly.
    # ('zip' is spelled with chr() because Windows PowerShell drops quotes inside arguments to native programs.)
    Run $Py @('-c', 'import shutil, sys; shutil.make_archive(sys.argv[1][:-4], chr(122) + chr(105) + chr(112), sys.argv[2])', $zip, $pkg)
    Step 'Uploading the API (Azure installs the Python packages; takes a few minutes)'
    # --async: the CLI's own wait for Azure's build can hang for hours, so we upload and then poll the site ourselves.
    Az webapp deploy -n $state.api -g $state.group --src-path $zip --type zip --async true -o none | Out-Null
    Step 'Waiting for the API to start (up to 20 minutes)'
    $deadline = (Get-Date).AddMinutes(20); $up = $false
    while (-not $up -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 20
        try { Invoke-WebRequest "https://$apiHost/api/me/" -UseBasicParsing -TimeoutSec 30 | Out-Null; $up = $true }
        catch { if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { $up = $true } }  # 401 = running, sign-in needed
    }
    if (-not $up) { Warn "The API did not answer yet. Check:  az webapp log tail -n $($state.api) -g $($state.group)" }
    Ok "API deployed: https://$apiHost"
}

if ($Only -in 'all', 'web') {
    # ---- Dashboard: static build pointing at the API, uploaded with the Static Web Apps CLI ----
    $work = Join-Path $LocalData 'mzazicare-web'
    Step "Building the dashboard for https://$apiHost"
    New-Item -ItemType Directory -Force $work | Out-Null
    & robocopy (Join-Path $Root 'web') $work /MIR /XD node_modules .next out /XF .env.local /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Fail "Could not copy the web app (robocopy $LASTEXITCODE)." }
    $envLines = @("NEXT_PUBLIC_API_URL=https://$apiHost")
    $webEnv = Join-Path $Root 'web\.env.local'
    if (Test-Path $webEnv) { $envLines += Get-Content $webEnv | Where-Object { $_ -match '^NEXT_PUBLIC_GOOGLE_CLIENT_ID=' } }
    [IO.File]::WriteAllText((Join-Path $work '.env.production.local'), ($envLines -join "`n") + "`n", (New-Object Text.UTF8Encoding($false)))
    Push-Location $work
    try {
        if (-not (Test-Path 'node_modules')) { Run 'npm.cmd' @('ci', '--no-audit', '--no-fund') }
        if (Test-Path '.next') { Remove-Item '.next' -Recurse -Force }
        $env:NEXT_PUBLIC_API_URL = "https://$apiHost"
        Run 'npx.cmd' @('next', 'build')
    } finally { Pop-Location; Remove-Item Env:NEXT_PUBLIC_API_URL -ErrorAction SilentlyContinue }

    Step 'Uploading the dashboard'
    Az storage blob delete-batch -s '$web' --account-name $state.storage --account-key $storageKey -o none | Out-Null
    Az storage blob upload-batch -s (Join-Path $work 'out') -d '$web' --account-name $state.storage --account-key $storageKey --overwrite -o none | Out-Null
    Ok "Dashboard deployed: https://$webHost"
}

Write-Host ''
Write-Host "API:        https://$apiHost"
Write-Host "Dashboard:  https://$webHost"
Write-Host "Phone app:  scripts\build-apk.ps1 -Api https://$apiHost"
