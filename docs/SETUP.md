# Setup guide

This is the detailed version of the quick start in the root [README](../README.md). The scripts in `scripts/` automate every step below;
the manual commands are given so you can see (and repeat) what they do.

## 1. Development environment

| Tool | Version used | Needed for |
|---|---|---|
| Windows | 10 Pro | the PowerShell scripts (the code itself also runs on macOS/Linux) |
| Git | any recent | version control |
| Python | 3.14 (3.12+ works) | backend and ML |
| Node.js / npm | 25 / 11 (Node 20+ works) | mobile app |
| PostgreSQL | 17 (15+ works) | database. PostGIS is installed but not used yet |
| Expo Go | latest from the store | running the app on a phone |

Machine used for development: Intel Core i7-8650U (4 cores), 15 GB RAM, **no dedicated GPU**, 47 GB free disk. The acoustic model is small
enough to train on this CPU in about an hour, so Kaggle GPUs were not needed.

## 2. Get the code

```powershell
git clone <repository URL> C:\dev\MzaziCare
cd C:\dev\MzaziCare
```

Keep the folder outside OneDrive. OneDrive can replace files with cloud placeholders (the bundler then reports
"Unable to resolve module"). The Python virtual environments are already created outside the repository.

## 3. Automated setup

```powershell
scripts\setup.ps1              # add -WithML for the machine-learning environment, -SkipMobile to skip npm
scripts\create-db.ps1          # creates database + role, writes backend\.env, migrates
```

`setup.ps1` checks the tools, creates `%LOCALAPPDATA%\mzazicare-venv`, installs `backend\requirements.txt` and runs `npm install`.
`create-db.ps1` asks for the PostgreSQL admin password (not stored), creates the `mzazicare` role with a generated password and the
`mzazicare` database, writes `backend\.env`, and applies the migrations. It refuses to overwrite an existing `.env` without `-Force`.

### Manual equivalent

```powershell
python -m venv $env:LOCALAPPDATA\mzazicare-venv
& $env:LOCALAPPDATA\mzazicare-venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd mobile; npm install; cd ..

# database (as the PostgreSQL admin)
psql -U postgres -c "CREATE ROLE mzazicare LOGIN PASSWORD '<choose one>'"
psql -U postgres -c "CREATE DATABASE mzazicare OWNER mzazicare"
copy backend\.env.example backend\.env      # then fill in the values (see the comments in the file)
cd backend
& $env:LOCALAPPDATA\mzazicare-venv\Scripts\python.exe manage.py migrate
```

## 4. Run it

```powershell
scripts\run-backend.ps1      # window 1: API on port 8000
scripts\run-mobile.ps1       # window 2: Expo; writes mobile\.env.local with this PC's Wi-Fi address if missing
```

Scan the QR code with Expo Go (Android) or the Camera app (iPhone). The phone must be on the same Wi-Fi as the PC.

### Making the phone able to reach the backend (Windows)

Run once in an **Administrator** PowerShell:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
New-NetFirewallRule -DisplayName "MzaziCare API"  -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "MzaziCare Expo" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow -Profile Private
```

Check from the phone's browser: `http://<PC Wi-Fi IP>:8000/api/me/` should show
`{"detail":"Authentication credentials were not provided."}`.

For the Android emulator use `http://10.0.2.2:8000` in `mobile\.env.local`.

### Trying the whole flow with three accounts

1. Register the family account (for example `pat@test.com`).
2. Register the caretaker and the elderly person (`cara@test.com`, `ella@test.com`).
3. As the family, open **People** and add each email with its role. Both accounts now show their own home screen after the app is reopened.
4. For the geofence you need two phones with the app open: one signed in as the caretaker, one as the elderly person.
5. For a populated dashboard without real visits, use `manage.py seed_demo <family email>` (sample data is clearly flagged in the app).

## 5. Tests

```powershell
scripts\test.ps1
```

* Secret scan of every tracked file
* `manage.py check` and a check that no migration is missing
* 99 backend tests (in-memory SQLite, dummy settings: `--settings=config.settings_test`)
* 24 ML tests (needs `setup.ps1 -WithML`)
* `tsc --noEmit` for the mobile app

## 6. Machine-learning environment (optional)

```powershell
scripts\setup.ps1 -WithML
scripts\prepare-data.ps1            # download, build features, check
scripts\prepare-data.ps1 -Train     # also train
```

See [DATA.md](DATA.md) for what is downloaded and why, and [`ml/voice/README.md`](../ml/voice/README.md) for the model.

## 7. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Unable to resolve module ./index.ts" | OneDrive turned files into placeholders. Move the project out of OneDrive and run `npm install` again. |
| App cannot reach the server | Wi-Fi profile is Public, firewall rule missing, PC's address changed (edit `mobile\.env.local`, run `scripts\run-mobile.ps1 -Clear`), or the phone is on mobile data. |
| `create-db.ps1` says psql was not found | Install PostgreSQL, or add its `bin` folder to PATH. |
| Backend stops when the laptop sleeps | Keep it plugged in and set sleep to Never while testing. |
| Location sharing stops | The app must be open on both phones with the screen on (background tracking is not built yet). |
| Tests fail with a database error | They should not need PostgreSQL. Make sure you used `--settings=config.settings_test` (the script does). |
