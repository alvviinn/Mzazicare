# MzaziCare: Emulated Field Test and Simulated Usability Test, Test Plan

Owner: Testing agent. Status: **approved by the author on 2026-11-17 with these decisions:** local backend (option B); location sharing continues in the background (Android foreground service), so the report keeps that wording; tests still keep both apps in the foreground.

**Setup as executed (2026-11-17):**
- Backend: local Django runserver on `127.0.0.1:8000` (reached from the emulators as `10.0.2.2:8000`), DEBUG on, no email service, so sign-in codes go to the console log `docs/testing/logs/backend.log`. Fresh test data: the app's database role cannot create databases, so a new empty schema `fieldtest_20261117` was created inside the local `mzazicare` database and selected with the libpq variable `PGOPTIONS=-c search_path=fieldtest_20261117`. All 27 tables were migrated into it; the development data in `public` is untouched. No file under `backend/` was edited.
- App: debug build of `C:\mzb\mobile` for x86_64 (`-PreactNativeArchitectures=x86_64` on the Gradle command line; JDK 17 from Android Studio via `JAVA_HOME`), JavaScript served by Metro. `.env.local` temporarily set to `http://10.0.2.2:8000`; the original value is saved and will be restored.
- mzb vs repository: built **as it is**. The three differing files only affect the family Tone tab, which no test task uses; recorded as a deviation.
- Site coordinates: moved from the Arboretum to a point well inside **Karura Forest** (a public forest reserve), because the Arboretum is too small for a 200 m route that stays clear of homes.
- One caregiver account per field-test run (a shift is one per caregiver per day, and a same-day return continues it), all in Test Family 1's circle with Test Elder 1.
Report targets: TC-019 and TC-021 in Table 5.14, Table 5.13 (usability row), Section 5.4.4 (paras p660 and p661), Table 5.20 (objective 6), Section 5.5.1 (p670), Section 5.5.3 (p682) and Chapter 6 (p700, p704).

All testing in this plan is **emulated** (Android emulators on the development laptop) or **simulated** (personas played by an AI agent). No physical phone, real home or real participant is involved, and the report text will say so.

## 1. Rules under test (read from the code, 17 November 2026)

| Rule | Value | Source |
|---|---|---|
| Enter the geofence | caregiver within 15 m of the elderly person's phone | `presence.py` ENTER_RADIUS_M |
| Leave the geofence (once inside) | beyond 20 m | EXIT_RADIUS_M |
| Fix too old | over 120 s, ignored | FRESH_S |
| Fix too inaccurate | worse than 40 m, ignored | MAX_ACCURACY_M |
| No usable fix | after 180 s a break starts at the last time in range | STALE_PAUSE_S |
| Short absence | back within 120 s: same segment, not a break | MERGE_GAP_S |
| Long break | after 90 min the phase reads `away` | AWAY_AFTER_MIN |
| Mocked fix | ignored for presence, raises a fake-location alert | `presence.measure`, `caretaker_views.py` |
| Fix interval | 15 s from each phone (never more often than 10 s) | `backgroundTask.ts` FIX_EVERY_MS, MIN_GAP_MS |

A shift is re-evaluated on every fix from either phone. A break's start is stamped at the **last evaluation in range**, so it is recorded slightly *before* the caregiver actually crosses 20 m. Arrival and return are stamped at the **first evaluation inside 15 m**, so they are recorded slightly *after* the crossing.

**Tolerance (derived):** one fix interval (15 s) plus 5 s for network and processing = **20 s** per event.
- Arrival and return: recorded − planned in **[0 s, +20 s]**.
- Break start and departure: recorded − planned in **[−20 s, 0 s]**.
- Worked time per run: planned 30 min, pass if within **±40 s** (two segments, two edges each). Break time: 10 min ± 40 s.
- "Planned" means the second the scripted position first crosses the 15 m (entering) or 20 m (leaving) boundary.

## 2. Backend and build: **needs your decision**

| Option | Status |
|---|---|
| A. Release APK against the Azure pilot (preferred) | **Blocked for new test accounts.** New accounts always need the emailed six-digit code (`two_factor_required=True`), and the pilot sends it through Azure email. I cannot read an inbox for "Test Family 1" etc. It would work only if you give me test inboxes I can read, or sign in each account yourself once. The APK is ARM-only (armeabi-v7a, arm64-v8a); it should run on the x86_64 images through Android's ARM translation, but this is unconfirmed. |
| B. Local backend + development build (fallback) | Works without email: with DEBUG on and no email service, codes go to the backend console, which I read. Fresh PostgreSQL test database. Development build from `C:\mzb\mobile`, `EXPO_PUBLIC_API_URL` set to `http://10.0.2.2:8000` and restored afterwards. |

**Check required by the brief: `C:\mzb\mobile\src` does not match `mobile/src`.** Three files differ, all on the family Tone tab: `components/ToneChart.tsx`, `screens/user/ToneTab.tsx`, `theme.ts`. The repository copies are newer (16 Nov) than the mzb copies (12 Nov). No location, shift, task, sign-in or elderly-screen file differs, so neither test is affected, but the Tone tab a persona sees would be the older one. I will not continue with option B until you say whether to (i) copy the three repository files into `C:\mzb\mobile\src` first, or (ii) build mzb as it is and record the difference.

## 3. Emulated devices

Emulator 37.2.12, WHPX acceleration. System images: Android 16 (API 36, Google Play, x86_64) was installed; Android 12 (API 31, Google APIs, x86_64) is being downloaded through the SDK Manager. Values from official/manufacturer specification pages; the density is the emulator density bucket nearest to the physical ppi.

| AVD name | Screen | Resolution | Density | Android | RAM in emulator |
|---|---|---|---|---|---|
| Emulated Galaxy A04 | 6.5 in | 720 × 1600 | 280 (phys. 270 ppi) | 12 (API 31) | 3 GB (lowest variant) |
| Emulated Galaxy A13 | 6.6 in | 1080 × 2408 | 400 (phys. 400 ppi) | 12 (API 31) | 3 GB (lowest variant) |
| Emulated Pixel 10 | 6.3 in | 1080 × 2424 | 420 (phys. 422 ppi) | 16 (API 36) | **4 GB, not 12 GB** |

Deviations to state in the report: x86_64 images, not the phones' ARM chips, so the 32-bit ARM install defect (D-04) cannot be reproduced; no One UI skin or Samsung battery saving; the Pixel 10 profile gets 4 GB because two emulators must run together on a 16 GB laptop; GPS positions are injected, not received from satellites, so real GPS error near walls is not tested.

## 4. Test accounts

Created through the app's own Register screen, then linked through the family's People tab, as a family would: Test Family 1 (`user`), Test Caregiver 1 (`caretaker`), Test Elder 1 (`elderly`). Emails on a reserved test domain (`@example.com`). Further accounts (Test Family 2, …) only if a persona needs a clean start.

## 5. Field test (TC-019, emulated)

**Site model.** A standalone house in a Nairobi residential estate, modelled on coordinates inside a public green space (Nairobi Arboretum area), so no real home is used. The elderly person's phone (Emulated Galaxy A04) is fixed at the house point H. Points: gate G 30 m from H; road R about 60 m; start S about 200 m; shop K about 150 m.

**Check first:** whether `emu geo fix` positions arrive with `mocked: true`. If yes: try the emulator's own location playback (GPX/KML); if that is also flagged, **stop and report to you**. No code changes. A scripted client posting to `/api/location/` only with your approval, reported as an API-level simulation.

**Timed scenario (each main run, about 45 min):** S → R → G (walking pace, a fix every 5 s) → arrive at H, stay 15 min → walk to K, 10 min break → return to H, stay 15 min → walk out to R and beyond → tap End. The script logs the planned second of every boundary crossing.

**Runs:** caregiver on A13, on A04 (second A04 instance), on Pixel 10; elderly person always on A04. Edge runs: (E1) standing 17–19 m away after arriving for 5 min, expected stays `active`; (E2) out beyond 20 m for 90 s, expected no break; (E3) fixes with accuracy 60 m, expected ignored (and after 180 s a break, per STALE_PAUSE_S). Note: `geo fix` does not set accuracy, so E3 needs the emulator's GNSS/accuracy control; if accuracy cannot be set, E3 is reported as not executable.

**Recorded per event:** planned time, recorded time (shift timeline in the app and read-only `GET /api/shift/state/` and the shift detail), difference in seconds, pass/fail. Both apps stay in the foreground with location on.

Output: `docs/testing/field_test/` (scripts, raw logs, screenshots, `RESULTS.md`).

## 6. Usability test (TC-021, simulated personas)

Eight personas, each with name, age, role, phone profile, language, tech confidence and context; written in `docs/testing/usability/PERSONAS.md` before any session.
- Family (3): son working in the UK; daughter in Nairobi with a busy job; a less tech-confident sibling.
- Caregiver (3): experienced, basic Android phone, prefers Kiswahili; young and comfortable with apps; first-time smartphone user.
- Elderly person (2): 74, weak eyesight, reads Kiswahili; 81, rarely uses a phone.

**Tasks** (same per role): Family: sign in with code; add caregiver and elderly person by email; add a task; open today's shift and read its timeline; confirm or dismiss an alert; send a chat message. Caregiver: sign in; allow location, see the shift start on Today; tick a task with a proof photo; check Hours; ask First aid about a fall. Elderly person: switch to Kiswahili if preferred; check whether the caregiver is here; record how they feel; mark a medicine taken; message the family; find the emergency button, open it and cancel (no real call).

**Method.** The agent operates the emulator through adb (screencap, uiautomator dump, input). Each action is chosen from what is on the screen only. Personas may make plausible mistakes and give up. Limits per persona: a task is "failed" after 3 wrong paths or 5 minutes. "With help" means the persona would need to ask someone (recorded, then the moderator hint is applied). Per task: outcome, time, errors, hesitation points, screenshots. Then each persona completes the 10-item SUS (Brooke, 1996) in character; scored the standard way.

**Honesty limit:** simulated personas estimate likely problems; they are not participants and the SUS scores are not a measured user sample. The report will call them simulated, and TC-021's verdict will say so.

Output: `docs/testing/usability/` (personas, session logs, screenshots, `SUS.md`, `RESULTS.md`).

## 7. Deliverables and coordination

- Report changes as exact before/after text in `docs/testing/REPORT_INSERTS.md`, with one request to the Chapter 5 agent in `docs/AGENT_SYNC.md`.
- Every number comes from a logged run. Anything needing your decision goes to AGENT_SYNC under "Decisions & conflicts" as "needs user".
