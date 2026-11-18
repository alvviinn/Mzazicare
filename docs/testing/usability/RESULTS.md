# TC-021 Simulated usability test: results

Testing agent, 18 November 2026, 00:13–01:14 EAT. Personas in `PERSONAS.md` (written before any session); one file per session in `sessions/`; every action and marker in `../logs/ui_actions.log`; screenshots in `screens/`.

**What this is and is not.** Eight **simulated personas** played by an AI agent, which operated an **emulated** Galaxy A13 (Android 12) through adb and chose each action from what was on the screen. They are not real participants, the SUS scores are the agent's in-character estimates, not a measured user sample, and the times include the agent's adb round trips. The results point to likely problems; they do not measure real users' satisfaction. The agent also knew the app from setting up the tests, a bias it limited by acting only on visible labels.

## Task outcomes

| Persona (simulated) | Role | Tasks attempted | Success | Success with help | Failed | Not run | Errors / wrong paths |
|---|---|---|---|---|---|---|---|
| C1 "Mama Akinyi" | Caregiver | 5 | 5 | 0 | 0 | 0 | 0 |
| C2 "Kevin" | Caregiver | 5 | 5 | 0 | 0 | 0 | 0 |
| C3 "Naliaka" | Caregiver | 5 | 4 | 0 | 1 (T2 location) | 0 | 3 errors, 3 wrong paths |
| F1 "Brian" | Family | 6 | 6 | 0 | 0 | 0 | 0 |
| F2 "Wanjiru" | Family | 5 | 4 | 0 | 1 (T2 invite role) | 1 (T5, no open alert) | 1 error |
| F3 "Otieno" | Family | 5 | 5 | 0 | 0 | 1 (T5, no open alert) | 0 |
| E1 "Mzee Kamau" | Elderly person | 6 | 6 | 0 | 0 | 0 | 0 |
| E2 "Cucu Wairimu" | Elderly person | 5 | 4 | 1 (T1 language) | 0 | 1 (T4, medicine already taken in E1) | 0 |
| **Total** | | **42** | **39** | **1** | **2** | **3** | |

Task completion: 40 of 42 attempted tasks completed (95.2 %), 39 of 42 without help (92.9 %). Three tasks were not run because the shared test data had been used by an earlier session (one alert, one medicine reminder).

## SUS (Brooke, 1996), answered in character

| Persona | Role | SUS |
|---|---|---|
| C1 | Caregiver | 65.0 |
| C2 | Caregiver | 87.5 |
| C3 | Caregiver | 42.5 |
| F1 | Family | 80.0 |
| F2 | Family | 77.5 |
| F3 | Family | 62.5 |
| E1 | Elderly person | 62.5 |
| E2 | Elderly person | 37.5 |
| **Mean (8)** | | **64.4** |
| Mean by role | | Family 73.3; caregivers 65.0; elderly people 50.0 |

The mean of 64.4 is below the target of 68 set in Table 5.13. Scores follow the personas' confidence: the two least confident (C3 and E2) scored lowest, and both hit a real problem (C3) or needed help (E2).

## Findings (ordered by likely effect)

| ID | Finding | Seen in | Effect |
|---|---|---|---|
| U-1 | If location is refused at the first prompt, turning it on later in the phone's Settings does not help: the caregiver's screen keeps "Location off" and sends nothing until the app is fully restarted or the caregiver signs out and in. `mobile/src/location/useLocationSharing.ts` asks once when the screen loads and never checks again. The "Location off · turn on in Settings" line is plain text, not a button. | C3 (failed T2) | High for new smartphone users: the visit is not verified and the caregiver's hours are not counted, without an explanation. |
| U-2 | Adding a person defaults to "Caretaker"; an elderly person added without changing it is invited as a caregiver. On the People screen a pending person shows only "Invited" (the role is visible only in the account sheet's Care circle list), and a pending invite cannot be opened, changed or cancelled. | F2 (failed T2) | Medium: the elderly person's phone would join with the wrong role. |
| U-3 | Language: there is no language choice before signing in; on the elderly person's home the only control is an unlabelled "AA" circle (text size and language together). | C1, E1 (hesitation), E2 (needed help) | Medium for Kiswahili readers. |
| U-4 | Kiswahili is incomplete: the caregiver's tab bar and the chat screen stay in English when Kiswahili is chosen. | C1, E1 | Low. |
| U-5 | At the largest text size the red "Nahitaji msaada / I need help" button sits half behind Android's navigation bar (still tappable). | E1 | Low to medium, for the users who need large text. |
| U-6 | With the keyboard open, the first tap on a form's main button ("Add caretaker", "Give task", "Add reminder") only closes the keyboard and the button moves down; a second tap is needed. | F1 and the setup forms | Low; causes doubt whether the action worked. |
| U-7 | The family's Shifts tab says "8 days worked" / "active over 8 days" when there were 8 shifts on 2 days (`ShiftsTab.tsx` counts shifts as days). | F3 | Low; a wrong number on a summary. |
| U-8 | The elderly person's "Toka / Sign out" signs out at once with no confirmation (caregiver and family sign-out ask first); signing out stops that phone's location sharing. | Observed during setup | Low to medium: one accidental tap stops visit verification. |
| U-9 | In Chats, the elderly person (with unread messages) is listed after all caregivers. | F1 | Low. |
| U-10 | The Android location prompt appears straight after sign-in without an app screen explaining why; the camera's buttons are icons only (one persona pressed the cross instead of the tick and lost the photo, with no message). | C1, C3 | Low. |

Worked well: the shift starting by itself as soon as the caregiver signed in at the house; the first-aid guide answering a typed Kiswahili question in Kiswahili and switching the screen language by itself; clear feedback on the elderly person's mood check-in ("Familia imeambiwa"); the confirmation before an emergency is sent ("Omba msaada? HAPANA / NDIYO, TUMA"); the alert card at the top of the family's Home with "Noted / Dismiss"; the shift timeline.

Side check (C2): with location allowed "Only this time", sharing continued after the phone was put away, because the app's location service kept running.

## Incidents and limits

- One environment incident (C1): the first "Sign in" stayed busy after permissions had been revoked from the command line; the app was restarted.
- Agent operation errors (E2, F1, F3), each logged with a correction marker and not counted against the persona.
- One emulated phone size only (1080 × 2408); smaller screens were not tested (author's choice, TEST_PLAN.md section 8).
- All personas used the same few test accounts, so some data was already changed by an earlier session (three tasks not run), and every account's first name was "Test", which made "who is here" less clear than it would be with real names.
- Debug build: a developer banner (LogBox) sometimes covered buttons at the bottom of the screen; release builds do not show it.

## Verdict for TC-021

**Not met as specified, simulated only.** 40 of 42 attempted tasks were completed (95.2 %; 92.9 % without help), but the mean SUS of the simulated personas was 64.4, below the target of 68, and two tasks failed on real defects (U-1, U-2). Because the participants were simulated, this is an indicative result; a session with real users is still needed to measure satisfaction.
