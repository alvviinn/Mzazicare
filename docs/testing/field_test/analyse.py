"""Score one emulated field run (TC-019): planned boundary times vs what the backend recorded. Testing agent.

Inputs (all logged during the run):
  raw/<run_id>.jsonl          drive_gps.py: every injected fix and every planned crossing (enter <=15 m, exit >20 m)
  raw/<run_id>_cg_posts.tsv   poll_location.sh: each new stored location of the caregiver (read-only polling)
  database (read-only, q.sh)  the caregiver's shift and its segments

Tolerance (TEST_PLAN.md section 8: "one measured caregiver post interval from the run's own log"; detection happens
at the first caregiver post past the boundary): for each boundary, the caregiver post interval that spans the planned
crossing time. A total's tolerance is the sum of the tolerances of the boundaries it depends on.
Pass = |difference| <= tolerance. The run-wide largest interval is also printed for comparison; it is not the verdict
rule, because a stall of the emulator far from any boundary would otherwise widen every tolerance.

With --expect-merged, a planned exit followed by a re-entry within MERGE_GAP_S (120 s, backend/care/presence.py) is
removed from the plan before scoring, because the code treats such a short absence as GPS noise and not as a break
(edge case E2).

Usage: python -I analyse.py <run_id> <caregiver_email> [--expect-merged]
"""

import json
import math
import statistics
import subprocess
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
Q = HERE.parent / 'tools' / 'q.sh'


def ts(s):
    return datetime.fromisoformat(s.strip()).timestamp()


def hm(epoch):
    return datetime.fromtimestamp(epoch).strftime('%H:%M:%S.%f')[:-5]


def sql(query):
    """Read-only query on the field-test schema (same settings as tools/q.sh)."""
    import os
    env = dict(os.environ)
    for line in (HERE.parents[2] / 'backend' / '.env').read_text(encoding='utf-8').splitlines():
        if line.startswith('DB_PASSWORD='):
            env['PGPASSWORD'] = line.split('=', 1)[1].strip()
    env['PGOPTIONS'] = '-c search_path=fieldtest_20261117 -c default_transaction_read_only=on'
    out = subprocess.run([r'C:\Program Files\PostgreSQL\17\bin\psql.exe', '-h', 'localhost', '-U', 'mzazicare',
                          '-d', 'mzazicare', '-At', '-c', query], capture_output=True, text=True, env=env).stdout
    return [l.strip().split('|') for l in out.replace('\r', '').splitlines() if l.strip()]


def main():
    run_id, email = sys.argv[1], sys.argv[2]
    events = [json.loads(l) for l in (HERE / 'raw' / f'{run_id}.jsonl').read_text(encoding='utf-8').splitlines()]
    fixes = [e for e in events if e['kind'] == 'fix']
    planned = [e for e in events if e['kind'] == 'planned']
    posts = []
    for line in (HERE / 'raw' / f'{run_id}_cg_posts.tsv').read_text(encoding='utf-8').splitlines():
        p = line.replace('\r', '').split('|')
        if len(p) >= 5:
            posts.append((ts(p[0]), float(p[1]), float(p[2]), float(p[3]), p[4]))
    t0, t1 = events[0]['epoch'], events[-1]['epoch']
    posts = sorted(set(p for p in posts if t0 - 60 <= p[0] <= t1 + 60))  # a poller restart repeats one line
    gaps = [b[0] - a[0] for a, b in zip(posts, posts[1:])]

    # Position lag: for posts made while walking, when was that exact position injected?
    H = (-1.24, 36.833)
    lags = []
    for p in posts:
        n = (p[1] - H[0]) * 111_320.0
        e = (p[2] - H[1]) * 111_320.0 * math.cos(math.radians(H[0]))
        past = [f for f in fixes if f['epoch'] <= p[0] and math.hypot(f['n'] - n, f['e'] - e) < 1.0]
        if not past:
            continue
        best = past[-1]  # the latest injection of this position before the post
        same = [f for f in fixes if abs(f['n'] - best['n']) < 0.01 and abs(f['e'] - best['e']) < 0.01
                and abs(f['epoch'] - best['epoch']) < 300]
        if len(same) <= 2:  # a walking position (injected once), not a stay
            lags.append(p[0] - best['epoch'])

    rows = sql(f"""select s.id, extract(epoch from s.start_time), s.source, extract(epoch from s.end_time), s.ended_by
                   from care_shift s join accounts_user u on u.id=s.caretaker_id where u.email='{email}' order by s.id""")
    shift = rows[0]
    segs = sql(f'select extract(epoch from start), extract(epoch from "end") from care_shiftsegment where shift_id={shift[0]} order by start')
    segs = [(float(a), float(b) if b else None) for a, b in segs]

    tol = max(gaps)
    post_t = [p[0] for p in posts]

    def pdist(p):
        n = (p[1] - H[0]) * 111_320.0
        e = (p[2] - H[1]) * 111_320.0 * math.cos(math.radians(H[0]))
        return math.hypot(n, e)

    def first_crossing_post(kind, t):
        """The first caregiver post after the planned time whose REPORTED position is past the boundary."""
        for p in posts:
            if p[0] >= t and ((kind == 'enter' and pdist(p) <= 15) or (kind == 'exit' and pdist(p) > 20)):
                return p[0]
        return None

    def span_tol(t):
        before = [x for x in post_t if x <= t]
        after = [x for x in post_t if x > t]
        return (after[0] - before[-1]) if before and after else tol
    recorded = []
    for a, b in segs:
        recorded.append(('enter', a))
        if b:
            recorded.append(('exit', b))
    print(f'# Run {run_id} ({email})\n')
    print(f'Caregiver posts in the run: {len(posts)}; interval median {statistics.median(gaps):.1f} s, '
          f'min {min(gaps):.1f} s, max {tol:.1f} s. Position lag of the emulator (posts while walking, n={len(lags)}): '
          + (f'median {statistics.median(lags):.1f} s, max {max(lags):.1f} s.' if lags else 'n/a.'))
    print(f'Shift {shift[0]}: source {shift[2]}, start {hm(float(shift[1]))}, end '
          f'{hm(float(shift[3])) if shift[3] else "(open)"}, ended_by {shift[4] or "-"}; segments {len(segs)}.\n')
    print('Tolerance per boundary = the caregiver post interval spanning the planned crossing '
          f'(run-wide largest interval, for comparison only: {tol:.1f} s).\n')
    print('| Boundary | Planned | Recorded | Difference (s) | Tolerance (s) | Pass | First post reporting the crossing | Recorded minus that post (s) |')
    print('|---|---|---|---|---|---|---|---|')
    pl = [('enter' if e['event'] == 'enter_15m' else 'exit', e['epoch']) for e in planned]
    notes = []
    if '--expect-merged' in sys.argv:
        merged, i = [], 0
        while i < len(pl):
            if pl[i][0] == 'exit' and i + 1 < len(pl) and pl[i + 1][0] == 'enter' and pl[i + 1][1] - pl[i][1] <= 120:
                notes.append(f'Planned absence {hm(pl[i][1])} to {hm(pl[i + 1][1])} ({pl[i + 1][1] - pl[i][1]:.0f} s) is '
                             'under MERGE_GAP_S (120 s): expected to be merged into one segment, not a break.')
                i += 2
                continue
            merged.append(pl[i]); i += 1  # noqa: E702
        pl = merged
    n = max(len(pl), len(recorded))
    btol = []
    for i in range(n):
        p = pl[i] if i < len(pl) else None
        r = recorded[i] if i < len(recorded) else None
        label = (p or r)[0]
        if p and r and p[0] == r[0]:
            d, bt = r[1] - p[1], span_tol(p[1])
            btol.append(bt)
            fc = first_crossing_post(label, p[1])
            fcs = f'{hm(fc)} | {r[1] - fc:+.1f}' if fc else '- | -'
            print(f'| {label} {i // 2 + 1} | {hm(p[1])} | {hm(r[1])} | {d:+.1f} | {bt:.1f} | {"yes" if abs(d) <= bt else "NO"} | {fcs} |')
        else:
            btol.append(span_tol(p[1]) if p else tol)
            print(f'| {label} {i // 2 + 1} | {hm(p[1]) if p else "(none)"} | {hm(r[1]) if r else "(none)"} | - | - | NO | - | - |')
    # Totals
    def spans(seq):
        out, start = [], None
        for k, t in seq:
            if k == 'enter':
                start = t
            elif start is not None:
                out.append((start, t)); start = None  # noqa: E702
        return out
    ps, rs = spans(pl), spans(recorded)
    p_in, r_in = sum(b - a for a, b in ps), sum(b - a for a, b in rs)
    p_br = sum(b[0] - a[1] for a, b in zip(ps, ps[1:]))
    r_br = sum(b[0] - a[1] for a, b in zip(rs, rs[1:]))
    k = 2 * len(ps)  # boundaries of the closed planned spans
    t_in = sum(btol[:k])
    t_br = sum(btol[1:k - 1]) if len(ps) > 1 else 0.0
    print('\n| Total | Planned | Recorded | Difference (s) | Tolerance (s) | Pass |')
    print('|---|---|---|---|---|---|')
    for name, p, r, t in (('Time in range (counted)', p_in, r_in, t_in), ('Break time', p_br, r_br, t_br)):
        d = r - p
        print(f'| {name} | {p / 60:.2f} min | {r / 60:.2f} min | {d:+.1f} | {t:.1f} | {"yes" if abs(d) <= t else "NO"} |')
    print(f'\nSegments recorded: {len(rs)} (planned {len(ps)}).')
    for note in notes:
        print(f'\n{note}')


if __name__ == '__main__':
    main()
