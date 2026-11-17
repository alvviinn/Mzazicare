"""Render a saved terminal transcript as a terminal-style PNG (Automation agent).

The text is read from the transcript file and drawn as it is; nothing is retyped. To keep the figure legible, a run of
consecutive per-test lines (backend progress lines, "... ok" lines) longer than KEEP lines is shortened to its first
KEEP lines plus a marked note "[N lines of this output omitted]", and lines wider than WIDTH characters are cut with
an ellipsis. Comment lines that start with "#" (added by the agent's runner) are drawn in grey as the run header.

Usage: python render_terminal.py <transcript.txt> <out.png> [--title "..."]
"""

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH = 118
KEEP = 3
FONT = 'C:/Windows/Fonts/consola.ttf'
SIZE = 15
BG, FG, DIM = (12, 16, 24), (214, 219, 226), (128, 136, 150)
CYAN, GREEN, RED, YELLOW = (86, 196, 230), (98, 204, 120), (240, 98, 98), (232, 196, 90)

DETAIL = re.compile(r'^(test_\w+ \(.*\) \.\.\. |[.]*(Bad Request|Unauthorized|Forbidden|Conflict|Service Unavailable|Not Found)\b|[.]+$)')


def condense(lines):
    out, run = [], []

    def flush():
        if len(run) > KEEP + 1:
            out.extend(run[:KEEP])
            out.append(('note', f'[{len(run) - KEEP} lines of this output omitted]'))
        else:
            out.extend(run)
        run.clear()

    for line in lines:
        if DETAIL.match(line):
            run.append(line)
        else:
            flush()
            out.append(line)
    flush()
    return out


def colour(line):
    if isinstance(line, tuple):
        return YELLOW
    if line.startswith('#'):
        return DIM
    if line.startswith('==>'):
        return CYAN
    if line.startswith('  ok') or line.strip() in ('OK', 'All checks passed.') or line.startswith('OK ('):
        return GREEN
    if 'XX' in line or line.startswith(('FAILED', 'ERROR', 'FAIL:')):
        return RED
    return FG


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    title = sys.argv[sys.argv.index('--title') + 1] if '--title' in sys.argv else 'Windows PowerShell'
    raw = src.read_text(encoding='utf-8', errors='replace').splitlines()
    lines = condense([l.rstrip() for l in raw])
    font = ImageFont.truetype(FONT, SIZE)
    cw = font.getbbox('M')[2]
    lh = int(SIZE * 1.35)
    pad, bar = 18, 34
    w = pad * 2 + cw * WIDTH
    h = bar + pad * 2 + lh * len(lines)
    img = Image.new('RGB', (w, h), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, bar], fill=(34, 40, 52))
    for i, c in enumerate([(237, 106, 94), (245, 191, 79), (98, 197, 84)]):
        d.ellipse([14 + i * 22, 11, 26 + i * 22, 23], fill=c)
    d.text((90, 8), title, font=font, fill=DIM)
    y = bar + pad
    for line in lines:
        text = line[1] if isinstance(line, tuple) else line
        if len(text) > WIDTH:
            text = text[: WIDTH - 1] + '…'
        d.text((pad, y), text, font=font, fill=colour(line))
        y += lh
    img.save(dst)
    print(f'{dst} {w}x{h}px, {len(raw)} transcript lines drawn as {len(lines)}')


if __name__ == '__main__':
    main()
