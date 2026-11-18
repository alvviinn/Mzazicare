# Report inserts from the Automation agent

For the Chapter 5 agent. Each item is exact before/after text for the v2 report (paragraph numbers as in the current build). Evidence is in `docs/testing/automation/results/`. Section E (browsers) is still **PENDING**: no browser check of the dashboard was run.

## A. Automated suite counts and run date (Step 2)

Evidence: `results/2026-11-17_1744_test_ps1.txt` (full `scripts/test.ps1` at commit 9ef3baa, application code unchanged from the commit, exit 0, all checks passed, 1,500 s), plus verbose single-suite runs `results/2026-11-17_1741_*` (Django check, migration check, backend 208 OK, tone model 34 OK, first-aid 20 OK, mobile and web type checks OK). An earlier run the same day on a working tree with uncommitted changes (`results/2026-11-17_1206_test_ps1.txt`) gave the same counts. Python 3.14.0 on the development laptop.

A1. Abstract (p36)
- Before: `and all 204 automated backend tests passed.`
- After: `and all 208 automated backend tests passed.`

A2. p628
- Before: `The automated suite contained 204 backend tests, 34 tests for the tone model pipeline and 20 tests for the first-aid guide, its safety check, its safety policy and the word list.`
- After: `The automated suite contained 208 backend tests, 34 tests for the tone model pipeline and 20 tests for the first-aid guide, its safety check, its safety policy and the word list.`
- Before: `and in the final run on 16 November 2026 all 204 backend tests and all 54 machine learning tests passed.`
- After: `and in the final run on 17 November 2026 all 208 backend tests and all 54 machine learning tests passed, together with the secret scan, the migration check and the TypeScript checks of the mobile app and the dashboard, as Figure 5.29 shows.`

A3. p634 (image placeholder). Replace the placeholder text with the image `docs/testing/automation/figures/fig5_29_test_run.png`.
- Before: `[INSERT IMAGE: Screenshot of the terminal output of the automated test run showing all 204 backend tests, the 34 tone model tests and the 20 first-aid tests passing]`
- After: (the image)

A4. p635 caption and the List of Figures entry (p90)
- Before: `Figure 5.29 Output of the automated test run on 16 November 2026`
- After: `Figure 5.29 Output of the automated test run on 17 November 2026`
- Add one sentence after the figure (new paragraph, before the next heading): `The figure is drawn from the saved output of the run; long runs of per-test lines are shortened and marked as omitted, and no line was retyped.`

A5. Table 5.20, objective 6, column "Observed result"
- Before: `204 of 204 backend tests passed;`
- After: `208 of 208 backend tests passed;`

A6. p700 (Chapter 6, 6.1)
- Before: `All ten functional requirements were implemented, and the 204 backend tests, the 34 tone model tests and the 20 first-aid tests all passed.`
- After: `All ten functional requirements were implemented, and the 208 backend tests, the 34 tone model tests and the 20 first-aid tests all passed.`

## B. Continuous integration (Step 3, TC-022)

Evidence: `results/ci_run.json` (public GitHub API, read on 17 November 2026), `results/2026-11-17_1246_ci_ml_job_repro.txt` (cause reproduced locally) and `results/2026-11-17_*_ci_fix_check_clean_copy.txt`.

Facts: every run on main failed from 29 October 2026 (commit b653e08, which added the comparison of the SVM, random forest and BiLSTM models) to run 44052919547 on 17 November 2026. In each, the Backend, Mobile and Secret scan jobs passed and the ML job failed at its unit-test step. The last success before that was run 40591038452 on 27 October 2026. Cause, reproduced locally by blocking the packages CI does not install: the new tone test file imports PyTorch and the comparison code imports scikit-learn, but the ML job installed only NumPy, SciPy, SoundFile and ONNX Runtime. Commit 979f2aa on 17 November 2026 added both packages to the job. Run 44059739866 then passed, and the latest run on main, **44060828045 on 17 November 2026 (commit 9ef3baa), passed all four jobs**: Backend (Django), ML, Mobile (TypeScript) and Secret scan.

Not yet on GitHub: a further local change to `ci.yml` (pandas, a first-aid test step and a dashboard type-check job) is not committed. The text below describes what has actually run. If the author pushes that change and its run passes, use the variants marked "if pushed"; the agent will supply the run number.

B1. Table 5.14, TC-022, column "Actual result, evidence and verdict"
- Before: `[INSERT CI RUN REFERENCE AND VERDICT]`
- After: `GitHub Actions run 44060828045 on 17 November 2026 (commit 9ef3baa): Backend, ML, Mobile and Secret scan jobs all passed. The ML job had failed from 29 October 2026 until the fix of D-11. Pass`
- Also in TC-022, column "Scenario, data and conditions". Before: `TypeScript type checks, migration check and secret scan in GitHub Actions`. After: `Django system check, migration check, backend tests, tone model tests, TypeScript type check of the mobile app and secret scan in GitHub Actions`

B2. Table 5.15, new last row (after D-10)
- `D-11 | Continuous integration, 29 October to 17 November 2026 | The ML job of the GitHub Actions workflow failed on every push to main, although the same tests passed locally | A tone model test added on 29 October imports PyTorch and the comparison code imports scikit-learn, but the CI job did not install them | Both packages added to the CI job, with PyTorch from its CPU-only index | Run 44059739866 and the latest run 44060828045 passed all four jobs; Pass`

B3. p685
- Before: `Every push to main triggers a GitHub Actions workflow with four jobs, shown in Figure 5.34: the Django system check, the migration check and the backend tests; the tone model tests; the TypeScript type check of the mobile app; and a secret scan.`
- After: `Every push to main triggers a GitHub Actions workflow with four jobs, shown in Figure 5.34: the Django system check, the migration check and the backend tests; the tone model tests; the TypeScript type check of the mobile app; and a secret scan. From 29 October to 17 November 2026 the tone model job failed on every push because the CI environment lacked two packages that a new test needed, while the same tests passed locally; this was recorded as D-11 and fixed, and the latest run passed all four jobs. The first-aid tests and the type check of the dashboard run in the local test script but not yet in CI.`
- After (if pushed and green): `Every push to main triggers a GitHub Actions workflow with five jobs, shown in Figure 5.34: the Django system check, the migration check and the backend tests; the tone model and first-aid tests; the TypeScript type check of the mobile app; the TypeScript type check of the dashboard; and a secret scan. From 29 October to 17 November 2026 the tone model job failed on every push because the CI environment lacked two packages that a new test needed, while the same tests passed locally; this was recorded as D-11 and fixed.`

B4. Figure 5.34 (p692 placeholder, caption p693). Screenshot of https://github.com/alvviinn/Mzazicare/actions/runs/44060828045 (or the "if pushed" run). Caption unchanged: `Figure 5.34 Continuous integration run on GitHub Actions`.

## C. Response times (TC-018, Table 5.21, Table 5.13 tool)

Evidence: `results/2026-11-18_0749_perf.csv` (every call), `results/measure_console.txt`, script `perf/pilot.py` (`measure`). Run on 18 November 2026, 07:49–07:56 EAT, from the development laptop (Python `requests`) over Safaricom home fibre (Wi-Fi) to the Azure pilot, one request at a time with a 2 s pause. 5 warm-up calls (not counted) then 10 measured calls per operation (10 instead of the planned 30, author's choice to save time). With 10 calls the 95th percentile (nearest rank) equals the slowest call. Test accounts Auto Family 1, Auto Caregiver 1 and Auto Elder 1 on the pilot; locations at a synthetic point in Karura Forest; a synthetic 10 s AAC clip and a 450 KB JPEG.

C1. Table 5.13, tool for response times (p1222)
- Before: `[INSERT TOOL USED TO MEASURE RESPONSE TIMES] against the Azure pilot`
- After: `A Python script (requests library) that timed each call from the laptop, against the Azure pilot`

C2. Table 5.21, one row per operation. Conditions cell for every row:
- Before: `[INSERT DEVICE AND NETWORK]`
- After: `Laptop over Safaricom home fibre (Wi-Fi), 18 Nov 2026`

| Row | Repetitions (Before `[INSERT]`) | Median | 95th percentile | Target and verdict (Before `2 s; [INSERT VERDICT]`) |
|---|---|---|---|---|
| Sign in | `10 after 5 warm-up; 3 succeeded, 7 refused by the email service` | `5.5 s` | `7.4 s` | `2 s; not met` |
| Load the family overview | `10 after 5 warm-up` | `0.95 s` | `1.73 s` | `2 s; met` |
| Report a location and update the shift | `10 after 5 warm-up` | `0.85 s` | `0.95 s` | `2 s; met` |
| Tick a task with a photograph | `10 after 5 warm-up` | `1.17 s` | `1.37 s` | `2 s; met` |
| Analyse a 10-second audio clip | `10 after 5 warm-up` | `1.18 s` | `1.53 s` | `2 s; met` |

C3. Table 5.14, TC-018, "Actual result, evidence and verdict" (p1333)
- Before: `[INSERT MEASURED RESULT AND VERDICT]`
- After: `Four of five operations within 2 s at the median and the 95th percentile (0.85 to 1.18 s median); sign in took 5.5 s median because the code email is sent before the server replies. Partly passed`

C4. p1689, first placeholder (the field-test sentence after it is the Testing agent's item G3)
- Before: `[INSERT A SHORT INTERPRETATION OF THE RESPONSE TIMES, FOR EXAMPLE WHETHER ANY OPERATION EXCEEDED 2 SECONDS AND WHY.]`
- After: `Four of the five operations stayed within the 2-second target, with medians between 0.85 and 1.18 seconds, including the photo upload and the tone analysis of a 10-second clip. Sign in did not: its median was 5.5 seconds because the server sends the email with the code before it replies, and after eight codes in a few minutes the email service refused further messages, so seven of the ten measured sign-ins returned an error. Sending the email in the background and limiting how often codes can be requested would address both. Only ten calls per operation were timed, from one laptop on one home fibre connection, so the figures describe this setting rather than every network.`

## D. Security checklist (TC-020)

Evidence: `results/2026-11-18_0757_security.json`, script `perf/pilot.py` (`security`), 18 November 2026, about 12 requests.

| Check | Result |
|---|---|
| HTTP request redirected to HTTPS | Pass (301 to https) |
| HSTS header on API responses | **Fail** (header missing) |
| Debug output off (unknown URL) | Pass (plain 404, no debug page) |
| Request from an unknown origin (CORS preflight) | Pass (origin not allowed) |
| No token / invalid token | Pass (401 / 401) |
| Another family's shift requested by its ID | Pass (404) |
| Elderly account reading task lists | Pass (403) |
| Django admin | Pass (redirects to its login page; not open) |
| Wrong password | Pass (generic "Incorrect email or password.") |

D1. Table 5.14, TC-020, "Actual result, evidence and verdict" (p1343)
- Before: `[INSERT SECURITY CHECK RESULT AND VERDICT]`
- After: `HTTP redirected to HTTPS; no debug output; unknown origin refused; another family's shift returned 404; no or invalid token 401; admin behind its login. One medium finding: the API sends no HSTS header. No high-severity finding; Pass`

D2. Table 5.15, new row (if the author agrees; not fixed by this agent): `D-14 | Security check of the pilot, 18 November 2026 | The API did not send a Strict-Transport-Security (HSTS) header | The HSTS setting is not enabled in the production settings | Open | –`

## E. Browsers tested (p471, Table 5.1): **PENDING** (needs the browser used for the dashboard checks)

## F. Performance parts of Table 5.20 objective 6 and p1733

F1. Table 5.20, objective 6 (p1728): in the Testing agent's item I1 text, replace its `[INSERT PERFORMANCE RESULTS]` with: `four of five operations within 2 s on the pilot (sign in 5.5 s)`

F2. p1733: in the Testing agent's item I2 text, replace its `[INSERT ONE SENTENCE ON THE PERFORMANCE RESULTS.]` with: `On the pilot, four of the five main operations answered within 2 seconds, but sign in took about 5.5 seconds because it waits for the code email.`
