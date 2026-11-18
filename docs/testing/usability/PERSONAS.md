# Simulated usability personas (TC-021)

Written by the Testing agent on 17 November 2026, **before any session**. These are **simulated personas, not real people or participants**. Each is played by the agent, who operates the Emulated Galaxy A13 through adb and chooses every action from what is on the screen only (never from the app's code). Results estimate likely problems; they are not a measured user sample. Names are invented. Test accounts use the reserved `@example.com` domain.

Device for every persona: Emulated Galaxy A13 (Android 12, 1080 × 2408, density 400), debug build, local backend. The screen-size spread planned in TEST_PLAN.md section 3 was dropped at the author's request (section 8), so smaller and larger phones are not covered.

| # | Persona (simulated) | Role | Age | Phone habits and tech confidence | Language | Context and likely difficulties |
|---|---|---|---|---|---|---|
| F1 | "Brian" | Family (`user`) | 38 | Works in the UK. Uses banking and messaging apps daily. High confidence. | English | Checks on his mother from abroad in short breaks. Wants to see at a glance whether the caregiver came today. Impatient with extra steps such as the emailed code. |
| F2 | "Wanjiru" | Family (`user`) | 33 | Busy job in Nairobi. Uses apps quickly, skims text. Medium-high confidence. | English | Sets the caregiver's tasks and reads alerts on the way to work. May tap before reading. |
| F3 | "Otieno" | Family (`user`) | 55 | Uses WhatsApp and M-Pesa, little else. Low-medium confidence. | English, prefers short words | Helps his sister manage the caregiver. Unsure what icons mean; reads labels slowly; afraid of "breaking" something. |
| C1 | "Mama Akinyi" | Caregiver (`caretaker`) | 46 | Basic Android phone, experienced caregiver. Medium-low confidence. | Kiswahili preferred, reads simple English | Wants to know her hours are being counted without doing anything. Reads in Kiswahili if offered. |
| C2 | "Kevin" | Caregiver (`caretaker`) | 24 | Comfortable with apps, uses TikTok and Instagram. High confidence. | English and Kiswahili | Moves fast, explores menus, expects swipe and icon conventions. |
| C3 | "Naliaka" | Caregiver (`caretaker`) | 29 | First smartphone (moved from a feature phone a month ago). Low confidence. | Kiswahili, some English | Unsure about permission pop-ups; may refuse "allow all the time" without understanding; needs clear words. |
| E1 | "Mzee Kamau" | Elderly person (`elderly`) | 74 | Uses a phone for calls and M-Pesa. Weak eyesight (needs larger text). | Reads Kiswahili | Wants to see who is with him and to call for help. Taps slowly; may miss small targets. |
| E2 | "Cucu Wairimu" | Elderly person (`elderly`) | 81 | Rarely uses a phone; family set it up. Very low confidence. | Kiswahili, spoken Kikuyu | Uses only what is on the first screen. Will not open menus without being told. |

## Tasks per role (from TEST_PLAN.md section 6)

- **Family:** T1 sign in with the emailed code; T2 add a caregiver and an elderly person by email; T3 give the caregiver a task; T4 open today's shift and read its timeline; T5 confirm or dismiss an alert; T6 send a chat message.
- **Caregiver:** T1 sign in; T2 allow location and see the shift on Today; T3 tick a task with a proof photo; T4 check this week's hours; T5 ask the first-aid guide about a fall.
- **Elderly person:** T1 switch to Kiswahili if preferred (and larger text for E1); T2 check whether the caregiver is here; T3 record how they feel; T4 mark a medicine taken; T5 message the family; T6 find the "I need help" button, open it and cancel (no real call).

## Rules for each session

- A task **fails** after 3 wrong paths or 5 minutes. **With help** means the persona would need to ask someone; the moderator hint is then applied and recorded.
- Recorded per task: outcome (success / with help / failed), time from the first action to the end state (from `logs/ui_actions.log`), errors (wrong taps or paths), hesitation points (where the persona stops to read or is unsure), screenshots in `usability/screens/`.
- After the tasks, the persona answers the 10-item System Usability Scale (Brooke, 1996) in character, on a 1–5 scale, with a one-line reason per item. Scored the standard way: odd items (score − 1), even items (5 − score), sum × 2.5.
- The agent's knowledge of the app from setup is a known bias. To limit it, each persona follows only labels on the screen, and hesitation is recorded wherever a label would not be clear to that persona.
