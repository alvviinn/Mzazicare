# MzaziCare

A mobile-first, privacy-respecting platform that helps families who live far away (for example in the diaspora)
oversee the care of an elderly parent in Nairobi, Kenya. It checks that a hired caretaker is really present, tracks
their hours and tasks, listens to the *tone* of the visit (never storing the audio), gives caretakers a first-aid
assistant, and gives the elderly person a simple screen with a one-tap emergency button that reaches the whole family.

Final-year project: BSc Informatics and Computer Science, Strathmore University.
Author: Kimani Alvin Thuo (167148). Supervisor: Dr. Esther Khakata.

## What it does

| Who | What they get |
|---|---|
| **Family** (the "sponsor") | Phone app and web dashboard: today's shift live, a Shifts tab with every day (tap one for the arrival, breaks, departure timeline and map), tasks with photo proof, medicines, how the elderly person feels, the live tone of the care, and alerts with their evidence to confirm or dismiss. Separate private chats with the caretaker and the elderly person. Adds the people in the care circle, assigns tasks and sets medicine reminders. Push notifications for alerts, emergencies and messages. |
| **Caretaker** | One shift per day, started by itself when they are within 15 m of the elderly person's phone, even with the app closed. Stepping out is a **break** (the timer pauses and the same shift continues when they return); a new day is a new shift. Their own to-do list (tasks repeat on working days; ticking one off needs a photo taken within range), verified hours, a first-aid assistant in English and Kiswahili, chat with the family. |
| **Elderly person** | A large-text, English/Kiswahili screen: is my caretaker here, how am I feeling (one tap), today's medicines with reminders that ring at dose time, message the family, and an always-visible "I need help" button. |

**Emergencies.** "I need help" rings full screen on every family and caretaker phone and shows on the dashboard, with
the position. The first person to tap "I'm handling it" on a phone, or "Handled" / "False alarm" on the dashboard,
closes it for everyone: the other alarms stop, the others are told who is handling it, and the elder sees that help is
coming. The history keeps when it happened and who handled it when.

Everyone registers as a normal user (email with a 6-digit sign-in code, or Google). When a family adds an email as a
caretaker or elderly person, that account (existing or future) is converted to that role and linked to the family, so
each role sees its own home screen.

### Status against the proposal

| Area | State |
|---|---|
| Accounts, role-based access, two-step sign-in, Google sign-in, 90-day sessions | Done |
| Geofence shifts (15 m around the elderly person's phone), hours, to-do list with photo proof | Done, works in the background |
| Family dashboard (phone and web), alerts with human confirmation, chat, push notifications | Done |
| Elderly home screen, mood check-in, SOS that closes for everyone once handled, medicine reminders | Done (added beyond the proposal) |
| Acoustic tone model (trained, tested, served) | Done. Round 2 (laughter no longer reads as tense): 76.4 % on speech alone, every tone at least as good as round 1 |
| Phone recording for the tone model (both phones, only during a verified visit, only with both people's consent) | Done, works in the background |
| Medical triage chatbot, delivered as the caretakers' first-aid assistant (English and Kiswahili; advice only from a vetted guide) | Done. The proposal named mBERT; a fine-tuned multilingual-e5-small (also multilingual, English and Kiswahili) is used instead |
| Deployment | API and dashboard on Microsoft Azure; Android app as a signed APK |

Details, decisions and the differences from the original proposal are in [`docs/`](docs/).

## Repository layout

```
mobile/       React Native (Expo) app in TypeScript: sign-in and the three role-based home screens; local native
              module modules/mic-keeper (lets the tone check record in the background)
web/          Family web dashboard (Next.js + TypeScript): the same API, for a browser on a PC
backend/      Django + Django REST Framework API, PostgreSQL, JWT authentication, geofence engine, push (FCM)
ml/voice/     Acoustic tone model: data download, features, training, evaluation, inference, tests
ml/firstaid/  First-aid assistant: the vetted guide (English and Kiswahili), training, evaluation, tests
scripts/      PowerShell automation: setup, database, run, data, tests, secret scan, APK build, Azure deploy
docs/         Setup guide, data and ethics notes, API reference, Chapter 4 (analysis and design), proposal corrections
DEVELOPMENT_LOG.md   Every instruction executed during development
```

## Quick start (Windows)

Prerequisites: Git, Python 3.12+ (3.14 tested), Node 20+, PostgreSQL 15+ (17 tested), and an Android phone.
Keep the project **outside OneDrive** (for example `C:\dev\MzaziCare`): OneDrive can turn files into placeholders and break the mobile build.

```powershell
git clone <your repository URL> C:\dev\MzaziCare
cd C:\dev\MzaziCare

scripts\setup.ps1            # tools check, Python virtual environment, backend and mobile dependencies
scripts\create-db.ps1        # once: creates the database and role, writes backend\.env, runs migrations
scripts\run-backend.ps1      # API on http://0.0.0.0:8000   (leave this window open)
scripts\run-web.ps1          # optional: the family web dashboard on http://localhost:3000 (sign in with a family account)
scripts\build-apk.ps1 -Api <API address> -Install   # the Android app (about 25 minutes; USB debugging on)
```

The app now has native parts (background location, background recording, push), so it runs as the built APK, not in
Expo Go. `scripts\run-mobile.ps1` still starts the Expo dev server for screens that do not need them.

`create-db.ps1` asks for the PostgreSQL admin password once. It is typed without echo and never stored; the app gets its own
database role with a generated password.

To see a populated family dashboard before real visits exist, register a family, a caretaker and an elderly account, link them in the
app, then:

```powershell
cd backend
& "$env:LOCALAPPDATA\mzazicare-venv\Scripts\python.exe" manage.py seed_demo family@example.com   # clearly flagged sample data
```

More detail, including phone networking and firewall rules, is in [`docs/SETUP.md`](docs/SETUP.md).

## Deployment

```powershell
scripts\deploy-azure.ps1               # API (App Service), PostgreSQL and the web dashboard (static website)
scripts\deploy-azure.ps1 -Only api     # or just one part: api | web
```

Needs the Azure CLI signed in. Generated passwords, the app signing key and the Firebase files live in
`%LOCALAPPDATA%\mzazicare-deploy`, never in Git.

## Tests and checks

```powershell
scripts\test.ps1
```

Runs the secret scan, Django checks, **208 backend tests**, **34 tone-model tests**, **20 first-aid tests** and the
TypeScript type-check. The backend tests use in-memory SQLite with dummy settings, so they need no database and no
secrets. (For the ML tests run `scripts\setup.ps1 -WithML` once.)

## The acoustic tone model

```powershell
scripts\setup.ps1 -WithML       # PyTorch (CPU), ONNX Runtime, audio libraries
scripts\prepare-data.ps1        # downloads the public datasets, builds features, checks them
scripts\prepare-data.ps1 -Train # ...and trains (1 to 2 hours on a 4-core CPU)
```

The trained model (about 1 MB) is already included in `ml/voice/artifacts/`, so the backend works without retraining.
Round 2 (November 2026) added laughter and other human sounds to the training data: joking, laughing visits shown as
tense fell from 22.8 % to 1.4 %, with no tone recognised worse and no change to how the app works. Model card:
[`ml/voice/README.md`](ml/voice/README.md). Data sources, preparation and ethics: [`docs/DATA.md`](docs/DATA.md).

## The first-aid assistant

A caretaker types what is happening ("bibi ameanguka bafuni", "he is choking") and gets numbered first-aid steps. A
fine-tuned multilingual model only recognises the situation. The advice itself comes from a vetted guide of 43
topics, and danger words always put "call for help now" first. It runs on our own server and stores no messages.
Model card: [`ml/firstaid/README.md`](ml/firstaid/README.md).

## Configuration and secrets

* Nothing secret is stored in Git. `backend/.env` (database password, Django secret key) and `mobile/.env.local` are git-ignored; the
  `*.env.example` files document every setting. Deployment secrets stay in `%LOCALAPPDATA%\mzazicare-deploy`.
* `scripts\check-secrets.ps1` (run by `scripts\test.ps1`) fails if a credential, key or `.env` file is tracked.
* The app talks only to this project's own backend, plus Firebase Cloud Messaging for push notifications and Google
  for "Sign in with Google". No AI service outside our own server is used.
* Raw audio is never written to disk or the database: it is analysed in memory and dropped. The phones delete each clip right after uploading it, record only while the server says a verified visit is running and both the caretaker and the elderly person have agreed, and never at home.
* Location and recording in the background are shown in a permanent notification, and stop when the person signs out.

## Known limitations

* The tone model was trained on acted English speech and crowdsourced laughter; accuracy in real homes, with Kenyan
  accents or Kiswahili, is untested.
* The first-aid guide and its Kiswahili text still need sign-off by a clinician and a native-speaking first-aid trainer.
* Background operation is Android only, and some phone makers stop background apps unless battery use is set to
  "Unrestricted" for MzaziCare.
* The Azure deployment uses student-tier resources; it has not been load-tested or hardened for production.

## Documentation

| Document | Contents |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Environment, step-by-step setup, running on a phone, troubleshooting |
| [`docs/DATA.md`](docs/DATA.md) | Databases, datasets, preparation, access and ethical requirements, checks performed |
| [`docs/API.md`](docs/API.md) | Every API endpoint, who may call it, what it returns |
| [`docs/chapter4-analysis-and-design.md`](docs/chapter4-analysis-and-design.md) | Chapter 4: analysis and design as implemented, with diagrams |
| [`docs/proposal-corrections.md`](docs/proposal-corrections.md) | What changed from the proposal, and why |
| [`ml/voice/README.md`](ml/voice/README.md) | Tone model card: data, results, limits |
| [`ml/firstaid/README.md`](ml/firstaid/README.md) | First-aid assistant: design, data, results, limits |
| [`DEVELOPMENT_LOG.md`](DEVELOPMENT_LOG.md) | Development history |
