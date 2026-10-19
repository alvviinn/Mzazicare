"""End-to-end check of POST /api/audio/tone/ against a running local server.

    python -m voice.test_endpoint

Uses clips from RAVDESS actors 21-24 (never seen in training) so the result means something.
Creates throw-away accounts, then deletes them. Needs the backend running on 127.0.0.1:8000.
"""

import io
import json
import sys
import urllib.error
import urllib.request
import wave
from pathlib import Path

import numpy as np

from .data import DATA
from .features import load_audio

BASE = 'http://127.0.0.1:8000/api'
EMOTION = {'angry': '05', 'happy': '03', 'calm': '02'}


def call(method, path, body=None, token=None, raw=None, ctype='application/json'):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data is not None:
        req.add_header('Content-Type', ctype)
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


def clip(emotion, actors=(21, 22, 23, 24), n=4):
    """n clips per held-out speaker of one emotion, joined into one WAV (in memory)."""
    files = []
    for a in actors:
        files += sorted((DATA / 'ravdess' / f'Actor_{a:02d}').glob(f'03-01-{EMOTION[emotion]}-*.wav'))[:n]
    y = np.concatenate([load_audio(str(f)) for f in files])
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())
    return buf.getvalue()


def check(name, ok):
    print(('PASS ' if ok else 'FAIL ') + name)
    if not ok:
        sys.exit(1)


def main():
    for who in ('pat', 'cara', 'ella'):
        call('POST', '/auth/register/', {'name': who.title(), 'email': f'{who}.tone@x.com', 'password': 'secret1'})
    _, p = call('POST', '/auth/login/', {'email': 'pat.tone@x.com', 'password': 'secret1'})
    call('POST', '/team/', {'email': 'cara.tone@x.com', 'role': 'caretaker'}, p['token'])
    call('POST', '/team/', {'email': 'ella.tone@x.com', 'role': 'elderly'}, p['token'])
    _, c = call('POST', '/auth/login/', {'email': 'cara.tone@x.com', 'password': 'secret1'})
    _, e = call('POST', '/auth/login/', {'email': 'ella.tone@x.com', 'password': 'secret1'})

    angry = clip('angry')
    s, r = call('POST', '/audio/tone/', raw=angry, token=c['token'], ctype='audio/wav')
    check('no analysis outside a verified shift (409)', s == 409)

    call('POST', '/location/', {'latitude': -1.2921, 'longitude': 36.8219, 'accuracy': 5}, e['token'])
    call('POST', '/location/', {'latitude': -1.29205, 'longitude': 36.8219, 'accuracy': 5}, c['token'])  # ~5 m away

    s, r = call('POST', '/audio/tone/', raw=angry, token=c['token'], ctype='audio/wav')
    print('   angry clip ->', s, r)
    check('angry speech is analysed during a verified shift', s == 200 and r['speech_s'] > 0)
    check('angry clip: angry is the largest share', r['dominant'] == 'angry')

    s, r = call('POST', '/audio/tone/', raw=clip('happy'), token=c['token'], ctype='audio/wav')
    print('   happy clip ->', s, r)
    check('happy clip analysed', s == 200)

    s, d = call('GET', '/dashboard/', token=p['token'])
    tones = {t['tone']: t['percent'] for t in d['tones']['items']}
    print('   family dashboard tones:', tones, '| quality:', d['tones']['quality'])
    check('family sees tone shares that add to 100', sum(tones.values()) == 100)
    check('family got a vocal-distress alert (needs the human to confirm)', any(a['kind'] == 'vocal_distress' for a in d['alerts']))

    check('not a WAV -> 400', call('POST', '/audio/tone/', raw=b'this is not audio', token=c['token'], ctype='audio/wav')[0] == 400)
    check('elderly account cannot upload (403)', call('POST', '/audio/tone/', raw=angry, token=e['token'], ctype='audio/wav')[0] == 403)
    check('family account cannot upload (403)', call('POST', '/audio/tone/', raw=angry, token=p['token'], ctype='audio/wav')[0] == 403)
    check('oversize clip -> 413', call('POST', '/audio/tone/', raw=b'0' * 3_100_000, token=c['token'], ctype='audio/wav')[0] == 413)
    check('no token -> 401', call('POST', '/audio/tone/', raw=angry, ctype='audio/wav')[0] == 401)
    print('ALL ENDPOINT CHECKS PASSED')


if __name__ == '__main__':
    main()
