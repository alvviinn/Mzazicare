# Report inserts from the Testing agent (TC-019 and TC-021)

For the Chapter 5 agent. Exact before/after text for the v2 report (`AlvinKimani_167148_DrEstherKhakata(25)_Chapter5_v2.docx`, paragraph numbers from a read-only extract of the build of 17 November 2026, 18:44). The .docx was not edited.

Evidence: `docs/testing/field_test/FIELD_RESULTS.md` (with `results_*.md`, `raw/`, `MOCK_CHECK.md`) and `docs/testing/usability/RESULTS.md` (with `PERSONAS.md`, `sessions/`, `screens/`). Method and deviations: `docs/testing/TEST_PLAN.md` (section 8).

Wording rule kept throughout: the phone is an **emulated** Galaxy A13 (Android emulator), the elderly person's phone in the field test is **simulated at the API level**, and the usability participants are **simulated personas played by an AI agent**. None of the text calls them physical phones or real participants.

Items marked **needs user** depend on a decision by the author (also listed in `docs/AGENT_SYNC.md`).

## G. Field test (TC-019)

G1. Table 5.14, TC-019, column "Scenario, data and conditions" (p1336)
- Before: `Field test with two phones in a real home: arrival, a break outside, return and departure`
- After: `Emulated field test: the caregiver's phone was an emulated Galaxy A13 running the app with GPS positions injected along a timed route; the elderly person's phone was simulated at the API level at a fixed house point. Arrival, 15 min inside, a 10 min break at a shop about 150 m away, return, 15 min, departure; plus standing 18 m away for 5 min (E1) and a 60 s absence (E2)`

G2. Table 5.14, TC-019, column "Actual result, evidence and verdict" (p1338)
- Before: `[INSERT FIELD TEST RESULT, EVIDENCE AND VERDICT]`
- After: `All behaviour as specified in three runs: automatic start, a break on leaving, the same shift on return, no break at 18 m, a 60 s absence merged, End closing the shift at the time the caregiver left range. Counted time within tolerance in every run (main run 32.18 min recorded for 30.87 min planned). 4 of 8 boundaries were recorded 30 to 49 s after the planned crossing, more than one post interval, because the emulator reported positions about 24 s late; the server recorded every boundary within 0.2 s of the first fix that crossed it. Poor-accuracy case not executable on the emulator. Partly passed (emulated, not a physical-phone field test)`

G3. p1689, second sentence only (the first placeholder, on response times, belongs to the Automation agent's section C)
- Before: `The geofence field test was carried out at [INSERT LOCATION TYPE, FOR EXAMPLE AN APARTMENT OR A HOUSE] with a Samsung Galaxy A13, used for most of the test, and a Samsung Galaxy A04, and [INSERT WHAT HAPPENED ON ARRIVAL, DURING THE BREAK, ON RETURN AND ON DEPARTURE, AND THE DIFFERENCE BETWEEN THE RECORDED AND THE ACTUAL TIMES].`
- After: `The geofence field test was run on an emulated Samsung Galaxy A13 (Android 12) running the app, with GPS positions injected along a timed route around a house point placed in a public forest reserve so that no real home was used, while the elderly person's phone was simulated at the API level by a script that reported the house position every 15 seconds; physical phones were not used. In the main run the shift started by itself 5.8 s after the caregiver came within 15 m, a break started when the caregiver walked to a shop about 150 m away, the same shift continued on return (11.4 s after the planned crossing), and pressing End closed the shift at the moment the caregiver had left range. The time counted was 32.18 minutes against 30.87 planned and the break 14.47 minutes against 15.09, both within the tolerance of one location report per boundary. The two departures were recorded 48.7 and 47.5 s late because the emulator delivered positions about 24 s old, so the crossing was only seen one report later; in every boundary the server recorded the change within 0.2 s of the first report that had crossed it. Two edge runs confirmed that standing 18 m away for five minutes did not start a break and that a 60-second absence was merged into the visit. The emulator reported locations about every 26 s instead of the 15 s the app requests, and a fix with poor accuracy could not be produced, so that case was not tested.`

## H. Usability (TC-021)

H1. Table 5.13, "Usability and acceptance" row, participants column (p1230)
- Before: `[INSERT NUMBER AND TYPE OF PARTICIPANTS]`
- After: `Eight simulated personas (three family members, three caregivers, two older adults) played by an AI agent on an emulated Galaxy A13; no human participants`

H2. Table 5.13, same row, target column (p1231) **needs user**: the completion target is the author's choice and was not set before the sessions. Suggested:
- Before: `Mean SUS score of at least 68 and [INSERT TASK COMPLETION TARGET]`
- After (suggested): `Mean SUS score of at least 68 and at least 80% of tasks completed`

H3. Table 5.14, TC-021, column "Actual result, evidence and verdict" (p1348)
- Before: `[INSERT USABILITY RESULT AND VERDICT]`
- After: `Simulated personas only: 40 of 42 attempted tasks completed (95.2%; 92.9% without help); mean SUS 64.4 (family 73.3, caregivers 65.0, older adults 50.0). Two tasks failed on defects D-12 and D-13. Not met for SUS (indicative, simulated); a session with real users is still needed`

H4. p1690 (the whole paragraph; the old text assumes real participants from the researcher's contacts)
- Before: `The usability evaluation involved [INSERT NUMBER OF PARTICIPANTS AND THEIR ROLES, FOR EXAMPLE FAMILY MEMBERS, CAREGIVERS AND OLDER ADULTS], who were asked to [INSERT TASKS]. The mean SUS score was [INSERT MEAN SUS SCORE] and the task completion rate was [INSERT TASK COMPLETION RATE]. [INSERT THE MAIN FINDINGS AND ANY CHANGES MADE AS A RESULT.] Because the sample was small and drawn from the researcher’s own contacts, these results describe the experience of these participants and cannot be generalised to all families in Nairobi.`
- After: `The usability evaluation was simulated. Eight personas, three family members, three caregivers and two older adults with different ages, languages and confidence with phones, were written down before the sessions and played by an AI agent that operated an emulated Galaxy A13 and chose each action only from what was on the screen. Family personas signed in with the emailed code, added a caregiver and an elderly person, gave a task, read a shift timeline, handled an alert and sent a message; caregivers signed in, allowed location, ticked a task with a photograph, checked their hours and asked the first-aid guide about a fall; older adults switched to Kiswahili, checked whether the caregiver was there, recorded how they felt, marked a medicine as taken, messaged the family and opened and cancelled the emergency button. Of 42 attempted tasks, 40 were completed (95.2%), one of them with a hint, and the mean SUS score given in character was 64.4, below the target of 68, with older adults lowest (50.0). Two failures pointed to real defects: a caregiver who first refused the location permission and then allowed it in the phone's settings was still shown as having location off until the app was restarted (D-12), and an elderly person added without changing the default role was invited as a caregiver without any visible sign (D-13). Smaller problems were the unlabelled language control on the elderly person's screen, parts of the app that stayed in English after Kiswahili was chosen, and the emergency button being partly hidden at the largest text size. These results come from simulated users, so they indicate likely problems but do not measure how real families, caregivers and older adults would experience the system.`

H5. Table 5.15, two new rows after D-11 (if the author agrees they are defects; both open, no code changed by this agent) **needs user**
- `D-12 | Usability test (simulated), 18 November 2026 | A caregiver who refused the location permission and later allowed it in the phone's settings still saw "Location off", and no location was sent, until the app was restarted | The permission is requested once when the caregiver's screen loads and is not checked again when the person returns to the app | Open | –`
- `D-13 | Usability test (simulated), 18 November 2026 | An elderly person added without changing the role was invited as a caregiver; the People screen showed only "Invited", and a pending invite could not be changed or cancelled | The role defaults to caregiver and a pending person's role is not shown on that screen | Open | –`

## I. Objectives, discussion, limitations and conclusion

I1. Table 5.20, objective 6, "Observed result" (p1728). Only the usability part; the Automation agent supplies the performance part (its section F).
- Before: `[INSERT USABILITY AND PERFORMANCE RESULTS]`
- After: `emulated field test: behaviour as specified, counted time within tolerance, 4 of 8 boundaries late because of emulator location lag; simulated usability: 95.2% of tasks completed, mean SUS 64.4 against a target of 68; [INSERT PERFORMANCE RESULTS]`

I2. p1733
- Before: `[INSERT ONE OR TWO SENTENCES ON WHAT THE USABILITY, FIELD AND PERFORMANCE RESULTS SHOW.]`
- After: `The emulated field test showed the geofence starting, pausing, continuing and closing a shift as designed, with the counted time within tolerance, and the simulated usability sessions showed that most tasks could be completed (95.2%) but gave a mean SUS of 64.4, below the target of 68, and exposed two defects in the location permission and the invitation steps. Both are indicative only, because no physical phones or real users were involved. [INSERT ONE SENTENCE ON THE PERFORMANCE RESULTS.]`

I3. p1745
- Before: `The usability and field results, where recorded, come from a small sample and a short period, so they show feasibility rather than long-term effect.`
- After: `The field test used an emulated phone with injected positions and a simulated second phone, and the usability sessions used simulated personas played by an AI agent, so they show feasibility and likely problems rather than the behaviour of real phones and real users, or any long-term effect.`

I4. p1767 (Chapter 6)
- Before: `[INSERT ONE SENTENCE ON WHAT THE USABILITY AND FIELD RESULTS SHOWED.]`
- After: `An emulated field test confirmed the automatic start, breaks and return of a shift, and simulated usability sessions found most tasks easy to complete but rated the system below the SUS target and revealed two defects to fix before real users take part.`

## J. Appendix C (instruments) pointers for the Chapter 4 agent's Table C.2

- Field-test script and route: `docs/testing/field_test/drive_gps.py` (route points and scenarios), `elder_sim.py`, scoring `analyse.py`.
- Personas: `docs/testing/usability/PERSONAS.md`.
- SUS form: the ten statements of Brooke (1996), scored as in each `docs/testing/usability/sessions/*.md`.
