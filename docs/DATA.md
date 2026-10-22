# Data, databases and resources

What data the system uses, where it comes from, how it is prepared and checked, and the access and ethical rules that apply.

## 1. Operational database (PostgreSQL)

One database, `mzazicare`, owned by its own role (not the PostgreSQL admin). Created by `scripts/create-db.ps1`; the schema is created by
Django migrations (`backend/accounts/migrations`, `backend/care/migrations`). The entity-relationship diagram is in
[chapter 4](chapter4-analysis-and-design.md#33-data-design).

| Table | Holds | Notes |
|---|---|---|
| `accounts_user` | everyone: email, name, role (`user` / `caretaker` / `elderly`), `sponsor_id` (the family account that linked them), hashed password | passwords are hashed by Django (PBKDF2), never stored in plain text |
| `accounts_invite` | an email a family added before that person registered | removed when the person registers |
| `care_location` | the **latest** position of each caretaker and elderly phone | one row per user, overwritten; no movement history |
| `care_shift`, `care_shiftsegment` | visits and the verified in-range time inside them | worked time = sum of segments |
| `care_task`, `care_chore` | the caretaker's to-do list, and a per-visit record of it | |
| `care_tonereading` | seconds of speech per tone for a shift, and the percentage | derived numbers only, **no audio** |
| `care_alert` | flags for the family to confirm or dismiss | emergency, not feeling well, angry voices, fake GPS |
| `care_message` | chat between a family account and the people it linked | |
| `care_checkin`, `care_medication`, `care_medicationlog` | the elderly person's mood answers, medicine reminders and "taken" ticks | |

Sample data for demonstrations is created by `manage.py seed_demo` and flagged `is_demo` so the app can label it as sample data.

## 2. Audio datasets for the tone model

All are public research datasets. They are **not** in the repository: they are downloaded to `C:\mzazicare-data\voice`
(override with the `MZAZI_DATA` environment variable) by `scripts/prepare-data.ps1`.

| Dataset | Used for | Size | Source | Licence (check upstream for the exact terms) |
|---|---|---|---|---|
| RAVDESS (speech) | happy, calm, neutral, stressed, angry | 1,440 clips, 24 actors | Livingstone and Russo (2018), <https://zenodo.org/records/1188976> | CC BY-NC-SA 4.0 |
| CREMA-D | happy, neutral, stressed, angry | 7,442 clips, 91 actors | Cao et al. (2014), <https://github.com/CheyneyComputerScience/CREMA-D> (downloaded from a Hugging Face mirror) | Open Database License (ODbL) |
| LibriSpeech dev-clean | neutral (natural read speech, more speakers) | 2,703 utterances, 40 speakers | Panayotov et al. (2015), <https://www.openslr.org/12> | CC BY 4.0 |
| ESC-50 | "noise": anything that is not a person speaking | 2,000 clips (1,600 non-human used) | Piczak (2015), <https://github.com/karoldvl/ESC-50> | CC BY-NC 3.0 |

The notebook `esc-50-environmental-sound-classification.ipynb` that was on the development PC is a Kaggle analysis of ESC-50 and contains no audio;
it was used only as a reference.

**Licence note.** RAVDESS and ESC-50 are non-commercial licences. That is fine for this academic project. Before any commercial
deployment the trained model would need legal review or retraining on data that allows it.

## 3. Preparation steps (all automated, all repeatable)

1. `python -m voice.get_data`: download and extract (skips what is already there).
2. `voice/data.py`: index every clip and map its label onto our classes
   * happy -> happy; calm -> calm; neutral -> neutral; **fearful and sad -> stressed**; angry -> angry
   * disgust and surprise are **left out** on purpose (ambiguous; a wrong "angry" would worry a family for nothing)
   * ESC-50: only non-human classes become "noise" (people, coughs, laughter and similar are excluded)
   * RAVDESS: speech only (no song, no video-only files)
3. **Speaker-independent splits**: train / validation / test are separated by actor or speaker (and by ESC-50 fold). Nobody heard in
   training appears in the test set.
4. `python -m voice.build_features`: every clip becomes a 3 s window, level-normalised, converted to 40 MFCCs x 149 frames. Training clips also get one
   noisy / phone-microphone copy (background noise from ESC-50 training folds, band-limiting). Validation and test stay clean.
5. `python -m voice.check_data`: verifies the result (below).

## 4. Checks performed

`python -m voice.check_data` (run by `scripts/prepare-data.ps1`; exits non-zero on any problem):

* every dataset has the expected number of usable clips (RAVDESS 1,056 of 1,440; CREMA-D 6,171 of 7,442; LibriSpeech 1,381; ESC-50 1,600 after filtering)
* a random sample from each dataset decodes and is longer than 0.5 s
* every class appears in train, validation and test
* **no speaker appears in more than one split** (1,755 speakers/clips checked)
* the cached features have the model's input shape, contain no NaN or infinite values, and augmented copies exist only in training

Also tested in `ml/voice/tests`: the label mapping, the speaker-disjoint split rule, and feature extraction (shape, determinism, loudness invariance,
windowing).

## 5. Personal data the running system handles

| Data | Why | How it is limited |
|---|---|---|
| Name, email, password | accounts | password hashed; email used only to sign in and to link a family |
| Phone location (caretaker and elderly) | verify the caretaker is within 15 m of the elderly person | only the latest fix is kept; the caretaker sees a distance, never the elderly person's position; fake-GPS reports are ignored and flagged |
| Short audio clips (when phone recording is built) | judge the tone of a visit | analysed in memory and dropped: never written to disk or the database; only seconds-per-tone totals are saved; only during a verified shift |
| Mood answers, medicine reminders and ticks, chat | care and communication | visible only to the family that owns the circle and the person concerned |

## 6. Access and ethical requirements

* **Consent.** Recording voices in a person's home is sensitive. Before the phone records anything, the elderly person (or their legal
  representative), the caretaker and the family must each give explicit, informed consent in the app, and be able to withdraw it. This consent flow is **not yet built**,
  and audio capture stays switched off until it is.
* **Kenya Data Protection Act, 2019.** Location and voice can reveal health and behaviour. The design follows data minimisation (latest location only, no stored audio),
  purpose limitation (location is used only to verify visits; audio only for tone), access control by role, and the principle that a person, not the software, decides
  consequences. A data protection impact assessment and registration with the Office of the Data Protection Commissioner are needed before a real pilot.
* **Human in the loop.** The AI never punishes anyone. It raises a flag; the family confirms or dismisses it. Those decisions become the labels for the next training round.
* **Fairness and bias.** The training speech is acted English from adults. Older voices, Kenyan accents, Kiswahili and code-switching are under-represented, so errors may be higher for
  exactly the people this system serves. The accuracy figures must not be read as field performance (see the model card).
* **Dataset terms.** Use of RAVDESS, CREMA-D, LibriSpeech and ESC-50 must respect their licences and citation requirements (section 2).
* **Secrets.** No credentials are stored in Git (see the root README). The only generated secrets are in the git-ignored `backend/.env`.
* **Pilot ethics.** A study with real families needs institutional ethics approval and written consent from every participant.
