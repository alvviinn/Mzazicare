# TC-019 Emulated field test: results

Testing agent, 17 November 2026. Method in `../TEST_PLAN.md` (sections 5 and 8). Every number below comes from the logged runs in `raw/` and read-only database queries, scored by `analyse.py` (per-run output in `results_<run>.md`).

## Set-up (as executed)

- **Caregiver's phone:** Emulated Galaxy A13 (Android 12, API 31, x86_64 image, 1080 × 2408, density 400) running the debug build of the app against a local backend (schema `fieldtest_20261117`). Location injected through the emulator's GNSS with `adb emu geo fix`; stored as `mocked = false`, accuracy 5 m (`MOCK_CHECK.md`). This is an emulator, not a physical phone.
- **Elderly person's phone:** an **API-level simulation** (`elder_sim.py`), approved by the author: signed in as Test Elder 1 and posted the app's location request at the house point every 15 s.
- **Site:** house point H = (-1.240000, 36.833000) inside Karura Forest (no real home). Route points in metres from H: start S about 200 m up the road, gate 30 m, inside 3 m, shop about 150 m, the edge point 18 m, just outside the gate 35 m. Walking pace 1.2 m/s, one injected fix every 2 s.
- **Accounts:** one fresh caregiver account per run (a shift is one per caregiver per day): main run Test Caregiver 3, E1 Test Caregiver 4, E2 Test Caregiver 5.
- **End:** tapped by the agent on the caregiver's Today screen ("End shift", then "END SHIFT" in the confirmation) when the route reached the start point again.

## Scoring rule

Planned crossing times come from the injected route (enter when the distance first reaches 15 m or less; leave when it first exceeds 20 m after being inside), logged by the driver. Recorded times are the shift segment starts and ends in the database. A boundary is detected at the first caregiver post past it, so the **tolerance for each boundary is the caregiver post interval spanning the planned crossing**; a total's tolerance is the sum of its boundaries' tolerances. Pass = |recorded − planned| ≤ tolerance.

This rule was first written as "one measured caregiver post interval from the run's own log" (TEST_PLAN.md section 8, before the runs). During the main run the analysis first used the run-wide largest interval; that interval turned out to be a 69.9 s gap caused by an emulator stall at 22:47, far from any boundary, which would have widened every tolerance. The per-boundary reading was adopted before the edge runs and is applied to all three runs; the run-wide figure is printed for comparison in each `results_<run>.md`.

## Measured post timing (all runs)

| Run | Caregiver posts | Interval median | Min | Max | Position lag while walking (median / max) |
|---|---|---|---|---|---|
| Main (Test Caregiver 3) | 122 | 26.2 s | 22.7 s | 69.9 s (emulator stall) | 1.8 s / 23.6 s |
| E1 (Test Caregiver 4) | 48 | 26.2 s | 23.1 s | 30.1 s | 1.9 s / 23.7 s |
| E2 (Test Caregiver 5) | 41 | 26.2 s | 23.5 s | 28.5 s | 1.9 s / 23.6 s |

The app requests a fix every 15 s (`FIX_EVERY_MS`); on the emulator the posts arrived every 23–30 s. "Position lag" is the time between the injection of a position and the post that reported it; at the start of a walk the emulator sometimes reported a position about 24 s old.

## Main run: approach, 15 min, 10 min break at the shop, 15 min, leave (Test Caregiver 3, 22:22–23:18)

| Boundary | Planned | Recorded | Difference | Tolerance | Pass | First post reporting the crossing | Recorded minus that post |
|---|---|---|---|---|---|---|---|
| Arrive | 22:27:06.6 | 22:27:12.4 | +5.8 s | 28.3 s | yes | 22:27:12.4 | +0.0 s |
| Leave for the shop | 22:42:32.7 | 22:43:21.3 | +48.7 s | 23.4 s | **no** | 22:43:21.4 | −0.0 s |
| Back from the shop | 22:57:38.2 | 22:57:49.6 | +11.4 s | 25.5 s | yes | 22:57:49.6 | +0.0 s |
| Leave | 23:13:04.2 | 23:13:51.7 | +47.5 s | 25.7 s | **no** | 23:13:52.0 | −0.2 s |

| Total | Planned | Recorded | Difference | Tolerance | Pass |
|---|---|---|---|---|---|
| Time counted (in range) | 30.87 min | 32.18 min | +79.0 s | 102.8 s | yes |
| Break | 15.09 min | 14.47 min | −37.3 s | 48.8 s | yes |

The shift started by itself (`source auto`) and had two segments, as planned. After End, the caregiver's screen showed "Done for today. 32 min active today. In 10:27 PM, 1 break", and the shift was stored with `ended_by manual` and end time 23:13:51.7 (the moment the caregiver left range, not the moment End was tapped, as the code intends).

Incidents: (1) at 22:47:27 one `adb emu geo fix` call hung and the driver stopped during the shop break; the emulator kept the shop position, and the driver was restarted at 22:48:09 with the same run id and the planned break end (no boundary fell in the gap). (2) The first "End shift" tap at 23:16:29 missed because the debug build's developer banner (LogBox, not present in release builds) covered the lower half of the button; the banner was dismissed and End was tapped at 23:16:57 and confirmed at 23:17:12.

## E1: standing 18 m away for 5 minutes (Test Caregiver 4, 23:21–23:42)

| Boundary | Planned | Recorded | Difference | Tolerance | Pass | First post reporting the crossing | Recorded minus that post |
|---|---|---|---|---|---|---|---|
| Arrive | 23:26:03.0 | 23:26:40.6 | +37.6 s | 23.5 s | **no** | 23:26:40.6 | +0.0 s |
| Leave | 23:37:01.4 | 23:37:31.1 | +29.8 s | 23.7 s | **no** | 23:37:31.1 | −0.0 s |

| Total | Planned | Recorded | Difference | Tolerance | Pass |
|---|---|---|---|---|---|
| Time counted (in range) | 10.97 min | 10.84 min | −7.9 s | 47.2 s | yes |
| Break | 0 | 0 | 0 | – | yes |

**Edge behaviour (the purpose of E1): pass.** All 14 caregiver posts during the 5-minute stay (23:29:45 to 23:34:54) reported 18.0 m from the elderly person's phone, between the 15 m entry and the 20 m exit radius. The shift stayed in one segment with no break; the screen after End showed "Done for today. 10 min active today. In 11:26 PM" with no break listed.

## E2: out beyond 20 m for under 2 minutes

Test Caregiver 5, 23:46–00:03 (17–18 November). The caregiver walked from inside the house to 35 m outside the gate, stood there 30 s and came back; by the injected route they were beyond 20 m from 23:54:29 to 23:55:29 (60 s), and by the caregiver's posts from 23:54:46 to 23:55:39 (53 s). The code treats a return within `MERGE_GAP_S` = 120 s as GPS noise, so the expected record is one segment and no break; scored with `analyse.py --expect-merged`.

| Boundary | Planned | Recorded | Difference | Tolerance | Pass | First post reporting the crossing | Recorded minus that post |
|---|---|---|---|---|---|---|---|
| Arrive | 23:51:03.2 | 23:51:19.2 | +16.1 s | 26.1 s | yes | 23:51:19.2 | +0.0 s |
| Leave | 23:58:55.2 | 23:59:07.0 | +11.8 s | 28.1 s | yes | 23:59:07.0 | −0.0 s |

| Total | Planned | Recorded | Difference | Tolerance | Pass |
|---|---|---|---|---|---|
| Time counted (in range) | 7.87 min | 7.80 min | −4.3 s | 54.1 s | yes |
| Break | 0 | 0 | 0 | – | yes |

**Edge behaviour (the purpose of E2): pass.** One segment, no break: the 53 s absence was merged as the code intends.

Unplanned: the run crossed midnight. A shift belongs to one calendar day, so when the next request after 00:00 evaluated the caregiver, the engine closed the 17 November shift (`ended_by auto`, end 23:59:07, the time the caregiver left range). At 00:02 the caregiver's Today screen showed "Not on shift. 0 min active today", so there was no shift to End; the "End shift" tap at 00:02:23 found no confirmation dialog. This matches the one-shift-per-day rule (`_close_previous_days` in `presence.py`). Screenshots `screens/e2_cg5_before_end.png`, `e2_cg5_ended.png`.

## E3: fixes with poor accuracy (worse than 40 m)

**Not executable.** `adb emu geo fix` always produces fixes with an accuracy of 5 m, so no fix worse than 40 m could be produced without changing the app or posting fake fixes for the caregiver (outside the approved method).

## What the results show

1. **The server's geofence logic did what the code says, every time.** In every boundary of every run, the shift segment started or ended within 0.2 s of the first caregiver post whose reported position had crossed the boundary. Arrival started a shift automatically, leaving started a break, returning continued the same shift, standing 18 m away did not start a break, and End closed the shift at the time the caregiver left range.
2. **Timing against the planned route was within tolerance for both totals in every run, but 4 of the 8 individual boundaries (2 in the main run, 2 in E1) were later than one post interval.** In each failing case the post just after the crossing still carried the position from before it (about 24 s old), so the crossing was only seen one post later. This is a property of the emulator's location delivery under load, not of the backend; on a phone the delay would depend on its GPS.
3. **Observation (not a defect):** between the caregiver's posts, other requests (the elderly person's phone every 15 s and the app's own status refresh) re-check the shift using the caregiver's last stored position. While that stored position is still inside 20 m, they move "last in range" forward, so a break is stamped when the first out-of-range fix arrives rather than at the last genuine in-range fix. With the 15 s interval of a real phone this adds at most about one interval to the start of a break.
4. **Unplanned evidence of automatic start** during setup (`MOCK_CHECK.md`): twice a shift started on its own as soon as the second phone's first fix arrived next to a fresh fix of the other.

## Verdict for TC-019

**Partly passed (emulated, not a physical-phone field test).**

- Geofence behaviour: **pass** in all three runs. Automatic start, break on leaving, the same shift continuing after the break, no break at 18 m (E1), a short absence merged (E2), End closing the shift at the time the caregiver left range, and the midnight close. In every boundary the server recorded the change within 0.2 s of the first caregiver post that reported the crossing.
- Timing against the planned route: totals within tolerance in all runs (counted time +79.0 s of 30.87 min, −7.9 s of 10.97 min, −4.3 s of 7.87 min; break −37.3 s of 15.09 min). **4 of 8 boundaries** were later than one caregiver post interval (+29.8 to +48.7 s against tolerances of 23.4 to 25.7 s); each traced to the emulator reporting a position about 24 s old in the post after the crossing.
- E3 (poor accuracy) not executable with this method.
- Limits: one emulated phone model; the elderly person's phone simulated at the API level; positions injected (no real GPS error near walls or indoors); post interval about 26 s on the emulator instead of 15 s.
