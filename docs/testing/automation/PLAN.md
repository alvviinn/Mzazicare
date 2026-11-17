# Automation agent: plan

Owner: Automation agent. Folder: `docs/testing/automation/` (only new files here; no existing code, test, script, setting or workflow is changed).
Status: Steps 2 and 3 (local and read-only) are running. **Nothing touches the Azure pilot until the author approves this plan** and provides the inputs in Section 6.

## 1. Report gaps targeted

| Gap | Where in the report |
|---|---|
| Test counts 204 / 34 / 20, final run date 16 Nov 2026 | p628, p700, Table 5.20 obj. 6, Figure 5.29 caption |
| Figure 5.29 (terminal output of the automated run) | p634 placeholder |
| TC-022 CI result | Table 5.14; p685 (CI description); Figure 5.34 placeholder |
| TC-018 and Table 5.19 response times; Table 5.13 tool | Table 5.19, p660 first sentence, Table 5.13 Performance row |
| TC-020 security checklist | Table 5.14 |
| Browsers tested | p471, Table 5.1 |
| Performance parts of Table 5.20 obj. 6, p670 and p700 | fitted around the Testing agent's usability and field text |

## 2. Existing suite (Step 2): local only

- `scripts/test.ps1` once in full, then each suite separately with verbose output: backend (`manage.py test --settings=config.settings_test -v 2`), tone model (`unittest discover -s voice/tests -v`), first-aid (`unittest discover -s firstaid/tests -v`), mobile `tsc --noEmit`, web `tsc --noEmit`, secret scan. Outputs are saved with a timestamp in `results/`.
- Counts are compared with 204 / 34 / 20. Any difference gets before/after text for every place the report states it.
- Figure 5.29 is rendered from the saved transcript as a terminal-style PNG (`render_terminal.py` reads the file and draws its text; nothing is retyped).
- A failing existing test is recorded as a defect, not fixed.

## 3. CI evidence (Step 3): read-only

`gh` is not signed in. The repository is public, so the GitHub REST API is read without a login (no write calls). Findings so far:
- The latest run on main (44048080880, commit 34f53e8, 17 Nov 2026) **failed**. Backend, Mobile and Secret scan passed; **ML failed** at `python -m unittest discover -s voice/tests`.
- Every run on main since 29 Oct 2026 (commit b653e08, which added `ml/voice/tests/test_compare.py`) has failed. The last success was run 40591038452 on 27 Oct 2026 (commit 53e6c93).
- Probable cause: `test_compare.py` imports `torch` at module level, and `voice.compare` imports `sklearn`. CI installs only `numpy scipy soundfile onnxruntime`. To be confirmed locally by running the voice tests with those two imports blocked (no installs, no file changes).
- Consequence: TC-022 cannot be marked Pass, and Figure 5.34 ("successful GitHub Actions run") has no recent successful run to show. Both go to the author as "needs user", with the exact CI lines.
- Screenshots: the browser tool can capture the public repository home, the commit history and the Actions page. The failing run is shown as it is.

## 4. Response times (Step 4, TC-018): pilot, after approval

Script: `perf/measure_response_times.py`, using `requests`. Endpoints and payloads are copied from `mobile/src/api/client.ts` and `backend/*/urls.py`:

| Operation | Call | Precondition |
|---|---|---|
| Sign in | `POST /api/auth/login/` (password step) | **see 6c**: each call emails a code |
| Load the family overview | `GET /api/dashboard/` (family token) | linked circle exists |
| Report a location and update the shift | `POST /api/location/` (caregiver) `{latitude, longitude, accuracy, mocked:false}` | elderly person's location posted within 15 m less than 2 min before |
| Tick a task with a photograph | `POST /api/tasks/<id>/done/` multipart, JPEG about 200 KB | in range; one fresh one-off task per repetition (created by the family beforehand, not timed) |
| Analyse a 10-second audio clip | `POST /api/audio/tone/` (body as `sendAudioClip` sends it) | verified shift, both consents given; synthetic clip |

5 warm-up calls (reported separately because of D-09 cold starts), then 30 measured calls, strictly one at a time with a 2 s pause. That is about 175 calls, roughly 15 minutes. No load or stress. Median and 95th percentile (nearest-rank) per operation, verdict against 2 s. Timing is client-side wall time (`time.perf_counter`) around each request. Raw timings go in `results/perf_<timestamp>.csv`.

Pilot test data: **Auto Family 1** (family), **Auto Caregiver 1**, **Auto Elder 1**, using plus-addresses of the author's email. Order: register the family (code 1), the family adds the other two emails with `POST /api/team/`, then register the caregiver (code 2) and the elderly person (code 3). Tokens last 90 days, so three codes in all. Tokens are held in memory or in `docs/testing/automation/.secrets/` (git-ignored by a `.gitignore` inside that folder) and are never printed. Locations use a synthetic point inside Karura Forest (a public reserve), 5 m apart. This leaves a test shift, 35 tasks, 35 tone results (no audio is stored) and possibly test alerts on the pilot under the Auto accounts.

## 5. Security checklist (Step 5, TC-020): pilot, after approval

`security/check_pilot_security.py`, about 10 requests in all: HTTP to HTTPS redirect; HSTS header; `DEBUG` off (a 404 page shows no Django debug output); CORS preflight from an unknown origin is refused; another family's record by ID returns 403 or 404 (needs a second family, **Auto Family 2**: one more code); no token gives 401; admin page not exposed or protected. (The brief is cut off at Step 5; anything it adds will be included.)

## 6. Needed from the author before the pilot steps

a. The base email address for the plus-addresses, e.g. `name+autofam1@gmail.com`.
b. The network for the conditions column (provider and type, e.g. Safaricom home fibre over Wi-Fi). Note: during this session the line ran at about 120 KB/s and dropped long downloads; the script logs this.
c. Sign-in timing: each `POST /api/auth/login/` for a two-step account sends a code email, so 35 calls means 35 emails. Options: (i) accept them, sent to a dedicated plus-address you can filter (this measures the real first step, including the email send); or (ii) time it with fewer repetitions (e.g. 5 + 10) and say so in Table 5.19.
d. Approval to create the Auto accounts and test data on the pilot.

## 7. Delivery

Report text goes to `REPORT_INSERTS.md` as exact before/after text, with one Request to the Chapter 5 agent. CI and script changes go to AGENT_SYNC "Decisions & conflicts" as "needs user". Figures are registered as 5.x (provisional).
