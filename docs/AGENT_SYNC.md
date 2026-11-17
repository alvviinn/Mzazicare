# Agent sync: Chapter 4 and Chapter 5

Shared by the Chapter 4 agent and the Chapter 5 agent. Read before each step and before finishing.

## Shared facts

Names taken from the code (backend/accounts/models.py, backend/care/models.py, backend/*/urls.py, mobile/src, web/src).

- **System name:** MzaziCare: a mobile-first, AI-enhanced elderly care monitoring system.
- **User roles** (`User.role`): `user` (shown as **Family sponsor** / family account), `caretaker` (**Caretaker**), `elderly` (**Elderly person**).
- **Entities (Django models):** User, Invite, LoginChallenge (accounts app); Location, TrackPoint, Shift, ShiftSegment, Task, TaskCompletion, Chore, ToneReading, ToneSample, Alert, CheckIn, Medication, MedicationLog, Message, PushDevice (care app).
- **Statuses**
  - Alert.status: `open`, `confirmed`, `dismissed`. Alert.kind: `sos`, `unwell`, `vocal_distress`, `geofence`, `missed_chore`, `short_visit`.
  - Shift: `source` = `auto` / `manual`; caretaker phase (`GET /shift/state/`): `none`, `waiting`, `active`, `break`, `away`, `ended`; dashboard shift status: `none`, `on_shift`, `paused`, `away`, `waiting`, `completed`.
  - Tone: `happy`, `calm`, `neutral`, `stressed`, `angry` (plus `noise` inside the model only). Mood: `good`, `okay`, `unwell`.
  - Medicine (elder home): `taken`, `due`, `missed`, `later`. Caretaker presence (elder home): `here`, `away`, `left`, `not_arrived`, `none`.
- **Tech stack:** React Native + Expo (TypeScript) mobile app; Next.js static-export web dashboard (family); Django + Django REST Framework API with SimpleJWT; PostgreSQL; ONNX Runtime tone model (2D CNN, trained with PyTorch in ml/voice); first-aid assistant (fine-tuned `intfloat/multilingual-e5-small` classifier + vetted bilingual guide, ml/firstaid); Firebase Cloud Messaging push; Azure Communication Services email for sign-in codes; Google Sign-In.
- **Deployment:** Azure App Service (Linux, B1) runs the API; Azure Database for PostgreSQL Flexible Server (B1ms); Azure Storage static website hosts the web dashboard; APK built for Android.
- **Mobile screens:** LoginScreen, RegisterScreen (with code step), UserHome (tabs Home/Overview, Shifts, Tone, Chats, People), CaretakerHome (tabs Shift, Tasks, Hours, First aid), ElderlyHome, ChatScreen, ShiftDetailScreen, EmergencyAlert overlay.
- **Web dashboard pages (family):** /login, / (Home), /shifts, /shifts/day, /tasks (Task history), /tone (Voice tone), /chats, /people.
- **Core flows:** two-step sign-in; linking a caretaker/elderly by email (`POST /team/`); automatic day shift by geofence (`POST /location/`, 15 m enter / 20 m exit); task tick with proof photo (`POST /tasks/<id>/done/`); voice tone analysis (`POST /audio/tone/`); emergency button (`POST /elder/sos/`); first-aid chat (`POST /firstaid/chat/`); family reviews alerts (`POST /alerts/<id>/`).

## Figure register

| Figure | Title | Chapter | File | Owner |
|---|---|---|---|---|

## Requests

## Decisions & conflicts

- (Ch5 agent, 2026-11-17) The report file is `C:\Users\HP\OneDrive - Strathmore University\AlvinKimani_167148_DrEstherKhakata(25)_Chapter5_v2.docx`. The Ch5 agent rebuilds the whole file from the untouched original on every build, so edits made directly in the .docx are lost. Deliver figures as PNG files with a register entry, and text changes as exact before/after text under Requests. The Ch5 agent inserts them.
- (Ch5 agent) The build already puts placeholders in Chapter 4 for Figure 4.6 (Mobile Application Wireframes), Figure 4.7 (Web Dashboard Wireframe) and Figure 4.8 (System Architecture Diagram). It also rewrites the paragraphs before and after Figure 4.8, and adds captions to Figures 4.1 to 4.5.
- (Ch5 agent) Report wording: the roles are "the family", "the caregiver" and "the elderly person" (the code says caretaker). The geofence is 15 m to enter and 20 m to leave. Emergency number 922, with 999 as the second.

## Lock

free
