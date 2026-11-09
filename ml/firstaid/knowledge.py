"""Reads the first-aid guide (firstaid/knowledge/*.md) into topics, and checks it.

    python -m firstaid.knowledge          # check the guide and write artifacts/guide.json

The guide is the only source of advice the assistant gives. The format is described at the top of
knowledge/01-life-threatening.md.
"""
import json
import re
from pathlib import Path

from .config import ARTIFACTS, KNOWLEDGE

LANGS = ('en', 'sw')
FIELDS = ('intro', 'urgent', 'after')
LISTS = ('steps', 'avoid')


def _split_pair(text):
    """'English | Kiswahili' -> ('English', 'Kiswahili')."""
    parts = [p.strip() for p in text.split('|')]
    if len(parts) != 2 or not all(parts):
        raise ValueError(f'expected "English | Kiswahili", got: {text!r}')
    return parts[0], parts[1]


def parse_file(path):
    topics, topic, section, listname = [], None, None, None
    text = re.sub(r'<!--.*?-->', '', Path(path).read_text(encoding='utf-8'), flags=re.S)
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.rstrip()
        where = f'{Path(path).name}:{n}'
        if not line.strip() or line.startswith('# '):
            continue
        if line.startswith('## '):
            topic = {'id': line[3:].strip(), 'critical': False, 'classify': True, 'keywords': [], 'examples': [],
                     'answer': {lang: {'steps': [], 'avoid': []} for lang in LANGS}, 'followup': None, 'source': where}
            topics.append(topic)
            section, listname = 'head', None
            continue
        if topic is None:
            raise ValueError(f'{where}: text before the first topic')
        if line.startswith('### '):
            section, listname = line[4:].strip(), None
            if section == 'followup':
                topic['followup'] = {'ask': None, 'options': []}
            continue
        if line.startswith('- '):
            item = line[2:].strip()
            if section == 'examples':
                topic['examples'].append(item)
            elif section == 'followup':
                label, goto = item.rsplit('->', 1)
                en, sw = _split_pair(label)
                topic['followup']['options'].append({'label': {'en': en, 'sw': sw}, 'goto': goto.strip()})
            elif section in LANGS and listname in LISTS:
                topic['answer'][section][listname].append(item)
            else:
                raise ValueError(f'{where}: list item outside steps/avoid/examples/followup')
            continue
        key, _, value = line.partition(':')
        key, value = key.strip(), value.strip()
        if section == 'head':
            if key == 'critical':
                topic['critical'] = value == 'yes'
            elif key == 'classify':
                topic['classify'] = value != 'no'
            elif key == 'title':
                en, sw = _split_pair(value)
                topic['title'] = {'en': en, 'sw': sw}
            elif key == 'keywords':
                topic['keywords'] = [k.strip().lower() for k in value.split(',') if k.strip()]
            else:
                raise ValueError(f'{where}: unknown field {key!r}')
        elif section in LANGS:
            if key in LISTS and not value:
                listname = key
            elif key in FIELDS:
                topic['answer'][section][key] = value
                listname = None
            else:
                raise ValueError(f'{where}: unknown field {key!r} in {section}')
        elif section == 'followup' and key == 'ask':
            en, sw = _split_pair(value)
            topic['followup']['ask'] = {'en': en, 'sw': sw}
        else:
            raise ValueError(f'{where}: unexpected line')
    return topics


def load_guide(folder=KNOWLEDGE):
    topics = []
    for path in sorted(Path(folder).glob('*.md')):
        topics += parse_file(path)
    return {t['id']: t for t in topics}


def check(guide):
    """Every problem in the guide, as a list of messages (empty = fine)."""
    problems = []
    ids = set(guide)
    for tid, t in guide.items():
        p = lambda msg: problems.append(f'{tid} ({t["source"]}): {msg}')
        if not re.fullmatch(r'[a-z_]+', tid):
            p('topic id must be lowercase letters and _')
        if 'title' not in t:
            p('no title')
        for lang in LANGS:
            a = t['answer'][lang]
            if not a.get('intro'):
                p(f'no {lang} intro')
            if not a['steps']:
                p(f'no {lang} steps')
            if t['critical'] and not a.get('urgent'):
                p(f'critical topic without an {lang} "urgent" line')
        for name in LISTS:
            if len(t['answer']['en'][name]) != len(t['answer']['sw'][name]):
                p(f'{name}: English has {len(t["answer"]["en"][name])} items, Kiswahili {len(t["answer"]["sw"][name])}')
        for field in FIELDS:
            if bool(t['answer']['en'].get(field)) != bool(t['answer']['sw'].get(field)):
                p(f'"{field}" is in only one language')
        if t['classify'] and len(t['examples']) < 5:
            p(f'only {len(t["examples"])} examples (need 5 or more)')
        if t['classify'] and len(t['keywords']) < 3:
            p('fewer than 3 keywords')
        if t['followup']:
            if not t['followup']['ask']:
                p('followup without a question')
            for o in t['followup']['options']:
                if o['goto'] not in ids:
                    p(f'followup goes to unknown topic {o["goto"]!r}')
    seen = {}
    for tid, t in guide.items():
        for e in t['examples']:
            key = e.lower().strip()
            if key in seen and seen[key] != tid:
                problems.append(f'example "{e}" is in both {seen[key]} and {tid}')
            seen[key] = tid
    return problems


def main():
    guide = load_guide()
    problems = check(guide)
    for msg in problems:
        print('XX', msg)
    if problems:
        raise SystemExit(f'{len(problems)} problem(s) in the guide')
    ARTIFACTS.mkdir(exist_ok=True)
    out = {tid: {k: v for k, v in t.items() if k != 'source'} for tid, t in guide.items()}
    (ARTIFACTS / 'guide.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    n_cls = sum(t['classify'] for t in guide.values())
    n_ex = sum(len(t['examples']) for t in guide.values())
    print(f'ok: {len(guide)} topics ({n_cls} recognisable, {sum(t["critical"] for t in guide.values())} critical), '
          f'{n_ex} hand-written examples -> {ARTIFACTS / "guide.json"}')


if __name__ == '__main__':
    main()
