"""Pilot measurements for TC-018 (response times) and TC-020 (security). Automation agent.

Low rate only: one request at a time, 2 s pause. Tokens/passwords live in ../.secrets/state.json (git-ignored), never printed.

  python pilot.py register <key> "<name>"     key in fam1, cg1, el1, fam2 (emails base+auto<key>@gmail.com)
  python pilot.py verify <key> <code>
  python pilot.py team                         fam1 invites cg1 (caretaker) and el1 (elderly); run before registering cg1/el1
  python pilot.py measure                      warm-up 5 + measured 10 (author's choice, 18 Nov 2026), CSV to ../results/
  python pilot.py security                     checklist, JSON to ../results/
"""

import csv
import io
import json
import math
import secrets
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

BASE = 'https://mzazicare-api-1cu8tn.azurewebsites.net'
WEB = 'https://mzazicare-web-1cu8tn.azurewebsites.net'
MAIL = 'alkimani25+auto{}@gmail.com'
HERE = Path(__file__).resolve().parent
SECRETS = HERE.parent / '.secrets'
STATE = SECRETS / 'state.json'
RESULTS = HERE.parent / 'results'
H = (-1.240000, 36.833000)  # synthetic point inside Karura Forest (public reserve)
PAUSE = 2.0
N = 10  # measured calls per operation (author: 'lets just do 10')


def load():
    SECRETS.mkdir(exist_ok=True)
    (SECRETS / '.gitignore').write_text('*\n')
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save(s):
    STATE.write_text(json.dumps(s))


def auth(s, key):
    return {'Authorization': f"Bearer {s[key]['token']}"}


def call(method, path, **kw):
    t0 = time.perf_counter()
    r = requests.request(method, BASE + path, timeout=60, **kw)
    return r, (time.perf_counter() - t0) * 1000


def jpeg():
    """A noisy 1200 x 900 JPEG (about the size of a phone's compressed photo), encoded with PyAV's MJPEG encoder."""
    import av
    import numpy as np
    ctx = av.CodecContext.create('mjpeg', 'w')
    ctx.width, ctx.height, ctx.pix_fmt, ctx.time_base = 1200, 900, 'yuvj420p', __import__('fractions').Fraction(1, 25)
    ctx.options = {'qscale': '6'}
    rgb = np.random.randint(0, 256, (900, 1200, 3), dtype=np.uint8)
    frame = av.VideoFrame.from_ndarray(rgb, format='rgb24').reformat(format='yuvj420p')
    return b''.join(bytes(p) for p in ctx.encode(frame) + ctx.encode(None))


def clip():
    """10 s synthetic mono AAC in MP4 (what the phone sends): a 180 Hz tone with a slow pitch wobble, plus noise."""
    import av
    import numpy as np
    sr = 16000
    t = np.arange(sr * 10) / sr
    x = (0.3 * np.sin(2 * np.pi * (180 + 20 * np.sin(2 * np.pi * 0.5 * t)) * t) + 0.02 * np.random.randn(t.size)).astype(np.float32)
    b = io.BytesIO()
    with av.open(b, 'w', format='mp4') as out:
        st = out.add_stream('aac', rate=sr, layout='mono')
        for i in range(0, x.size, 1024):
            f = av.AudioFrame.from_ndarray(x[i:i + 1024].reshape(1, -1), format='fltp', layout='mono')
            f.sample_rate = sr
            for p in st.encode(f):
                out.mux(p)
        for p in st.encode(None):
            out.mux(p)
    return b.getvalue()


def pct(v, p):
    v = sorted(v)
    return v[max(0, math.ceil(p / 100 * len(v)) - 1)]


def cmd_register(key, name):
    s = load()
    pw = s.get(key, {}).get('password') or secrets.token_urlsafe(16)
    r, _ = call('POST', '/api/auth/register/', json={'name': name, 'email': MAIL.format(key), 'password': pw})
    print(key, r.status_code, r.json().get('detail', 'code sent' if r.ok else r.text[:200]))
    if r.ok:
        s[key] = {'password': pw, 'challenge': r.json()['challenge']}
        save(s)


def cmd_verify(key, code):
    s = load()
    r, _ = call('POST', '/api/auth/verify/', json={'challenge': s[key]['challenge'], 'code': code})
    print(key, r.status_code, 'ok' if r.ok else r.text[:200])
    if r.ok:
        s[key]['token'] = r.json()['token']
        s[key]['role'] = r.json()['role']
        save(s)


def cmd_team():
    s = load()
    for key, role in (('cg1', 'caretaker'), ('el1', 'elderly')):
        r, _ = call('POST', '/api/team/', json={'email': MAIL.format(key), 'role': role}, headers=auth(s, 'fam1'))
        print(key, r.status_code, r.text[:120])


def ensure_shift(s):
    for key, dn in (('el1', 0.0), ('cg1', 3.0)):
        call('POST', '/api/location/', json={'latitude': H[0] + dn / 111320, 'longitude': H[1], 'accuracy': 5, 'mocked': False},
             headers=auth(s, key))


def cmd_measure():
    s = load()
    for key in ('cg1', 'el1'):
        call('POST', '/api/audio/consent/', json={'consent': True}, headers=auth(s, key))
    ensure_shift(s)
    photo, audio = jpeg(), clip()
    stamp = datetime.now().strftime('%Y-%m-%d_%H%M')
    rows = []

    def task_id():
        r, _ = call('POST', '/api/tasks/', json={'caretaker_email': MAIL.format('cg1'), 'title': 'Timing check'},
                    headers=auth(s, 'fam1'))
        return r.json()['id']

    ops = [
        ('Sign in (password step)', N, lambda: call('POST', '/api/auth/login/', json={'email': MAIL.format('fam1'), 'password': s['fam1']['password']})),
        ('Load the family overview', N, lambda: call('GET', '/api/dashboard/', headers=auth(s, 'fam1'))),
        ('Report a location and update the shift', N, lambda: call('POST', '/api/location/', json={'latitude': H[0] + 3 / 111320, 'longitude': H[1], 'accuracy': 5, 'mocked': False}, headers=auth(s, 'cg1'))),
        ('Tick a task with a photograph', N, None),
        ('Analyse a 10-second audio clip', N, lambda: call('POST', '/api/audio/tone/', data=audio, headers={**auth(s, 'cg1'), 'Content-Type': 'audio/mp4'})),
    ]
    for name, n, fn in ops:
        for i in range(5 + n):
            if name.startswith('Tick'):
                tid = task_id()
                time.sleep(PAUSE)
                fn = lambda: call('POST', f'/api/tasks/{tid}/done/', data=photo, headers={**auth(s, 'cg1'), 'Content-Type': 'image/jpeg'})  # noqa: E731
            if name.startswith(('Tick', 'Analyse')) and i % 5 == 0:
                ensure_shift(s)  # keep both phones fresh so the shift stays verified
                time.sleep(PAUSE)
            r, ms = fn()
            rows.append({'operation': name, 'phase': 'warm-up' if i < 5 else 'measured', 'n': i + 1, 'status': r.status_code, 'ms': round(ms, 1), 'at': datetime.now().isoformat(timespec='seconds')})
            print(name[:28], i + 1, r.status_code, round(ms))
            time.sleep(PAUSE)
    path = RESULTS / f'{stamp}_perf.csv'
    with open(path, 'w', newline='') as f:
        w = csv.DictWriter(f, rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    print('\n| Operation | n | Median (ms) | 95th pct (ms) | Max (ms) | Warm-up median (ms) | Non-2xx |')
    for name, _, _ in ops:
        m = [r['ms'] for r in rows if r['operation'] == name and r['phase'] == 'measured']
        wu = [r['ms'] for r in rows if r['operation'] == name and r['phase'] == 'warm-up']
        bad = sum(1 for r in rows if r['operation'] == name and not 200 <= r['status'] < 300)
        print(f'| {name} | {len(m)} | {statistics.median(m):.0f} | {pct(m, 95):.0f} | {max(m):.0f} | {statistics.median(wu):.0f} | {bad} |')
    print(path)


def cmd_security():
    s = load()
    out = []

    def check(name, ok, detail):
        out.append({'check': name, 'pass': bool(ok), 'detail': detail})
        print('PASS' if ok else 'FAIL', name, '-', detail)
        time.sleep(PAUSE)

    r = requests.get(BASE.replace('https://', 'http://') + '/api/', allow_redirects=False, timeout=30)
    check('HTTP redirects to HTTPS', r.status_code in (301, 302, 307, 308) and r.headers.get('Location', '').startswith('https://'), f"{r.status_code} -> {r.headers.get('Location')}")
    r, _ = call('GET', '/api/dashboard/', headers=auth(s, 'fam1'))
    check('HSTS header on API', 'strict-transport-security' in {k.lower() for k in r.headers}, r.headers.get('Strict-Transport-Security', 'missing'))
    r, _ = call('GET', '/no-such-page-xyz/')
    check('DEBUG off (404 shows no debug page)', r.status_code == 404 and 'Traceback' not in r.text and 'URLconf' not in r.text, f'{r.status_code}, {len(r.text)} bytes')
    r, _ = call('OPTIONS', '/api/dashboard/', headers={'Origin': 'https://evil.example', 'Access-Control-Request-Method': 'GET'})
    acao = r.headers.get('Access-Control-Allow-Origin')
    check('CORS refuses an unknown origin', acao not in ('*', 'https://evil.example'), f'{r.status_code}, Access-Control-Allow-Origin={acao}')
    r, _ = call('GET', '/api/dashboard/')
    check('No token -> 401', r.status_code == 401, str(r.status_code))
    r, _ = call('GET', '/api/dashboard/', headers={'Authorization': 'Bearer not.a.token'})
    check('Invalid token -> 401', r.status_code == 401, str(r.status_code))
    shifts, _ = call('GET', '/api/shifts/?days=30', headers=auth(s, 'fam1'))
    ids = [x['id'] for x in shifts.json()] if shifts.ok else []
    if ids and 'fam2' in s:
        r, _ = call('GET', f'/api/shifts/{ids[0]}/', headers=auth(s, 'fam2'))
        check("Other family's shift by ID refused", r.status_code in (403, 404), f'shift {ids[0]} as Auto Family 2 -> {r.status_code}')
    r, _ = call('GET', '/api/tasks/', headers=auth(s, 'el1'))
    check('Elderly account cannot read task lists', r.status_code in (403, 404), str(r.status_code))
    r, _ = call('GET', '/admin/', allow_redirects=False)
    check('Admin not open', r.status_code in (301, 302, 403, 404), f"{r.status_code} {r.headers.get('Location', '')}")
    r, _ = call('POST', '/api/auth/login/', json={'email': MAIL.format('fam1'), 'password': 'wrong-password'})
    check('Wrong password gives a generic error', r.status_code == 400 and 'Incorrect email or password' in r.text, f'{r.status_code}')
    path = RESULTS / f"{datetime.now().strftime('%Y-%m-%d_%H%M')}_security.json"
    path.write_text(json.dumps(out, indent=1))
    print(path)


if __name__ == '__main__':
    c, *a = sys.argv[1:]
    {'register': cmd_register, 'verify': cmd_verify, 'team': cmd_team, 'measure': cmd_measure, 'security': cmd_security}[c](*a)
