<#
.SYNOPSIS
  Scans the files tracked by Git (and any staged changes) for passwords, keys and tokens.
  Exits non-zero if it finds something, so it can guard commits and CI.
#>
. "$PSScriptRoot\_common.ps1"
Set-Location $Root

$problems = New-Object System.Collections.Generic.List[string]

# 1. A real .env must never be tracked (the .example templates are fine).
foreach ($f in (git ls-files)) {
    $name = Split-Path $f -Leaf
    if ($name -match '^\.env(\..+)?$' -and $name -ne '.env.example') { $problems.Add("tracked environment file: $f") }
    if ($name -match '\.(pem|key|p12|jks)$') { $problems.Add("tracked key/certificate file: $f") }
    if ($name -match '^(google-services\.json|GoogleService-Info\.plist)$|firebase-adminsdk|service-account.*\.json$') { $problems.Add("tracked Firebase file: $f") }
}

# 2. Suspicious content in tracked text files.
$patterns = @(
    @{ Name = 'private key block';        Regex = '-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----' },
    @{ Name = 'AWS access key id';        Regex = 'AKIA[0-9A-Z]{16}' },
    @{ Name = 'GitHub token';             Regex = 'gh[pousr]_[A-Za-z0-9]{30,}' },
    @{ Name = 'Google/Firebase API key';  Regex = '(?<![0-9A-Za-z_\-])AIza[0-9A-Za-z_\-]{35}(?![0-9A-Za-z_\-])' },
    @{ Name = 'service account key';      Regex = '"private_key_id"\s*:\s*"[0-9a-f]{20,}"' },
    @{ Name = 'hard-coded credential';    Regex = '(?i)(password|passwd|secret_key|api[_-]?key|auth[_-]?token)\s*[=:]\s*[''"][^''"\s]{12,}[''"]' }
)
$skipExt = '\.(png|jpg|jpeg|gif|ico|onnx|pt|npz|wav|flac|zip|gz|lock|woff2?|ttf)$'
$files = git ls-files | Where-Object { $_ -notmatch $skipExt -and $_ -notmatch 'package-lock\.json$' }
foreach ($f in $files) {
    $path = Join-Path $Root $f
    if (-not (Test-Path $path)) { continue }
    $lineNo = 0
    foreach ($line in (Get-Content $path -ErrorAction SilentlyContinue)) {
        $lineNo++
        if ($line -match 'os\.environ|change-me|example|placeholder|<your') { continue }
        foreach ($p in $patterns) {
            # case-sensitive: real keys have a fixed case (AKIA..., AIza...); patterns that should ignore case say (?i)
            if ($line -cmatch $p.Regex) { $problems.Add("$($p.Name) in ${f}:$lineNo") }
        }
    }
}

if ($problems.Count -gt 0) {
    $problems | ForEach-Object { Write-Host "  XX  $_" -ForegroundColor Red }
    Fail "Found $($problems.Count) possible secret(s). Remove them (and rotate anything that was real)."
}
Ok "no secrets found in $(@($files).Count) tracked files"
