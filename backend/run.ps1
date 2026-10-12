# Starts the MzaziCare API on all network interfaces (so a phone on the same Wi-Fi can reach it).
$py = "$env:LOCALAPPDATA\mzazicare-venv\Scripts\python.exe"
Set-Location $PSScriptRoot
& $py manage.py migrate
& $py manage.py runserver 0.0.0.0:8000
