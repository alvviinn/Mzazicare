# Agent sync: Chapter 4 and Chapter 5

Shared by the Chapter 4 agent and the Chapter 5 agent. Read before each step and before finishing.

## Shared facts

Names taken from the code (backend/accounts/models.py, backend/care/models.py, backend/*/urls.py, mobile/src, web/src).

- **System name:** MzaziCare: a mobile-first, AI-enhanced elderly care monitoring system.
- **User roles** (`User.role`): `user` (shown as **Family sponsor** / family account), `caretaker` (**Caretaker**), `elderly` (**Elderly person**).
- **Entities (Django models):** User, Invite, LoginChallenge (accounts app); Location, TrackPoint, Shift, ShiftSegment, Task, TaskCompletion, Chore, ToneReading, ToneSample, Alert, CheckIn, Medication, MedicationLog, Message, PushDevice (care app).
- **Report wording for roles:** family, caregiver, elderly person (code values `user`, `caretaker`, `elderly`).
- **Manual shift start:** removed on 2026-11-12 (commit 2d173fd). `POST /shift/start/` always returns 400; shifts start only by geofence. "End" (`POST /shift/stop/`) remains.
- **Statuses**
  - Alert.status: `open`, `confirmed`, `dismissed`. Alert.kind: `sos`, `unwell`, `vocal_distress`, `geofence`, `missed_chore`, `short_visit`.
  - Shift: `source` = `auto` / `manual`; caretaker phase (`GET /shift/state/`): `none`, `waiting`, `active`, `break`, `away`, `ended`; dashboard shift status: `none`, `on_shift`, `paused`, `away`, `waiting`, `completed`.
  - Tone: `happy`, `calm`, `neutral`, `stressed`, `angry` (plus `noise` inside the model only). Mood: `good`, `okay`, `unwell`.
  - Medicine (elder home): `taken`, `due`, `missed`, `later`. Caretaker presence (elder home): `here`, `away`, `left`, `not_arrived`, `none`.
- **Tech stack:** React Native + Expo (TypeScript) mobile app; Next.js static-export web dashboard (family); Django + Django REST Framework API with SimpleJWT; PostgreSQL; ONNX Runtime tone model (2D CNN, trained with PyTorch in ml/voice); first-aid assistant (fine-tuned `intfloat/multilingual-e5-small` classifier + vetted bilingual guide, ml/firstaid); Firebase Cloud Messaging push; Azure Communication Services email for sign-in codes; Google Sign-In.
- **Deployment:** Azure App Service (Linux, B1) runs the API; Azure Database for PostgreSQL Flexible Server (B1ms); Azure Storage static website hosts the web dashboard; APK built for Android.
- **Mobile screens:** LoginScreen, RegisterScreen (with code step), UserHome (tabs Home/Overview, Shifts, Tone, Chats, People), CaretakerHome (tabs Today/ShiftTab, Tasks, Hours, First aid), ElderlyHome, ChatScreen, ShiftDetailScreen, EmergencyAlert overlay.
- **Web dashboard pages (family):** /login, / (Home), /shifts, /shifts/day, /tasks (Task history), /tone (Voice tone), /chats, /people.
- **Core flows:** two-step sign-in; linking a caretaker/elderly by email (`POST /team/`); automatic day shift by geofence (`POST /location/`, 15 m enter / 20 m exit); task tick with proof photo (`POST /tasks/<id>/done/`); voice tone analysis (`POST /audio/tone/`); emergency button (`POST /elder/sos/`); first-aid chat (`POST /firstaid/chat/`); family reviews alerts (`POST /alerts/<id>/`).

## Figure register

| Figure | Title | Chapter | File | Owner |
|---|---|---|---|---|
| 4.1 | Use Case Diagram | 4 | docs/diagrams/fig4_01_use_case.png | Chapter 4 agent |
| 4.2 | Context Diagram (Level 0 Data Flow Diagram) | 4 | docs/diagrams/fig4_02_context_dfd0.png | Chapter 4 agent |
| 4.3 | Level 1 Data Flow Diagram | 4 | docs/diagrams/fig4_03_dfd1.png | Chapter 4 agent |
| 4.4 | Sequence Diagram: Two-Step Sign-In | 4 | docs/diagrams/fig4_04_seq_sign_in.png | Chapter 4 agent |
| 4.5 | Sequence Diagram: Automatic Shift by Geofence | 4 | docs/diagrams/fig4_05_seq_auto_shift.png | Chapter 4 agent |
| 4.6 | Sequence Diagram: Ticking a Task with a Proof Photo | 4 | docs/diagrams/fig4_06_seq_task_proof.png | Chapter 4 agent |
| 4.7 | Entity Relationship Diagram: Accounts, Communication and Elderly Care | 4 | docs/diagrams/fig4_07_erd_accounts.png | Chapter 4 agent |
| 4.8 | Entity Relationship Diagram: Shifts, Location, Tone and Alerts | 4 | docs/diagrams/fig4_08_erd_shifts.png | Chapter 4 agent |
| 4.9 | Entity Relationship Diagram: Tasks and Proof of Completion | 4 | docs/diagrams/fig4_09_erd_tasks.png | Chapter 4 agent |
| 4.10 | Class Diagram | 4 | docs/diagrams/fig4_10_class.png | Chapter 4 agent |
| 4.11 | Activity Diagram | 4 | docs/diagrams/fig4_11_activity.png | Chapter 4 agent |
| 4.12 | State Diagram: A Day Shift | 4 | docs/diagrams/fig4_12_state_shift.png | Chapter 4 agent |
| 4.13 | State Diagram: An Alert | 4 | docs/diagrams/fig4_13_state_alert.png | Chapter 4 agent |
| 4.14 | Mobile Application Navigation Diagram | 4 | docs/diagrams/fig4_14_navigation.png | Chapter 4 agent |
| 4.15 | Mobile Application Wireframes | 4 | docs/diagrams/fig4_15_wireframe_mobile.png | Chapter 4 agent |
| 4.16 | Web Dashboard Wireframe | 4 | docs/diagrams/fig4_16_wireframe_web.png | Chapter 4 agent |
| 4.17 | System Architecture Diagram | 4 | docs/diagrams/fig4_17_architecture.png | Chapter 4 agent |
| 4.18 | Deployment Diagram | 4 | docs/diagrams/fig4_18_deployment.png | Chapter 4 agent |

Placement, captions and every text change: `docs/diagrams/CHAPTER4_FIGURES.md` (paragraph numbers refer to the current v2 build).

## Requests

- [Ch4 → Ch5] Insert Figures 4.1–4.18 and apply the text in `docs/diagrams/CHAPTER4_FIGURES.md`. The user chose to redraw Figures 4.1–4.5 as built; they replace image4–image8. The old placeholders 4.6, 4.7 and 4.8 become 4.15, 4.16 and 4.17. New subsections: Data Flow Diagrams, State Diagrams, Navigation Diagram, Deployment Diagram. Update the List of Figures. | status: done (Ch5 agent, 2026-11-17): all 18 inserted, 140 pages, List of Figures updated. Two deviations: (1) the Figure 4.13 text says the decision is stored with the alert, not "kept as a label for retraining", because no code uses alert decisions for retraining; (2) "Sequence Diagram" and "Entity Relationship Diagram" headings are now plural.
- [Ch4 → Ch5] Because 4.1–4.5 now show the built system, Chapter 5 should cite the proposal, not those figures, as the approved design. Exact edits: (a) para 470: "The conceptual entities of the entity relationship diagram in Figure 4.3 were kept but refined during development." → "The conceptual entities of the proposed data design were kept but refined during development, and Figures 4.7 to 4.9 show the resulting schema." (b) para 493: "This replaced the two fixed actors in the use case diagram in Figure 4.1, because" → "This replaced the two fixed actors in the proposed design, because" (c) Table 5.12 row 1, col 1: "Two actors, the caregiver and the family sponsor, in Figure 4.1" → "Two actors, the caregiver and the family sponsor, in the proposal". (d) Table 5.12 row 4, col 1: "Sponsor, Caregiver, Patient, Shift, ShiftTask and AnomalyLog entities in Figure 4.3" → "Sponsor, Caregiver, Patient, Shift, ShiftTask and AnomalyLog entities in the proposal". Check any other "Figure 4.x" citations in Chapter 5 against the new numbering. | status: done (Ch5 agent): (a) to (d) applied; no other Figure 4.x citations in Chapter 5.
- [Ch4 → Ch5] FR-02 (para 350) says a caregiver can start a shift "automatically within the geofence or manually". The code removed manual start on 2026-11-12 (commit 2d173fd). Suggested: "...to start a shift automatically when within the geofence, to end it when finished, and to log..." This is requirement text, so the user should approve it. If Chapter 5 says manual start exists anywhere, the same applies there. | status: Chapter 5 part done (Ch5 agent): 5.3.3 now says manual start was removed on 12 Nov 2026, TC-006 expects a manual start to be refused (test_shift_api.py), and Table 5.12 has a new deviation row. FR-02 text: waiting for the user.

## Decisions & conflicts

- (Ch5 agent, 2026-11-17) The report file is `C:\Users\HP\OneDrive - Strathmore University\AlvinKimani_167148_DrEstherKhakata(25)_Chapter5_v2.docx`. The Ch5 agent rebuilds the whole file from the untouched original on every build, so edits made directly in the .docx are lost. Deliver figures as PNG files with a register entry, and text changes as exact before/after text under Requests. The Ch5 agent inserts them.
- (Ch5 agent) The build already puts placeholders in Chapter 4 for Figure 4.6 (Mobile Application Wireframes), Figure 4.7 (Web Dashboard Wireframe) and Figure 4.8 (System Architecture Diagram). It also rewrites the paragraphs before and after Figure 4.8, and adds captions to Figures 4.1 to 4.5.
- (Ch5 agent) Report wording: the roles are "the family", "the caregiver" and "the elderly person" (the code says caretaker). The geofence is 15 m to enter and 20 m to leave. Emergency number 922, with 999 as the second.

- (Ch4 agent, 2026-11-17) The user chose to redraw Figures 4.1–4.5 as built (they previously showed the proposal: DQN, 30 m home geofence, Sponsor/Caregiver/ShiftTask/AnomalyLog, mBERT). Table 5.12 should refer to the proposal for the approved design (see Requests).
- (Ch4 agent) Figures use the report wording (family, caregiver, elderly person) for actors and code names for code elements (CaretakerHome, `caretaker` role value). The wireframe shows 922 as the emergency number, matching the app.
- (Ch4 agent) FR-02 manual start vs code: needs user (see Requests).

- (Testing agent, 2026-11-17) Registered as **Testing agent**. Owns `docs/testing/`; owns no figures. Runs the emulated field test (TC-019) and the simulated usability test (TC-021) and delivers report text only through `docs/testing/REPORT_INSERTS.md` plus one request here. All results will be described as emulated (Android emulators) or simulated (AI-played personas), never as physical phones or real participants. Plan: `docs/testing/TEST_PLAN.md`.
- (Testing agent) Backend choice: needs user. The release APK talks to the Azure pilot, where new accounts must enter an emailed code the agent cannot read; the local backend prints codes to the console. If the local backend is used, `C:\mzb\mobile\src` differs from `mobile/src` in three Tone-tab files (ToneChart.tsx, ToneTab.tsx, theme.ts; mzb is older), so the user must say whether to sync them before the development build.
- (Testing agent) Brief says location sharing works in the foreground only; the code (`mobile/src/location/backgroundTask.ts`) and Section 5.5.3 (p679) say it continues in the background through an Android foreground service, with a foreground-only fallback (e.g. Expo Go). Tests keep both apps in the foreground either way. Which statement is right for the report: needs user.

## Requests (Ch5 → Ch4)

- [Ch5 → Ch4] fig4_13_state_alert.png: both end arrows say "kept as a label for retraining". The code does not use alert decisions for retraining; Alert only stores status. Please change them to something like "decision kept with the alert" and re-export. Also, "raised:" lists sos, unwell, vocal_distress and geofence, but Alert.kind also has missed_chore and short_visit; add them or say "e.g.". After that, tell me and I will rebuild. | status: done (Ch4 agent, 2026-11-17). Both end arrows now say "decision kept with the alert". The entry label says "raised by the system: sos, unwell, vocal_distress or geofence", with a note that missed_chore and short_visit are defined in Alert.Kind but only seed_demo and tests create them (checked: no live code path raises them). PNG and SVG re-exported under the same names.

## Lock

free
