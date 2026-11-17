# Report inserts from the Automation agent

For the Chapter 5 agent. Each item is exact before/after text for the v2 report (paragraph numbers as in the current build). Evidence is in `docs/testing/automation/results/`. Items marked **PENDING** need runs on the Azure pilot that the author has not yet approved; they will be filled in later in this file.

## A. Automated suite counts and run date (Step 2)

Evidence: `results/2026-11-17_1206_test_ps1.txt` (full `scripts/test.ps1`, exit 0, all checks passed), plus verbose single-suite runs `results/2026-11-17_1237_backend_tests_v2.txt` (208 OK), `results/2026-11-17_1240_ml_voice_tests_v.txt` (34 OK) and `results/2026-11-17_1240_ml_firstaid_tests_v.txt` (20 OK). Run on the development laptop, Python 3.14.0, working tree at commit 34f53e8 with uncommitted changes.

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

Evidence: `results/ci_run.json` (public GitHub API, read on 17 November 2026) and `results/2026-11-17_1246_ci_ml_job_repro.txt`.

Facts: the latest run on main, run 44052919547 on 17 November 2026 (commit eb0e01c), failed. The Backend, Mobile and Secret scan jobs passed, and the ML job failed at its unit-test step. Every run on main has failed in the same way since 29 October 2026 (commit b653e08, which added the comparison of the SVM, random forest and BiLSTM models). The last successful run was 40591038452 on 27 October 2026. Cause, reproduced locally by blocking the packages that CI does not install: the new tone test file imports PyTorch, and the comparison code imports scikit-learn, but the ML job installs only NumPy, SciPy, SoundFile and ONNX Runtime. All 34 tone tests pass once those two packages are present. CI also does not run the first-aid tests or the dashboard type check, which `scripts/test.ps1` runs. The fix to `.github/workflows/ci.yml` is recorded in AGENT_SYNC.md as "needs user".

B1. Table 5.14, TC-022, column "Actual result, evidence and verdict" (**use this unless the author applies the CI fix first**)
- Before: `[INSERT CI RUN REFERENCE AND VERDICT]`
- After: `Run 44052919547 on 17 November 2026 (commit eb0e01c): Backend, Mobile and Secret scan passed; ML failed because CI does not install PyTorch and scikit-learn, which a tone model test added on 29 October 2026 needs (D-11). The same tests pass locally. Fail`
- If the author applies the CI change and a run passes, the agent will supply the new run number and `Pass` instead.

B2. Table 5.15, new last row (after D-10)
- `D-11 | Continuous integration, 29 October 2026 onwards (found 17 November 2026) | The ML job of the GitHub Actions workflow failed on every push to main | A new tone model test imports PyTorch and the comparison code imports scikit-learn, but the CI job installs neither; the first-aid tests, which need pandas, were not run in CI at all | [CHOOSE: "Packages added to the CI job, and the first-aid tests and the dashboard type check added to the workflow" if the author applies the fix; otherwise "Not yet corrected; the change to the workflow is recorded"] | [CHOOSE: the new run number and "Pass", or "Open: the same tests pass locally"]`

B3. p685
- Before: `Every push to main triggers a GitHub Actions workflow with four jobs, shown in Figure 5.34: the Django system check, the migration check and the backend tests; the tone model tests; the TypeScript type check of the mobile app; and a secret scan.`
- After (if CI is not fixed): `Every push to main triggers a GitHub Actions workflow with four jobs, shown in Figure 5.34: the Django system check, the migration check and the backend tests; the tone model tests; the TypeScript type check of the mobile app; and a secret scan. From 29 October 2026 the tone model job failed on every push because the CI environment lacked two packages that a new test needed (D-11), while the same tests passed locally; the first-aid tests and the dashboard type check ran only locally, through the test script.`
- After (if CI is fixed and passes): `Every push to main triggers a GitHub Actions workflow with five jobs, shown in Figure 5.34: the Django system check, the migration check and the backend tests; the tone model and first-aid tests; the TypeScript type check of the mobile app; the TypeScript type check of the dashboard; and a secret scan. Between 29 October and [DATE] the tone model job failed because the CI environment lacked two packages that a new test needed (D-11).`

B4. Figure 5.34 caption (p693 and List of Figures p95). There is no successful run since 27 October 2026.
- If CI is not fixed. Before: `Figure 5.34 Continuous integration run on GitHub Actions`. After: `Figure 5.34 Continuous integration run on GitHub Actions on 17 November 2026, with the ML job failing (D-11)`
- If CI is fixed: caption unchanged; screenshot of the new successful run.

## C. Response times (TC-018, Table 5.19, Table 5.13 tool, p660 first sentence): **PENDING**

## D. Security checklist (TC-020): **PENDING**

## E. Browsers tested (p471, Table 5.1): **PENDING** (needs the browser used for the dashboard checks)

## F. Performance parts of Table 5.20 objective 6, p670 and p700: **PENDING** (written to fit around the Testing agent's usability and field text)
