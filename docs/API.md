# API reference

Base URL: `http://<host>:8000/api`. JSON in and out, except the audio endpoint (raw audio body).
Authenticate with `Authorization: Bearer <token>` (JWT from register or login, valid 90 days).
Errors are `{"detail": "..."}` with status 400 (invalid input), 401 (no or expired token), 403 (wrong role), 404/409/413/503 as noted.

Roles: **family** (`user`), **caretaker**, **elderly**.

## Accounts

| Method and path | Who | Purpose |
|---|---|---|
| `POST /auth/register/` | anyone | `{name, email, password}` (password 6+ characters). Starts as **family**, unless the email was already added as a caretaker or elderly person, in which case the account gets that role. Returns `{token, name, role}`. |
| `POST /auth/login/` | anyone | `{email, password}`. Returns `{token, name, role}`. |
| `GET /me/` | any | The caller's profile: role, the family account that linked them, and the family's caretakers and elderly people (with `pending` invites shown to the family only). |
| `POST /team/` | family | `{email, role: "caretaker" \| "elderly"}`. Converts an existing account, or records an invite for an unregistered email. Rejects your own email, someone already in your circle, and accounts that belong to another family. |

## Family

| Method and path | Purpose |
|---|---|
| `GET /dashboard/` | Everything on the Overview: whether a caretaker and an elderly person are linked (`matched`), today's visit status (`none` / `on_shift` / `paused` / `completed`), the caretaker's to-do list for today, average visit length, visits and chore completion over 7 days, tone shares (with dominant tone and quality rating), recent visits, how each elderly person feels today, medicine adherence, alerts (open first), and unread chat counts. |
| `POST /alerts/<id>/` | `{status: "confirmed" \| "dismissed"}`. The human decision on an alert. |
| `GET /chat/?with=<email>` | The conversation with one person in the circle (marks their messages read). |
| `POST /chat/` | `{to, body}` (max 2,000 characters). Allowed only between a family account and the people it linked (family <-> caretaker, family <-> elderly; **not** caretaker <-> elderly). Also used by caretakers and elderly people to message the family. |
| `POST /medicines/` | `{elderly_email, name, dose?, time: "HH:MM"}`: a daily reminder for one of your elderly people. |
| `DELETE /medicines/<id>/` | Remove a reminder. |

## Caretaker

| Method and path | Purpose |
|---|---|
| `POST /location/` | `{latitude, longitude, accuracy?, mocked?}`. Each phone (caretaker and elderly) reports every 15 s. Only the latest fix is kept. A fix flagged `mocked` is ignored and alerts the family (at most once an hour). Re-checks who is in range. |
| `GET /shift/state/` | Current shift: `none` / `active` (verified in range) / `waiting` (open but not near the elderly person), minutes counted, range state and distance (to 500 m), whether the elderly phone is sharing, and any open emergency. |
| `POST /shift/start/` | Manual start. Only in-range time is counted. 400 if a shift is already running (for example it already started by itself). |
| `POST /shift/stop/` | Manual stop. 400 if nothing is running. |
| `GET /hours/` | Verified minutes for today, this week, this month, all time, and the recent shifts. |
| `GET/POST /tasks/`, `PATCH/DELETE /tasks/<id>/` | The caretaker's own to-do list. `POST {title (max 200), recurring}`; `PATCH {is_done?, recurring?}`. Recurring tasks reset on each working day (Mon to Fri). |
| `POST /audio/tone/` | **Raw audio body** (`Content-Type: audio/wav`, up to 3 MB). Analysed in memory and discarded; only tone totals are kept. Returns `{speech_s, dominant, tones, distress}`. 409 if there is no verified shift running, 413 too large, 400 unreadable, 503 model missing. |

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
| Shift, hours, tasks, audio | no | yes | no |
| Mood check-in, SOS, medicine ticks, elder home | no | no | yes |
| Location | no | yes | yes |
| Chat | with their circle | with the family only | with the family only |
