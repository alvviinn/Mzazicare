# Chapter 4 figures: placement, captions and text

Prepared by the Chapter 4 agent for the Chapter 5 agent's report build. The images are in `docs/diagrams/`
(PNG at 200 dpi for Word, SVG for sharp scaling, `.puml` source; shared style in `style.iuml`).
Insert each PNG inline, centred, at the full text width (about 15.5 cm). Captions use the report's existing
style: `Figure 4.N Title` (Caption style, STYLEREF/SEQ fields).

"Para NNN" refers to the paragraph index in the current v2 build (Chapter 4 starts at para 341).
Wording follows the report: "family", "caregiver", "elderly person". Code names (`caretaker`, `CaretakerHome`) stay as in the code.

## Numbering (old → new)

| New | Title | File | Replaces |
|---|---|---|---|
| 4.1 | Use Case Diagram | fig4_01_use_case.png | old 4.1 image |
| 4.2 | Context Diagram (Level 0 Data Flow Diagram) | fig4_02_context_dfd0.png | new |
| 4.3 | Level 1 Data Flow Diagram | fig4_03_dfd1.png | new |
| 4.4 | Sequence Diagram: Two-Step Sign-In | fig4_04_seq_sign_in.png | old 4.2 image |
| 4.5 | Sequence Diagram: Automatic Shift by Geofence | fig4_05_seq_auto_shift.png | new |
| 4.6 | Sequence Diagram: Ticking a Task with a Proof Photo | fig4_06_seq_task_proof.png | new |
| 4.7 | Entity Relationship Diagram: Accounts, Communication and Elderly Care | fig4_07_erd_accounts.png | old 4.3 image |
| 4.8 | Entity Relationship Diagram: Shifts, Location, Tone and Alerts | fig4_08_erd_shifts.png | new |
| 4.9 | Entity Relationship Diagram: Tasks and Proof of Completion | fig4_09_erd_tasks.png | new |
| 4.10 | Class Diagram | fig4_10_class.png | old 4.4 image |
| 4.11 | Activity Diagram | fig4_11_activity.png | old 4.5 image |
| 4.12 | State Diagram: A Day Shift | fig4_12_state_shift.png | new |
| 4.13 | State Diagram: An Alert | fig4_13_state_alert.png | new |
| 4.14 | Mobile Application Navigation Diagram | fig4_14_navigation.png | new |
| 4.15 | Mobile Application Wireframes | fig4_15_wireframe_mobile.png | placeholder 4.6 |
| 4.16 | Web Dashboard Wireframe | fig4_16_wireframe_web.png | placeholder 4.7 |
| 4.17 | System Architecture Diagram | fig4_17_architecture.png | placeholder 4.8 |
| 4.18 | Deployment Diagram | fig4_18_deployment.png | new |

## Section 4.3 System Analysis Diagrams

### Para 380 (section intro): replace

Before:
> This section illustrates how the system was diagrammatically analyzed. The diagrams presented in this section are a use case diagram, sequence diagram, class diagram, entity-relationship diagram, and system architecture diagram.

After:
> This section illustrates how the system was diagrammatically analyzed. The diagrams presented in this section are a use case diagram, a context diagram and a level 1 data flow diagram, sequence diagrams for the main flows, entity relationship diagrams, a class diagram, an activity diagram and state diagrams. All of them describe the system as it was built.

### 4.1 Use Case Diagram: replace para 382 and image4

Para 382 after:
> A use case diagram provides a high-level view of how external actors interact with the system and the services the system exposes. Figure 4.1 models the functional boundary of MzaziCare with three actors, the family, the caregiver and the elderly person, each of whom signs in to an app of their own. The family links the caregiver and the elderly person by email, sets medicine reminders and tasks, reviews shifts, task photographs and the tone of care, and confirms or dismisses alerts. The caregiver works a day shift that starts by itself within 15 metres of the elderly person, ticks tasks off with a photograph, sees their working hours and asks the first-aid assistant. The elderly person says how they feel, ticks medicines as taken and can press the emergency button at any time. Internal components such as the geofence engine and the AI models stay inside the system boundary rather than appearing as actors.

Caption: `Figure 4.1 Use Case Diagram`

### NEW subsection after Figure 4.1: Heading 3 "Data Flow Diagrams"

Para (new):
> Data flow diagrams show how data enters the system, where it is processed and where it is stored. The context diagram in Figure 4.2 treats MzaziCare as a single process and shows its exchanges with the three users and with the three external services it depends on: Google Sign-In, Azure Communication Services Email for sign-in codes, and Firebase Cloud Messaging for push notifications.

[Figure 4.2] Caption: `Figure 4.2 Context Diagram (Level 0 Data Flow Diagram)`

Para (new):
> Figure 4.3 breaks the system into six processes and the data stores they use. Locations from both phones drive the presence process, which records shifts and their in-range segments. Task photographs, tone results and elderly check-ins are stored separately. Three processes can raise an alert, and the family reviews every alert together with the shift evidence. Chat and the first-aid assistant are left out for clarity; the first-aid assistant stores nothing.

[Figure 4.3] Caption: `Figure 4.3 Level 1 Data Flow Diagram`

### Sequence Diagrams (heading stays "Sequence Diagram"; suggest renaming to "Sequence Diagrams"): replace para 386 and image5

Para 386 after:
> Sequence diagrams show the order of messages between the users, the app, the backend components and the database for one flow at a time. Three flows were chosen because they carry the main security and accountability rules of the system. Figure 4.4 shows the two-step sign-in. A correct password does not return a token straight away. The backend first emails a six-digit code, which is valid for ten minutes and can be used once, and a wrong code is refused with the number of tries left.

[Figure 4.4] Caption: `Figure 4.4 Sequence Diagram: Two-Step Sign-In`

Para (new):
> Figure 4.5 shows how a shift starts without any button. Both phones report their position every 15 seconds. The geofence engine starts the day's shift when the caregiver is within 15 metres of the elderly person's phone, starts a break beyond 20 metres, and continues the same shift when the caregiver returns. A position from a mock-location application is ignored and raises an alert for the family.

[Figure 4.5] Caption: `Figure 4.5 Sequence Diagram: Automatic Shift by Geofence`

Para (new):
> Figure 4.6 shows how a task is ticked off with proof. The photograph is taken with the camera and checked on the server, and it is stored only if the caregiver is verified within 15 metres of the elderly person. Otherwise the request is refused and nothing is kept. When the phone is offline, the tick and its photograph wait in a queue on the phone.

[Figure 4.6] Caption: `Figure 4.6 Sequence Diagram: Ticking a Task with a Proof Photo`

### Entity Relationship Diagrams: replace para 390 and image6

Para 390 after:
> The entity relationship diagrams define the database of MzaziCare as implemented in PostgreSQL through Django models. To keep each diagram readable, the schema is shown in three parts that share the User entity. Each shows primary keys, foreign keys and the main fields. Figure 4.7 shows the accounts and the care circle. A single User table holds every person, with a role of user (family), caretaker or elderly, and a self-reference, sponsor_id, links each caregiver and elderly person to their family. Invites, sign-in challenges, push devices, messages, mood check-ins and medicines all belong to a user.

[Figure 4.7] Caption: `Figure 4.7 Entity Relationship Diagram: Accounts, Communication and Elderly Care`

Para (new):
> Figure 4.8 shows the presence and monitoring data. A Shift links one caregiver to one elderly person for one day, and its worked time is the sum of its ShiftSegments, which record only verified in-range time. Location keeps only the latest position of each phone, while TrackPoints are kept only for an open shift. Tone results are stored as totals and per-clip shares, never as audio. An Alert belongs to a family and may refer to a shift.

[Figure 4.8] Caption: `Figure 4.8 Entity Relationship Diagram: Shifts, Location, Tone and Alerts`

Para (new):
> Figure 4.9 shows the task data. A Task is written by the caregiver or assigned by the family. Each time it is done, a TaskCompletion stores the photograph and copies the title, so the history survives if the task is later edited or deleted. A Chore is the day's snapshot of a task inside a shift.

[Figure 4.9] Caption: `Figure 4.9 Entity Relationship Diagram: Tasks and Proof of Completion`

### 4.10 Class Diagram: replace para 394 and image7

Para 394 after:
> The class diagram in Figure 4.10 shows how the backend code is organised. API views receive the requests and delegate the work to backend services. The presence module holds the geofence rules, voice_ai loads and applies the tone model, and push sends notifications. The two AI components are classes in the ml package. ToneAnalyzer runs the ONNX tone model and applies the alert rule (at least three windows at 60 % angry or more). FirstAidAssistant matches a message to a topic in the vetted bilingual guide. Each model is loaded once per server process. The data classes User, Shift and Alert show how the services record their results, and saving an Alert triggers a push notification.

Caption: `Figure 4.10 Class Diagram`

### 4.11 Activity Diagram: replace para 398 and image8

Para 398 after:
> The activity diagram in Figure 4.11 models a caregiver's working day. After sign-in, both phones share their positions until the caregiver is within 15 metres of the elderly person, and the shift then starts by itself. Three activities run in parallel during the shift. Tasks are ticked off with a photograph only inside the geofence. Short audio clips are analysed in memory when both people have agreed, and clearly angry speech raises an alert. Leaving the 20-metre range starts a break without ending the shift. The shift closes when the caregiver taps End or at midnight, and the family then reviews the day and decides on any alerts.

Caption: `Figure 4.11 Activity Diagram`

### NEW subsection after Figure 4.11: Heading 3 "State Diagrams"

Para (new):
> State diagrams describe the life of objects whose status changes over time. Figure 4.12 shows a day shift. It becomes active when the caregiver arrives, pauses on a break when they step out, and continues as the same shift when they return. It is ended by the caregiver or closed at midnight, and the next day is a new shift.

[Figure 4.12] Caption: `Figure 4.12 State Diagram: A Day Shift`

Para (new):
> Figure 4.13 shows an alert. Every alert starts open and sends a push notification. For an emergency, the first person who says they are handling it is recorded. The family then confirms or dismisses the alert. The decision is stored with it, so no alert leads to action without a person's judgement.

[Figure 4.13] Caption: `Figure 4.13 State Diagram: An Alert`

## Section 4.4 System Design Diagrams

### Para 402 (section intro): one sentence change

Before:
> Specifically, this section presents the system architecture, the database schema, and the user interface wireframes.

After:
> Specifically, this section presents the navigation of the mobile application, the user interface wireframes, the system architecture and the deployment of the system.

### NEW subsection before "Wireframe": Heading 3 "Navigation Diagram"

Para (new):
> Figure 4.14 shows how a user moves through the mobile application. After sign-in, with an emailed code for newer accounts, the app reads the user's role and opens one home screen per role. The family has the Home, Shifts, Tone, Chats and People tabs. The caregiver has the Today, Tasks, Hours and First aid tabs, and the elderly person has a single screen. No one sees controls that belong to another role.

[Figure 4.14] Caption: `Figure 4.14 Mobile Application Navigation Diagram`

### Wireframe: placeholders → Figures 4.15 and 4.16

Placeholder "[INSERT IMAGE: Wireframes of the mobile application screens ...]" → fig4_15_wireframe_mobile.png,
caption `Figure 4.15 Mobile Application Wireframes`.

Para 408 after (the old text describes recording first-aid queries, a live map panel and a viewer for the caregiver's medical chat logs; first-aid messages are typed and are not stored, per Table 5.12):
> The mobile wireframes in Figure 4.15 emphasise simplicity for each role. The caregiver's Today tab shows whether they are in range, the time counted today and the tasks done, with one button to end the shift. The First aid tab takes a typed question in English or Kiswahili and returns numbered steps from the vetted guide, with the emergency number always at the top. The elderly person's home screen uses large text in both languages, one action per card and an always-visible "I need help" button. The family's Home tab puts open alerts first, with Confirm and Dismiss buttons. The web dashboard in Figure 4.16 gives the family the same information on a computer, with a menu for shifts, task history with photographs, voice tone, chats and people, and a home page that combines today's shift, alerts, tone, tasks, medicines and recent shifts.

Placeholder "[INSERT IMAGE: Wireframe of the family web dashboard ...]" → fig4_16_wireframe_web.png,
caption `Figure 4.16 Web Dashboard Wireframe`.

### System Architecture Diagram: placeholder → Figure 4.17

Placeholder "[INSERT IMAGE: System architecture diagram ...]" → fig4_17_architecture.png,
caption `Figure 4.17 System Architecture Diagram`. The surrounding text (paras 413 and 417) already matches the figure; only change a "Figure 4.8" reference to "Figure 4.17" if one is added.
Add at the end of para 417: "Push notifications for alerts and messages are sent through Firebase Cloud Messaging."

### NEW subsection after the architecture: Heading 3 "Deployment Diagram"

Para (new):
> The deployment diagram in Figure 4.18 shows where each part of the system runs in the pilot. The Android app is installed on the phones of the family, the caregiver and the elderly person. The Django API, including both AI models, runs on Azure App Service. The database runs on an Azure PostgreSQL Flexible Server that accepts connections only from Azure services. The family web dashboard is served as static files from an Azure Storage static website. Sign-in codes are sent through Azure Communication Services, and push notifications through Google Firebase Cloud Messaging.

[Figure 4.18] Caption: `Figure 4.18 Deployment Diagram`

## List of Figures

Update the field after insertion. It should list Figures 4.1 to 4.18 with the titles above.
