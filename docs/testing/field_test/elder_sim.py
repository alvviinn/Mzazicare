"""API-level simulation of the elderly person's phone (TC-019). Testing agent, MzaziCare. Approved by the author, 17 Nov 2026.

Signs in as the given elderly account through the same two-step sign-in the app uses (local backend only; the code is
read from the local console-email log), then posts the same request the app's background task sends,
POST /api/location/ {latitude, longitude, accuracy, mocked: false}, at the house H every INTERVAL seconds.
The access token is kept in memory only and never printed or logged. Every post is logged to raw/<run_id>_elder.jsonl.

Usage: python -I elder_sim.py <email> <run_id> <minutes> [--interval 15]
"""

import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = 'http://127.0.0.1:8000'
H = (-1.240000, 36.833000)  # same house point as drive_gps.py
PASSWORD = 'MzTest2026'  # test accounts only
LOG = Path(__file__).resolve().parents[1] / 'logs' / 'backend.log'


def call(path, body, token=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), method='POST',
                                 headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, json.loads(r.read() or b'{}')


def code_from_log(email, after_bytes):
    text = LOG.read_bytes()[after_bytes:].decode('utf-8', 'replace')
    last = None
    for subj, to in re.findall(r'^Subject: Your MzaziCare code: (\d+)\s*$.*?^To: (\S+)', text, re.M | re.S):
        if to.strip().lower() == email:
            last = subj
    return last


def sign_in(email):
    mark = LOG.stat().st_size
    _, r = call('/api/auth/login/', {'email': email, 'password': PASSWORD})
    if 'token' in r:
        return r['token']
    code = r.get('dev_code')
    for _ in range(20):
        code = code or code_from_log(email, mark)
        if code:
            break
        time.sleep(1)
    _, v = call('/api/auth/verify/', {'challenge': r['challenge'], 'code': code})
    return v['token']


def main():
    email, run_id, minutes = sys.argv[1], sys.argv[2], float(sys.argv[3])
    interval = float(sys.argv[sys.argv.index('--interval') + 1]) if '--interval' in sys.argv else 15.0
    out = Path(__file__).parent / 'raw' / f'{run_id}_elder.jsonl'
    out.parent.mkdir(exist_ok=True)
    token = sign_in(email.lower())
    with open(out, 'a', encoding='utf-8') as f:
        def emit(**kw):
            rec = {'t': datetime.now(timezone.utc).astimezone().isoformat(timespec='milliseconds'), 'epoch': round(time.time(), 3), **kw}
            f.write(json.dumps(rec) + '\n'); f.flush(); print(json.dumps(rec), flush=True)  # noqa: E702
        emit(kind='elder_sim_start', email=email, interval_s=interval, house=H, method='API-level simulation')
        end = time.time() + minutes * 60
        while time.time() < end:
            t0 = time.time()
            try:
                status, _ = call('/api/location/', {'latitude': H[0], 'longitude': H[1], 'accuracy': 5, 'mocked': False}, token)
                emit(kind='elder_post', status=status)
            except Exception as e:  # noqa: BLE001
                emit(kind='elder_post_error', error=type(e).__name__)
            time.sleep(max(0, interval - (time.time() - t0)))
        emit(kind='elder_sim_end')


if __name__ == '__main__':
    main()
