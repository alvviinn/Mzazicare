# API reference

Base URL: `http://<host>:8000/api`. JSON in and out, except the audio endpoint (raw audio body).
Authenticate with `Authorization: Bearer <token>` (JWT from register or login, valid 90 days).
Errors are `{"detail": "..."}` with status 400 (invalid input), 401 (no or expired token), 403 (wrong role), 404/409/413/503 as noted.

Roles: **family** (`user`), **caretaker**, **elderly**.

## Accounts

| Method and path | Who | Purpose |
|---|---|---|
| `POST /auth/register/` | anyone | `{name, email, password}` (password 6+ characters). Starts as **family**, unless the email was already added as a caretaker or elderly person, in which case the account gets that role. Returns a code challenge (below), not a token: the emailed code also proves the email is theirs. |
| `POST /auth/login/` | anyone | `{email, password}`. Accounts that existed before two-step sign-in was added get `{token, name, role}` as before. Accounts created since get `{two_factor: true, challenge, sent_to, expires_in}` and a 6-digit code by email (no token yet). |
| `POST /auth/verify/` | anyone | `{challenge, code}`. Returns `{token, name, role}`. The code lasts 10 minutes, works once, and only with its own challenge; 5 wrong codes spend the challenge; a new sign-in replaces an older challenge. Only hashes of the code and challenge are stored. |
| `POST /auth/resend/` | anyone | `{challenge}`. Emails a new code (the old one stops working); at most every 30 s and 5 times per sign-in. |
| `POST /auth/google/` | anyone | `{id_token}` from Google Sign-In. The backend checks Google's signature, expiry, issuer, that it was issued for one of `GOOGLE_CLIENT_IDS`, and that the email is verified. Signs in the linked account, links an existing account with the same email, or creates one (taking any invite for that email, like registering; no password). No emailed code: Google has verified the person. Returns `{token, name, role}` (`201` when the account is new). |
| `GET /me/` | any | The caller's profile: role, the family account that linked them, and the family's caretakers and elderly people (with `pending` invites shown to the family only). |
| `POST /team/` | family | `{email, role: "caretaker" \| "elderly"}`. Converts an existing account, or records an invite for an unregistered email. Rejects your own email, someone already in your circle, and accounts that belong to another family. |

## Family

| Method and path | Purpose |
|---|---|
| `GET /dashboard/` | Everything on the Overview: whether a caretaker and an elderly person are linked (`matched`), today's shift status (`none` / `on_shift` / `paused` (on a break) / `away` / `waiting` / `completed`), the caretaker's to-do list for today, average active time per day, days worked and chore completion over 7 days, tone shares (with dominant tone and quality rating), recent day-shifts (each opens with `GET /shifts/<id>/`), how each elderly person feels today, medicine adherence, alerts (open first), and unread chat counts. |
| `POST /alerts/<id>/` | `{status: "confirmed" \| "dismissed"}`. The human decision on an alert. |
| `GET /chat/?with=<email>` | The conversation with one person in the circle (marks their messages read). |
| `POST /chat/` | `{to, body}` (max 2,000 characters). Allowed only between a family account and the people it linked (family <-> caretaker, family <-> elderly; **not** caretaker <-> elderly). Also used by caretakers and elderly people to message the family. |
| `POST /medicines/` | `{elderly_email, name, dose?, time: "HH:MM"}`: a daily reminder for one of your elderly people. |
| `DELETE /medicines/<id>/` | Remove a reminder. |

## Shifts (caretaker and family)

A **shift is one day** of work for one caretaker with one elderly person. Stepping out of the 15 m range is a *break*: the timer pauses
and, when the caretaker returns, the same shift continues. A new calendar day (Nairobi time) is a new shift. Only active, in-range
time counts as hours.

| Method and path | Who | Purpose |
|---|---|---|
| `GET /shifts/?days=30` | caretaker (own days), family (its caretakers' days) | One card per day, newest first (up to 90 days): date, first arrival, last time out, end, active minutes, number of breaks and break minutes, status, chores done. Elderly accounts get 403. |
| `GET /shifts/<id>/` | caretaker (own), family (own circle) | The detail of one day: `timeline` (arrived, stepped out, came back after N minutes, left), `segments` (active periods), `breaks_list`, `chores`, and for the **family only** the day's `tones` and `tone_timeline` (the tone chart for that visit). Anyone else gets 404. |
| `GET /tone/live/` | family | The live tone view for today, polled every ~5 s: `state` (`live` = speech heard in the last 3 minutes, `listening` = caretaker in range, `idle`), `last_heard`, `current` (last 5 minutes), `series` (15-minute buckets with tone shares, `tension` = stressed + angry, `positive`, `dominant`), `today` (tone mix, quality, speech minutes, calmest and most tense time, comparison with the usual level, raised-voice clips and vocal alerts) and `earlier_days` (daily tension for the previous week). Caretaker and elderly get 403. |

## Caretaker

| Method and path | Purpose |
|---|---|
| `POST /location/` | `{latitude, longitude, accuracy?, mocked?}`. Each phone (caretaker and elderly) reports every 15 s. Only the latest fix is kept. A fix flagged `mocked` is ignored and alerts the family (at most once an hour). Re-checks who is in range. |
| `GET /shift/state/` | Today's shift: `status` (`none` / `active` / `waiting`), `phase` (`none`, `waiting`, `active`, `break`, `away`, `ended`), minutes counted, `today` (the day's shift card, even after "finish for now", so it can still be opened), range state and distance (to 500 m), whether the elderly phone is sharing, and any open emergency. |
| `POST /shift/start/` | Manual start of today's shift (or continue it after "finish for now"). Only in-range time is counted. 400 if today's shift is already open (it started by itself, or the caretaker is on a break). |
| `POST /shift/stop/` | "Finish for now". 400 if nothing is running. The day's shift is closed, but if the caretaker comes back the same day it continues as the same shift. |
| `GET /hours/` | Active minutes for today, this week, this month, all time, and one card per recent day worked. |
| `POST /firstaid/chat/` | Caretaker only. First-aid assistant. Send `{message}` (English or Kiswahili), or `{topic}` when a suggested button is tapped; optional `awaiting` (the topic whose follow-up question was just asked, so a typed yes/no answers it) and `lang` (`en`/`sw`). Returns `{kind: answer|clarify|greeting|general_medical|out_of_scope, topic, title, lang, emergency, urgent, intro, steps, avoid, after, followup: {question, options: [{label, topic}]}, note, text}`. Advice comes only from the vetted guide in `ml/firstaid/knowledge`; `emergency` puts "call 999 or 112" first. Messages are not stored. 503 until the model is installed. |
| `GET/POST /tasks/`, `PATCH/DELETE /tasks/<id>/` | Task lists. **Caretaker:** their own list; `POST {title (max 200), recurring}`. **Family:** `GET` lists all their caretakers' tasks for today; `POST {caretaker_email, title, recurring}` assigns a task to one of their own caretakers. Each task has `assigned_by` (family name, or null when the caretaker wrote it) and `completion_id` (the proof record while ticked). `PATCH {is_done: false?, title?, recurring?}`: only whoever created a task can rename, re-time or delete it (a caretaker gets `403` on a family task; the family can only touch tasks they assigned). `is_done: true` is refused with `400`: ticking needs a photo (below). Un-ticking removes that tick's photo. Recurring tasks reset on each working day (Mon to Fri). |
| `POST /tasks/<id>/done/` | Caretaker ticks a task off with proof. Body: the photo itself (`Content-Type: image/jpeg`, `image/png` or `image/webp`; checked from its first bytes; at most 6 MB, else `413`). Refused with `403` unless the phone is verified within 15 m of the elderly person (fresh, accurate, not mocked); nothing is stored then. Returns the task (`201`), or `200` if it was already ticked. |
| `GET /tasks/history/?days=30` | Task history, newest first (1 to 365 days, at most 500): `{days, items: [{id, task_id, title, recurring, caretaker, assigned_by, done_at, shift_id}]}`. The caretaker sees their own; the family sees their caretakers'. Kept when a task is deleted. |
| `GET /tasks/completions/<id>/photo/` | The proof photo (image bytes), only for the caretaker who took it and their family; no public link. |
| `GET /audio/status/` | caretaker, elderly | Should this phone record now? `{record, reason, consent, chunk_s}`. `record` is true only during a verified shift (caretaker in range) when both people have agreed; `reason` is `no_shift`, `you_have_not_agreed` or `other_has_not_agreed` otherwise. The phones ask before every 10 s clip. |
| `POST /audio/consent/` | caretaker, elderly | `{consent: true|false}`: each person agrees (or withdraws) for themselves. The family account gets 403. `GET /me/` returns `voice_consent`. |
| `POST /audio/tone/` | caretaker or elderly phone, **raw audio body** (WAV, FLAC, OGG, or the phones' AAC `.m4a`/`3gp`; up to 3 MB). Analysed in memory and discarded; only tone totals are kept. Each clip also leaves one `ToneSample` (time, speech seconds, the five tone shares; no audio) that feeds the live chart. Returns `{speech_s, dominant, tones, distress}`. 409 if there is no verified shift running, 403 if both people have not agreed, 413 too large, 400 unreadable, 503 model missing. |

## Elderly

| Method and path | Purpose |
|---|---|
| `GET /elder/home/` | The home screen data: caretaker presence in plain terms (`here`, `away`, `left`, `not_arrived`, `none`), today's mood answer, today's medicines with `taken` / `due` / `missed` / `later`. |
| `POST /elder/checkin/` | `{mood: "good" \| "okay" \| "unwell"}`. "unwell" alerts the family (at most once in 3 hours). |
| `POST /elder/sos/` | The emergency button. Alerts the family, sends them a chat message, and shows an emergency banner to the caretaker. Double taps within 2 minutes are merged. |
| `POST /medicines/<id>/take/` | "I took it" for today. Safe to repeat. |

## Access summary

| | Family | Caretaker | Elderly |
|---|---|---|---|
| Register, login, `/me/` | yes | yes | yes |
| Add people, medicines, view dashboard, resolve alerts | yes | no | no |
| Shift, hours, audio; ticking tasks off (with a photo) | no | yes | no |
| Task lists and history, proof photos | yes (their caretakers'; assign and remove their own tasks) | yes (their own) | no |
| Mood check-in, SOS, medicine ticks, elder home | no | no | yes |
| Location | no | yes | yes |
| Chat | with their circle | with the family only | with the family only |
