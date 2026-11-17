"""Emulated field test driver (TC-019). Testing agent, MzaziCare.

Drives the caregiver emulator's GPS with `adb -s <serial> emu geo fix <lon> <lat>` along a timed route and keeps the
elderly person's emulator fixed at the house. Every injected fix and every planned boundary crossing is logged with
the host clock (the backend runs on the same host, so both use one clock).

Site model: a standalone house in a Nairobi estate, placed on a coordinate inside Karura Forest (a public forest
reserve) so that no real home is used. Offsets are in metres north/east of the house H.

Usage: python -I drive_gps.py <scenario> <caregiver_serial> <elder_serial> <run_id> [--speed 1.0]
Scenarios: main, e1_near_edge, e2_short_out, e3_poor_accuracy (e3 requires a working accuracy control).
"""

import json
import math
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

H = (-1.240000, 36.833000)  # the house (elderly person's phone), inside Karura Forest
ENTER, EXIT = 15.0, 20.0  # metres, from backend/care/presence.py
WALK = 1.2  # m/s walking pace
STEP_S = 2.0  # seconds between injected caregiver fixes

# Points: metres (north, east) from H
P = {
    'I': (3, 0),  # inside the house, sitting room
    'G': (30, 0),  # gate
    'R': (60, 0),  # road outside the gate
    'S': (60, -190),  # start: up the road, about 200 m away
    'K': (60, 137),  # shop, about 150 m away
    'Y18': (0, 18),  # inside the yard 18 m from the elderly person's phone
    'O35': (35, 0),  # just outside the gate, 35 m away
}


def to_latlon(n, e):
    lat = H[0] + n / 111_320.0
    lon = H[1] + e / (111_320.0 * math.cos(math.radians(H[0])))
    return lat, lon


def dist(n, e):
    return math.hypot(n, e)


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec='milliseconds')


class Driver:
    def __init__(self, cg, elder, log_path):
        self.cg, self.elder = cg, elder
        self.log = open(log_path, 'a', encoding='utf-8')
        self.pos = P['S']
        self.inside = False  # state relative to the hysteresis: entered at <=15, left at >20
        self.last_elder = 0.0

    def emit(self, kind, **kw):
        rec = {'t': now_iso(), 'epoch': round(time.time(), 3), 'kind': kind, **kw}
        self.log.write(json.dumps(rec) + '\n')
        self.log.flush()
        print(json.dumps(rec), flush=True)

    def geo(self, serial, n, e):
        lat, lon = to_latlon(n, e)
        subprocess.run(['adb', '-s', serial, 'emu', 'geo', 'fix', f'{lon:.7f}', f'{lat:.7f}'],
                       capture_output=True, timeout=15)
        return lat, lon

    def fix(self, n, e):
        """Inject one caregiver fix; re-assert the elderly phone every 5 s; log planned crossings."""
        if time.time() - self.last_elder >= 5:
            self.geo(self.elder, 0, 0)
            self.last_elder = time.time()
        lat, lon = self.geo(self.cg, n, e)
        d = dist(n, e)
        self.pos = (n, e)
        self.emit('fix', n=n, e=e, lat=round(lat, 7), lon=round(lon, 7), d_m=round(d, 1))
        if not self.inside and d <= ENTER:
            self.inside = True
            self.emit('planned', event='enter_15m', d_m=round(d, 1))
        elif self.inside and d > EXIT:
            self.inside = False
            self.emit('planned', event='exit_20m', d_m=round(d, 1))

    def walk(self, to):
        n0, e0 = self.pos
        n1, e1 = P[to] if isinstance(to, str) else to
        length = math.hypot(n1 - n0, e1 - e0)
        steps = max(1, math.ceil(length / (WALK * STEP_S)))
        self.emit('walk', to=to, metres=round(length, 1))
        for i in range(1, steps + 1):
            t0 = time.time()
            self.fix(n0 + (n1 - n0) * i / steps, e0 + (e1 - e0) * i / steps)
            time.sleep(max(0, STEP_S - (time.time() - t0)))

    def stay(self, seconds, label):
        self.emit('stay', label=label, seconds=seconds)
        end = time.time() + seconds
        while time.time() < end:
            t0 = time.time()
            self.fix(*self.pos)
            time.sleep(max(0, min(STEP_S, end - time.time()) - (time.time() - t0)))


def scenario(d, name, speed):
    m = lambda minutes: int(minutes * 60 / speed)  # noqa: E731
    d.stay(60, 'start on the road, both phones settle')
    d.walk('R'); d.walk('G'); d.walk('I')  # noqa: E702
    if name == 'main':
        d.stay(m(15), 'first stay')
        d.walk('G'); d.walk('R'); d.walk('K')  # noqa: E702
        d.stay(m(10), 'break at the shop')
        d.walk('R'); d.walk('G'); d.walk('I')  # noqa: E702
        d.stay(m(15), 'second stay')
    elif name == 'e1_near_edge':
        d.stay(m(3), 'settle inside')
        d.walk('Y18')
        d.stay(m(5), 'standing 18 m away (inside the 20 m exit limit)')
        d.walk('I')
        d.stay(m(2), 'back inside')
    elif name == 'e2_short_out':
        d.stay(m(3), 'settle inside')
        d.walk('O35')
        d.stay(30, 'just outside the gate, under 2 minutes in all')
        d.walk('I')
        d.stay(m(3), 'back inside')
    else:
        raise SystemExit(f'unknown scenario {name}')
    d.walk('G'); d.walk('R'); d.walk('S')  # noqa: E702
    d.stay(90, 'gone; End is tapped now (logged separately)')
    d.emit('end_of_route')


if __name__ == '__main__':
    name, cg, elder, run_id = sys.argv[1:5]
    speed = float(sys.argv[sys.argv.index('--speed') + 1]) if '--speed' in sys.argv else 1.0
    out = Path(__file__).parent / 'raw' / f'{run_id}.jsonl'
    out.parent.mkdir(exist_ok=True)
    drv = Driver(cg, elder, out)
    drv.emit('run_start', scenario=name, caregiver=cg, elder=elder, run_id=run_id, house=H)
    scenario(drv, name, speed)
