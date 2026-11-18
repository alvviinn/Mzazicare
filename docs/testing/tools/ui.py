"""Tiny adb UI helper for the Testing agent (emulator only; reads the screen, never the app's code).

  python ui.py <serial> screen                 list visible texts / hints with their tap centres
  python ui.py <serial> tap "<visible text>"   tap the first element whose text or content-desc contains it
  python ui.py <serial> tapxy <x> <y>          tap a point
  python ui.py <serial> type "<text>"          type into the focused field
  python ui.py <serial> key <KEYCODE>          press a key (BACK, ENTER, HOME, ...)
  python ui.py <serial> shot <out.png>         save a screenshot
  python ui.py <serial> swipe up|down          scroll
Every action is appended to docs/testing/logs/ui_actions.log with a timestamp.
"""

import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ADB = os.path.join(os.environ['LOCALAPPDATA'], 'Android', 'Sdk', 'platform-tools', 'adb.exe')
LOG = Path(__file__).resolve().parents[1] / 'logs' / 'ui_actions.log'


def adb(serial, *args, binary=False):
    r = subprocess.run([ADB, '-s', serial, *args], capture_output=True, timeout=60)
    return r.stdout if binary else r.stdout.decode('utf-8', 'replace')


def log(serial, msg):
    LOG.parent.mkdir(exist_ok=True)
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(f'{datetime.now().isoformat(timespec="seconds")} {serial} {msg}\n')


def nodes(serial):
    for _ in range(3):
        adb(serial, 'shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
        xml = adb(serial, 'exec-out', 'cat', '/sdcard/ui.xml')
        if '<node' in xml:
            break
        time.sleep(2)
    out = []
    for m in re.finditer(r'<node [^>]*?/?>', xml):
        n = m.group(0)
        g = lambda k: (re.search(fr' {k}="([^"]*)"', n) or [None, ''])[1]  # noqa: E731
        text, desc, hint = g('text'), g('content-desc'), g('hint')
        b = re.findall(r'\d+', g('bounds'))
        if not b or not (text or desc or hint):
            continue
        x1, y1, x2, y2 = map(int, b)
        out.append({'text': text, 'desc': desc, 'hint': hint, 'x': (x1 + x2) // 2, 'y': (y1 + y2) // 2,
                    'click': g('clickable') == 'true', 'cls': g('class').split('.')[-1]})
    return out


def main():
    serial, cmd, *rest = sys.argv[1:]
    if cmd == 'screen':
        for n in nodes(serial):
            label = n['text'] or n['desc'] or f"(hint) {n['hint']}"
            print(f"{n['x']:5},{n['y']:5}  {n['cls'][:12]:12} {'*' if n['click'] else ' '} {label[:90]}")
    elif cmd == 'tap':
        want = rest[0].lower()
        cand = [n for n in nodes(serial) if want in (n['text'] + ' ' + n['desc'] + ' ' + n['hint']).lower()]
        if not cand:
            print(f'NOT FOUND: {rest[0]}'); log(serial, f'tap "{rest[0]}" NOT FOUND'); sys.exit(1)  # noqa: E702
        exact = [n for n in cand if want == (n['text'] or n['desc']).lower()]
        n = (exact or cand)[0]
        adb(serial, 'shell', 'input', 'tap', str(n['x']), str(n['y']))
        print(f"tapped '{n['text'] or n['desc'] or n['hint']}' at {n['x']},{n['y']}"); log(serial, f'tap "{rest[0]}" at {n["x"]},{n["y"]}')  # noqa: E702
    elif cmd == 'tapxy':
        adb(serial, 'shell', 'input', 'tap', rest[0], rest[1]); log(serial, f'tapxy {rest[0]},{rest[1]}')  # noqa: E702
    elif cmd == 'type':
        adb(serial, 'shell', 'input', 'text', rest[0].replace(' ', '%s').replace("'", "\\'"))
        log(serial, f'type "{rest[0]}"')
    elif cmd == 'key':
        adb(serial, 'shell', 'input', 'keyevent', f'KEYCODE_{rest[0]}'); log(serial, f'key {rest[0]}')  # noqa: E702
    elif cmd == 'swipe':
        y1, y2 = ('1700', '700') if rest[0] == 'up' else ('700', '1700')
        adb(serial, 'shell', 'input', 'swipe', '540', y1, '540', y2, '300'); log(serial, f'swipe {rest[0]}')  # noqa: E702
    elif cmd == 'shot':
        Path(rest[0]).parent.mkdir(parents=True, exist_ok=True)
        Path(rest[0]).write_bytes(adb(serial, 'exec-out', 'screencap', '-p', binary=True)); log(serial, f'shot {rest[0]}')  # noqa: E702
        print(rest[0])


if __name__ == '__main__':
    main()
