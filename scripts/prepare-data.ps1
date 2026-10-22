<#
.SYNOPSIS
  Downloads and prepares the audio datasets for the acoustic tone model, then checks them.

.DESCRIPTION
  Data goes to C:\mzazicare-data\voice (override with the MZAZI_DATA environment variable), outside the repository.
  About 1.7 GB to download and 2.5 GB on disk. Re-running skips anything already present.
  Dataset sources, licences and the ethics notes are in docs\DATA.md.

.PARAMETER Train
  Also train the model afterwards (about one hour on a 4-core CPU).
#>
param([switch]$Train)

. "$PSScriptRoot\_common.ps1"
if (-not (Test-Path $MlPy)) { Fail 'ML environment missing. Run scripts\setup.ps1 -WithML first.' }

Push-Location (Join-Path $Root 'ml')
try {
    Step 'Downloading datasets (RAVDESS, CREMA-D, LibriSpeech, ESC-50)'
    Run $MlPy @('-u', '-m', 'voice.get_data')
    Step 'Building MFCC features'
    Run $MlPy @('-u', '-m', 'voice.build_features')
    Step 'Checking the data'
    Run $MlPy @('-u', '-m', 'voice.check_data')
    if ($Train) {
        Step 'Training the model'
        Run $MlPy @('-u', '-m', 'voice.train', '--epochs', '30')
    }
} finally { Pop-Location }
Ok 'data is ready'
