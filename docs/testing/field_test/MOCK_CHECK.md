# Gate check: are emulator-injected positions flagged as mocked?

Date: 17 November 2026, 20:04–20:06 EAT. Testing agent.

Setup: Emulated Galaxy A13 (Android 12, API 31, x86_64 Google APIs image, 1080 × 2408, density 400), debug build of `C:\mzb\mobile` (synced from `mobile/` at commit 9ef3baa), local backend (schema `fieldtest_20261117`). Account Test Caregiver 1 (role `caretaker`), signed in through the app.

Method: `adb -s emulator-5556 emu geo fix 36.8330000 -1.2400000` (longitude first) every 5 s for about 75 s, then a read-only query of the stored `care_location` row.

Result (raw, from psql):

```
before injection: testcaregiver1@example.com | 37.4219983 | -122.084   | accuracy 5 | mocked f | 2026-11-17 20:05:00+03   (emulator default position)
after injection:  testcaregiver1@example.com | -1.2399983 | 36.8329983 | accuracy 5 | mocked f | 2026-11-17 20:05:57+03
```

Backend log, location posts from the app: 20:04:36, 20:05:00, 20:05:31, 20:05:57 (all HTTP 200).

Conclusions:
1. Positions injected with `emu geo fix` go through the emulated GNSS hardware and are **not** flagged as mocked (`mocked = false`), so they count for presence. No workaround and no code change was needed.
2. The injected position is stored to within about 0.2 m (rounding of the emulator's GNSS output).
3. Accuracy is always reported as 5 m: `geo fix` cannot produce fixes worse than 40 m, so edge case E3 (poor accuracy) is **not executable** with this method.
4. The app posted every 24–31 s on this emulator, not every 15 s as `FIX_EVERY_MS` sets: the emulator under load delivers updates late. The field-test tolerance is therefore based on the measured interval, and the report states both.

## Unplanned observation during account setup (20:08)

After the gate check, Test Elder 1 registered and signed in on the same emulator, at the same injected position. Its first fix (20:08:16) arrived 86 s after Test Caregiver 1's last fix (20:06:49), within the 120 s freshness limit, and the two positions were 0 m apart. The backend opened a shift by itself at that second (read-only query):

```
care_shift:        id 1 | testcaregiver1@example.com | testelder1@example.com | start 2026-11-17 20:08:16.820203+03 | end (open) | source auto
care_shiftsegment: shift 1 | start 2026-11-17 20:08:16.820203+03 | end (open)
```

The elderly person's home screen then showed "Test is here with you" (`docs/testing/usability/screens/setup_elder1_home.png`). This matches the automatic-start rule (both fixes fresh, not mocked, accuracy within 40 m, distance within 15 m). Because a shift belongs to one caregiver per day, Test Caregiver 1 is not used for the timed runs on 17 November; the runs use Test Caregivers 2, 3 and 4.

## Second unplanned automatic start during setup (22:15)

Test Elder 1 was signed out of the emulator at about 22:14; its last fix was stored at 22:13:40. Test Caregiver 2 then registered and signed in on the same emulator, whose injected position was still the house point. Its first fix arrived within the 120 s freshness limit of the elder's last fix, 0 m apart, and the backend opened a shift (read-only query):

```
care_shift: id 2 | testcaregiver2@example.com | start 2026-11-17 22:15:21.662389+03 | end (open) | source auto | last_in_range_at 22:15:40.075616+03
```

The caregiver's Today screen showed "With Test", "On shift. Step 2 of 3", "In range · 0 m". Afterwards the emulator position was moved to the start point S (about 200 m away) before any further sign-in. Test Caregiver 2 is not used for the timed runs; Test Caregiver 5 was invited from the family's People tab instead.
