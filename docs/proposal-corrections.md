# Corrections to the proposal

The project proposal (June 2026) was written before implementation. This document records every place where the system as built differs from it, why, and what is still
outstanding. It is the bridge between the proposal chapters and [Chapter 4](chapter4-analysis-and-design.md).

## 1. Inconsistencies inside the proposal (resolved)

| Proposal said | Resolution |
|---|---|
| Section 1.5.1 names a **Node.js** backend; everywhere else the design is Django REST Framework | **Django REST Framework** (the architecture diagram, class design and data flow all assume it) |
| FR-01: sponsors have a "read-only monitoring dashboard", yet they manage patients, assign caretakers and validate alerts | Family accounts can **write** their care circle, medicine reminders, chat and alert decisions, and read all monitoring data |
| The ERD shows a task linked to at most one anomaly, but alerts also come from GPS and audio at shift level | An `ALERT` table replaces `AnomalyLog`; the shift link is optional and many alerts may exist per shift |
| The ERD has no table for the GPS trail, chat logs or user accounts, although the dashboard needs them | Added: `USER` (with role), `LOCATION`, `SHIFTSEGMENT`, `MESSAGE`, `INVITE`, plus the tables for new features |
| The dashboard is "React.js and Next.js" | Built as proposed: a Next.js (App Router, TypeScript) dashboard in `web/` for family accounts, using the same API as the app. The family can also keep using the mobile app |
| "Implementation Environment / Hardware" section unfinished | Documented in [SETUP.md](SETUP.md): Intel i7-8650U, 15 GB RAM, no GPU |

## 2. Design changes made during implementation

| Proposal | As built | Why |
|---|---|---|
| Geofence: fixed **30 m** circle around a stored home address; DQN reinforcement-learning agent scores trajectories | **15 m circle centred on the elderly person's phone**; deterministic rule with 20 m exit radius, freshness and accuracy limits, fake-GPS detection | The requirement changed to follow the elderly person's phone; a rule is explainable, testable and needs no trained model. The DQN is **not implemented** (could return as an optional anomaly-scoring layer) |
| Separate Sponsor, Patient and Caretaker entities | One `USER` table with a role and a `sponsor_id` link | The elderly person also logs in; role conversion is one field |
| Patient home latitude, longitude and radius stored | Removed | The circle follows the elderly phone |
| Spatial data in PostGIS | Latest fix as plain coordinates; distance by the haversine formula | No trail is kept, so there is nothing to query spatially. PostGIS is installed for later |
| Voice model: 2D CNN on MFCC, trained on RAVDESS | Same family of model, trained on **RAVDESS + CREMA-D + LibriSpeech + ESC-50**, six classes including "noise", evaluated on unseen speakers | One acted dataset is small and easy to over-fit; the noise class stops TV or traffic being read as tone |
| MFCC computed **on the device**, raw audio deleted on the phone | Audio is analysed **in memory on the server** and dropped; phone capture not built yet | There is no standard React Native MFCC library. The privacy claim changes from "audio never leaves the phone" to "audio is never stored". This trade-off needs the consent flow before use |
| Tone classes: calm vs high-arousal negative | Five tones (happy, calm, neutral, stressed, angry) with percentages and a dominant tone | Matches what the family dashboard shows |
| Quality of service implied by tone | Rated from the share of **stressed + angry** speech (<= 15 % good, <= 30 % fair) | Ordinary conversation is mostly neutral, so rating by "happy" would flag a normal day |
| Asynchronous heavy AI work (Celery + Redis) | The tone model runs inside the request | The model is small; a queue is future work |
| Real-time alerts (WebSockets or push) | The app polls every 4 to 30 seconds | Simpler; push notifications are future work |

## 3. Scope added beyond the proposal

The elderly person's own app (mood check-in, medicine reminders, emergency button, English and Kiswahili, three text sizes); separate chats between the family and each person;
the caretaker's own to-do list with daily-repeating tasks; verified hours; manual start/stop that is still geofence-verified; the emergency banner for caretakers.

## 4. Proposal items not yet built

| Item | Notes |
|---|---|
| **FR-03 triage chatbot** (fine-tuned mBERT, FirstAidQA, code-switched queries) | Not started. Needs its own datasets and a safety review (it must not give unsafe medical advice) |
| **Behavioural anomaly detection** (unsupervised, visit-pattern baseline) | Not started. Visit and hours data now exist to build it |
| Phone recording for the tone model | Consent flow and an Android audio-format decision first |
| Offline resilience and sync | Not started; the app shows a clear error when the server cannot be reached |
| Web dashboard (Next.js) | Done (family accounts only; caretakers and elderly use the phone app) |
| NFR-02 performance measured | Not benchmarked |

## 5. Targets and results

| Target | Result |
|---|---|
| NFR-04: each model at least 80 % accuracy on validation data | Tone model: **83.0 %** overall (6 classes) but **75.4 %** on speech alone, so the target is met overall and **not met for speech-only classification**. The other models do not exist yet |
| Precision prioritised to avoid false alarms | Alert rule tuned for it: 0.2 % false alarms on simulated recordings of speakers the model never heard |

## 6. Schedule

The proposal ordered the sprints as chatbot, then geofence agent, then voice model, then integration. The build instead proceeded app and accounts first, then geofence and
hours, then the family and elderly experiences, then the voice model, because the dependable core had to exist for the models to plug into. The chatbot sprint is still to do.
