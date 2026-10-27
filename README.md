# MzaziCare

A mobile-first, privacy-respecting platform that helps families who live far away (for example in the diaspora)
oversee the care of an elderly parent in Nairobi, Kenya. It checks that a hired caretaker is really present, tracks
their hours and tasks, listens to the *tone* of the visit (never storing the audio), and gives the elderly person a
simple screen with a one-tap emergency button.

Final-year project: BSc Informatics and Computer Science, Strathmore University.
Author: Kimani Alvin Thuo (167148). Supervisor: Dr. Esther Khakata.

## What it does

| Who | What they get |
|---|---|
| **Family** (the "sponsor") | Overview of today's shift, a Shifts tab with every day (tap one for the arrival, breaks and departure timeline), chores, medicines, how the elderly person feels, the tone of the care and alerts to confirm or dismiss. Separate private chats with the caretaker and the elderly person. Adds the people in the care circle and sets medicine reminders. |
| **Caretaker** | One shift per day, started by itself when they are within 15 m of the elderly person's phone. Stepping out is a **break** (the timer pauses and the same shift continues when they return); a new day is a new shift. Tap any day to see when they arrived, every break and when they left. Manual start/finish is also verified. Their own to-do list with tasks that repeat on working days, verified hours, chat with the family. |
| **Elderly person** | A large-text, English/Kiswahili screen: is my caretaker here, how am I feeling (one tap), today's medicines, message the family, and an always-visible emergency button. |

Everyone registers as a normal user. When a family adds an email as a caretaker or elderly person, that account (existing or future) is converted to that role and linked to the family, so each role sees its own home screen.

### Status against the proposal

| Area | State |
|---|---|
| Accounts, role-based access, 90-day sessions | Done |
| Geofence shifts (15 m around the elderly person's phone), hours, to-do list | Done (foreground only, see limitations) |
| Family dashboard, alerts with human confirmation, chat | Done |
| Elderly home screen, mood check-in, SOS, medicine reminders | Done (added beyond the proposal) |
| Acoustic tone model (trained, tested, served) | Done: 83.0 % overall, 75.4 % on speech alone |
| Phone recording for the tone model (both phones, only during a verified visit, only with both people's consent) | Done (foreground only) |
| Medical triage chatbot (mBERT) | Not started |
| Behavioural anomaly detection | Not started |
| Web dashboard for the family (Next.js): overview, alerts, shifts and timelines, live tone chart, chats, people and medicines | Done |

Details, decisions and the differences from the original proposal are in [`docs/`](docs/).

## Repository layout

```
mobile/    React Native (Expo) app in TypeScript: login, register and the three role-based home screens
web/       Family web dashboard (Next.js + TypeScript): the same API, for a browser on a PC
backend/   Django + Django REST Framework API, PostgreSQL, JWT authentication, geofence engine
ml/voice/  Acoustic tone model: data download, features, training, evaluation, inference, tests
scripts/   PowerShell automation: setup, database, run, data, tests, secret scan
docs/      Setup guide, data and ethics notes, API reference, Chapter 4 (analysis and design), proposal corrections
DEVELOPMENT_LOG.md   Every instruction executed during development
```

## Quick start (Windows)

Prerequisites: Git, Python 3.12+ (3.14 tested), Node 20+, PostgreSQL 15+ (17 tested), and **Expo Go** on a phone.
Keep the project **outside OneDrive** (for example `C:\dev\MzaziCare`): OneDrive can turn files into placeholders and break the mobile build.

```powershell
git clone <your repository URL> C:\dev\MzaziCare
cd C:\dev\MzaziCare

scripts\setup.ps1            # tools check, Python virtual environment, backend and mobile dependencies
scripts\create-db.ps1        # once: creates the database and role, writes backend\.env, runs migrations
scripts\run-backend.ps1      # API on http://0.0.0.0:8000   (leave this window open)
scripts\run-mobile.ps1       # Expo dev server: scan the QR code with Expo Go (same Wi-Fi as the PC)
scripts\run-web.ps1          # optional: the family web dashboard on http://localhost:3000 (sign in with a family account)
```

`create-db.ps1` asks for the PostgreSQL admin password once. It is typed without echo and never stored; the app gets its own
database role with a generated password.

To see a populated family dashboard before real visits exist, register a family, a caretaker and an elderly account, link them in the
app, then:

```powershell
cd backend
& "$env:LOCALAPPDATA\mzazicare-venv\Scripts\python.exe" manage.py seed_demo family@example.com   # clearly flagged sample data
```

More detail, including phone networking and firewall rules, is in [`docs/SETUP.md`](docs/SETUP.md).

## Tests and checks

```powershell
scripts\test.ps1
```

Runs the secret scan, Django checks, **123 backend tests**, **24 ML tests** and the TypeScript type-check. The backend tests use in-memory
SQLite with dummy settings, so they need no database and no secrets. (For the ML tests run `scripts\setup.ps1 -WithML` once.)

## The acoustic tone model

```powershell
scripts\setup.ps1 -WithML       # PyTorch (CPU), ONNX Runtime, audio libraries
scripts\prepare-data.ps1        # downloads about 1.7 GB of public datasets, builds features, checks them
scripts\prepare-data.ps1 -Train # ...and trains (about 1 hour on a 4-core CPU)
```

The trained model (about 1 MB) is already included in `ml/voice/artifacts/`, so the backend works without retraining. Model card:
[`ml/voice/README.md`](ml/voice/README.md). Data sources, preparation and ethics: [`docs/DATA.md`](docs/DATA.md).

## Configuration and secrets

* Nothing secret is stored in Git. `backend/.env` (database password, Django secret key) and `mobile/.env.local` are git-ignored; the
  `*.env.example` files document every setting.
* `scripts\check-secrets.ps1` (run by `scripts\test.ps1`) fails if a credential, key or `.env` file is tracked.
* The app talks only to this project's own backend. There are no third-party API keys.
* Raw audio is never written to disk or the database: it is analysed in memory and dropped. The phones delete each clip right after uploading it, record only while the server says a verified visit is running and both the caretaker and the elderly person have agreed, and never at home.

## Known limitations

* Location sharing and voice capture work only while the app is open on both phones (background tracking and recording need a development build).
* The tone model was trained on acted English speech; accuracy in real homes, with Kenyan accents or Kiswahili, is untested.
* Updates reach the screens by polling every 4 to 30 seconds. There are no push notifications yet.
* The server is a development server. It has not been hardened or deployed.

## Documentation

| Document | Contents |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Environment, step-by-step setup, running on a phone, troubleshooting |
| [`docs/DATA.md`](docs/DATA.md) | Databases, datasets, preparation, access and ethical requirements, checks performed |
| [`docs/API.md`](docs/API.md) | Every API endpoint, who may call it, what it returns |
| [`docs/chapter4-analysis-and-design.md`](docs/chapter4-analysis-and-design.md) | Chapter 4: analysis and design as implemented, with diagrams |
| [`docs/proposal-corrections.md`](docs/proposal-corrections.md) | What changed from the proposal, and why |
| [`ml/voice/README.md`](ml/voice/README.md) | Tone model card: data, results, limits |
| [`DEVELOPMENT_LOG.md`](DEVELOPMENT_LOG.md) | Development history |
