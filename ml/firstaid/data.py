"""Builds the training and validation sets for the first-aid assistant's question understanding.

    python -m firstaid.data            # writes C:\\mzazicare-data\\firstaid\\{train,val,test}.jsonl and a report

Labels: the 43 recognisable topics of the guide, plus `greeting`, `general_medical` (a health question that is not
first aid) and `out_of_scope` (anything else). Sources:

* hand-written examples from the guide, expanded with realistic variations (typos, Kiswahili/English mixing,
  urgent wording, different people);
* public first-aid questions, labelled with the guide's keywords. A question is kept only if it points to exactly
  one topic, so ambiguous ones are dropped rather than guessed;
* MedQuAD questions (general medicine) that mention none of the topics;
* CLINC150 and Amazon MASSIVE (English and Kiswahili) everyday requests, and their greetings.

Validation data never shares a seed example, a public source or a dataset partition with training, and anything
that also appears in the test set is removed from both.
"""
import ast
import hashlib
import json
import random
import re
from collections import Counter, defaultdict

import pandas as pd

from .config import DATA, GREETING, HERE, OUT_OF_SCOPE, RAW
from .knowledge import load_guide

GENERAL_MEDICAL = 'general_medical'
VAL_SOURCES = {'lextale_firstaid', 'belvisk', 'baddoub'}  # public first-aid sets kept for validation only
CAP_TOPIC = 1600          # most training examples per first-aid topic
CAP = {OUT_OF_SCOPE: 14000, GENERAL_MEDICAL: 4000, GREETING: 2500}

SW_WORDS = set('''na ya wa kwa ni la za je nini gani vipi mtu yeye wake yake huyo hii hiyo sana tu bado kama lakini au
amekuwa ame ana anaweza hawezi hana hajui nifanye nimpe nini tafadhali haraka msaada nisaidie mzee bibi babu mgonjwa
mama baba damu kichwa tumbo kifua mguu mkono jicho pua koo moto maji dawa sukari homa pumzi kupumua amezimia ameanguka
anatapika anahara kiharusi kifafa degedege nyoka nyuki mbwa sumu baada kabla leo jana asubuhi usiku ghafla kidogo
nyingi mingi zaidi'''.split())


def lang_of(text):
    """'sw', 'en' or 'mixed', from the share of common Kiswahili words."""
    words = re.findall(r"[a-z']+", text.lower())
    if not words:
        return 'en'
    sw = sum(w in SW_WORDS or w.startswith(('ame', 'ana', 'hawe', 'hata', 'nime', 'ni', 'ku', 'wa')) and len(w) > 4
             and w not in ENGLISH_COMMON for w in words)
    share = sw / len(words)
    return 'sw' if share >= 0.5 else 'mixed' if share >= 0.2 else 'en'


ENGLISH_COMMON = set('''what water want wait walk warm wash watch was way wake wanted kind kidney kill kitchen nine nice night
nitrogen know knee knife knock kurt'''.split())


def norm(text):
    return re.sub(r'\s+', ' ', re.sub(r"[^\w\s']", ' ', text.lower())).strip()


def bucket(text, salt=''):
    """Stable 0-99 number for a text (for splits that do not change between runs)."""
    return int(hashlib.md5((salt + norm(text)).encode()).hexdigest(), 16) % 100


# ---------------------------------------------------------------- realistic variations
PEOPLE_EN = ['he', 'she', 'my patient', 'grandma', 'grandpa', 'the old man', 'the old lady', 'my client', 'mum', 'dad',
             'the elderly man', 'my mother', 'my father', 'mzee', 'bibi']
PEOPLE_SW = ['mzee', 'bibi', 'babu', 'mgonjwa', 'mama', 'baba', 'mzee wangu', 'bibi yangu', 'mgonjwa wangu']
PRE_EN = ['', '', '', 'please help ', 'help! ', 'urgent ', 'quick question ', 'i am a caretaker and ', 'what do i do ',
          'emergency ', 'hi ', 'pls ', 'i need help ']
SUF_EN = ['', '', '', ' what do i do', ' please help', ' what should i do now', '?', ' help', ' pls', ' urgently']
PRE_SW = ['', '', '', 'tafadhali ', 'msaada ', 'haraka ', 'nisaidie ', 'naomba ushauri ', 'habari ', 'dharura ']
SUF_SW = ['', '', '', ' nifanye nini', ' tafadhali', ' nisaidie', ' haraka', ' nifanyeje', ' saidia']
SHORT = {'please': 'pls', 'you': 'u', 'what': 'wat', 'because': 'coz', 'are': 'r', 'okay': 'ok', 'tafadhali': 'tafadhli'}
SUBJECT = re.compile(r'\b(he|she|grandma|grandpa|my patient|the old man|mzee|bibi|babu|mgonjwa)\b')


def typo(word, rng):
    if len(word) < 4:
        return word
    i = rng.randrange(1, len(word) - 1)
    kind = rng.random()
    if kind < 0.35:
        return word[:i] + word[i + 1] + word[i] + word[i + 2:]  # swap
    if kind < 0.65:
        return word[:i] + word[i + 1:]  # drop
    if kind < 0.85:
        return word[:i] + word[i] + word[i:]  # double
    return word[:i] + rng.choice('aeiou') + word[i + 1:]  # wrong vowel


def vary(text, lang, rng):
    t = text.lower()
    m = SUBJECT.search(t)
    if m and rng.random() < 0.6:
        t = t[:m.start()] + rng.choice(PEOPLE_SW if lang == 'sw' else PEOPLE_EN) + t[m.end():]
    mixed = rng.random() < 0.15  # code-switching: English frame on Kiswahili text and the other way round
    use_sw = (lang == 'sw') != mixed
    t = rng.choice(PRE_SW if use_sw else PRE_EN) + t + rng.choice(SUF_SW if use_sw else SUF_EN)
    words = t.split()
    if rng.random() < 0.5:
        words = [typo(w, rng) if rng.random() < 0.08 else w for w in words]
    if rng.random() < 0.2:
        words = [SHORT.get(w, w) for w in words]
    if len(words) > 4 and rng.random() < 0.1:
        del words[rng.randrange(len(words))]
    t = ' '.join(words)
    if rng.random() < 0.5:
        t = re.sub(r'[?.!,]', '', t)
    if rng.random() < 0.1:
        t = t.capitalize()
    return t.strip()


# ---------------------------------------------------------------- keyword labelling of public questions
def keyword_matcher(guide):
    entries = []
    for tid, t in guide.items():
        if not t['classify']:
            continue
        for k in t['keywords']:
            entries.append((k, tid))
    entries.sort(key=lambda e: -len(e[0]))
    patterns = [(re.compile(r'\b' + re.escape(k) + r'\b'), k, tid) for k, tid in entries]

    def topics(text):
        t = text.lower()
        spans = []
        for rx, k, tid in patterns:
            for m in rx.finditer(t):
                if not any(s <= m.start() and m.end() <= e for s, e, _ in spans):  # inside a longer match: skip
                    spans.append((m.start(), m.end(), tid))
        return {tid for _, _, tid in spans}
    return topics


def public_first_aid():
    """(question, source) from the public first-aid datasets."""
    out = []
    for q in json.loads((RAW / 'i-am-mushfiq__FirstAidQA/firstaidqa_v1.json').read_text(encoding='utf-8')):
        out.append((q['question'], 'firstaidqa'))
    out += [(q, 'alexxxmf') for q in pd.read_json(RAW / 'alexxxmf__firstaid_qa/train.jsonl', lines=True).question]
    out += [(q, 'lextale_firstaid') for q in
            pd.read_parquet(RAW / 'lextale__FirstAidInstructionsDataset/data/FirstAidQA-00000-of-00001.parquet').question]
    out += [(q, 'belvisk') for q in pd.read_csv(RAW / 'belvisk__First-Aid-Dataset/merged_data.csv').question]
    for part in ('training', 'validation'):
        out += [(q, 'baddoub') for q in pd.read_csv(RAW / f'Baddoub__First-Aid-Dataset/{part}/merged_data.csv').question]
    for part in ('train', 'test'):
        out += [(q, 'adv010') for q in pd.read_parquet(RAW / f'adv010__first-aid-synth/data/{part}-00000-of-00001.parquet').question]
    for intent in json.loads((RAW / 'badri55__First_aid__dataset/first_aid1.json').read_text(encoding='utf-8')):
        out += [(p, 'badri55') for p in intent['patterns']]
    triage = pd.read_parquet(RAW / 'sweatSmile__medical-symptom-triage-conversational/data/train-00000-of-00001.parquet')
    for msgs in triage.messages:  # stored as the text of a Python list of {role, content}
        user = [m['content'] for m in ast.literal_eval(msgs) if m['role'] == 'user']
        m = re.search(r'Symptoms:\s*(.+)', user[0]) if user else None
        if m:  # the patient's own words: keep the first two sentences
            out.append((' '.join(re.split(r'(?<=[.!?])\s+', m.group(1))[:2]), 'triage'))
    return [(str(q).strip(), s) for q, s in out if isinstance(q, str) and 8 <= len(q) <= 300]


GREETINGS = {
    'en': ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'thank you', 'thanks', 'thanks a lot',
           'ok thanks', 'bye', 'goodbye', 'see you', 'who are you', 'what can you do', 'what can you help me with',
           'are you a doctor', 'are you a real person', 'how does this work', 'hi there can you help me',
           'thank you it worked', 'ok', 'alright thanks', 'you are helpful', 'what is your name'],
    'sw': ['habari', 'habari yako', 'hujambo', 'mambo', 'sasa', 'niaje', 'salama', 'asante', 'asante sana', 'shukrani',
           'kwaheri', 'tutaonana', 'wewe ni nani', 'unaweza kunisaidia na nini', 'wewe ni daktari', 'habari za asubuhi',
           'habari za jioni', 'shikamoo', 'sawa asante', 'umenisaidia sana', 'unaitwa nani', 'unafanya kazi aje',
           'karibu', 'poa', 'mambo vipi'],
}
CLINC_SMALLTALK = {82, 114, 124, 115, 117, 96, 75, 99, 77, 57}  # greeting, goodbye, thank_you, what_can_i_ask_you...


def build():
    rng = random.Random(0)
    guide = load_guide()
    match = keyword_matcher(guide)
    rows = {'train': [], 'val': []}
    report = defaultdict(Counter)

    def add(split, text, label, source):
        rows[split].append({'text': text, 'label': label, 'source': source})
        report[split][source] += 1

    # 1. hand-written guide examples and their variations (a seed and its variations stay in one split)
    for tid, t in guide.items():
        if not t['classify']:
            continue
        for ex in t['examples']:
            split = 'val' if bucket(ex, 'seed') < 15 else 'train'
            lang = 'sw' if lang_of(ex) == 'sw' else 'en'
            add(split, ex, tid, 'guide')
            n = 40 if lang == 'sw' else 28
            seen = {norm(ex)}
            for _ in range(n):
                v = vary(ex, lang, rng)
                if norm(v) not in seen:
                    seen.add(norm(v))
                    add(split, v, tid, 'guide_variation')

    # 2. public first-aid questions labelled by keywords (kept only when exactly one topic matches)
    public = public_first_aid()
    labelled = ambiguous = unmatched = 0
    for q, src in public:
        found = match(q)
        if len(found) == 1:
            labelled += 1
            tid = found.pop()
            split = 'val' if src in VAL_SOURCES else 'train'
            add(split, q, tid, f'public:{src}')
            if split == 'train' and rng.random() < 0.5:
                add(split, vary(q, 'en', rng), tid, f'public:{src}:variation')
        elif found:
            ambiguous += 1
        else:
            unmatched += 1
    report['labelling'].update(labelled=labelled, ambiguous_dropped=ambiguous, no_topic_dropped=unmatched)

    # 3. general medical questions (MedQuAD) that do not mention any first-aid topic
    medq = pd.read_parquet(RAW / 'lextale__FirstAidInstructionsDataset/data/MedQuAD-00000-of-00001.parquet').question
    medq = [q for q in dict.fromkeys(medq) if isinstance(q, str) and not match(q)]
    rng.shuffle(medq)
    for q in medq:
        add('val' if bucket(q, 'medq') < 12 else 'train', q, GENERAL_MEDICAL, 'medquad')

    # 4. greetings and small talk
    for lang, items in GREETINGS.items():
        for g in items:
            split = 'val' if bucket(g, 'greet') < 20 else 'train'
            add(split, g, GREETING, 'greeting')
            for _ in range(12):
                add(split, vary(g, lang, rng), GREETING, 'greeting_variation')

    # 5. everyday requests: CLINC150 (English) and MASSIVE (English and Kiswahili)
    for part, split in (('train', 'train'), ('validation', 'val')):
        c = pd.read_parquet(RAW / f'clinc__clinc_oos/plus/{part}-00000-of-00001.parquet')
        for text, intent in zip(c.text, c.intent):
            add(split, text, GREETING if intent in CLINC_SMALLTALK else OUT_OF_SCOPE, 'clinc')
    for lang in ('en-US', 'sw-KE'):
        m = pd.read_json(RAW / f'massive/{lang}.jsonl', lines=True)
        for text, intent, part in zip(m.utt, m.intent, m.partition):
            if part == 'test':
                continue  # MASSIVE test is left untouched
            label = GREETING if intent == 'general_greet' else OUT_OF_SCOPE
            add('val' if part == 'dev' else 'train', text, label, f'massive_{lang[:2]}')

    # test set (hand-written, held out)
    test = []
    for line in (HERE / 'eval/test_questions.tsv').read_text(encoding='utf-8').splitlines():
        if line.strip() and not line.startswith('#'):
            label, q = line.split('\t', 1)
            test.append({'text': q, 'label': label, 'source': 'test'})
    test_keys = {norm(r['text']) for r in test}

    # remove overlaps: test beats val beats train
    val_keys = {norm(r['text']) for r in rows['val']}
    removed = Counter()
    rows['val'] = [r for r in rows['val'] if norm(r['text']) not in test_keys or removed.update(['val_in_test'])]
    rows['train'] = [r for r in rows['train']
                     if (norm(r['text']) not in test_keys and norm(r['text']) not in val_keys) or removed.update(['train_in_val_or_test'])]
    # exact duplicates inside a split, and texts with two labels
    for split in rows:
        seen, keep = {}, []
        for r in rows[split]:
            k = norm(r['text'])
            if k in seen:
                removed[f'{split}_duplicate'] += 1
                continue
            seen[k] = r['label']
            keep.append(r)
        rows[split] = keep

    # caps, so the large sources do not drown the topics
    rng.shuffle(rows['train'])
    count, keep = Counter(), []
    for r in rows['train']:
        cap = CAP.get(r['label'], CAP_TOPIC)
        if count[r['label']] < cap:
            count[r['label']] += 1
            keep.append(r)
    rows['train'] = keep
    rows['test'] = test

    DATA.mkdir(parents=True, exist_ok=True)
    for split, items in rows.items():
        for r in items:
            r['lang'] = lang_of(r['text'])
        with open(DATA / f'{split}.jsonl', 'w', encoding='utf-8') as f:
            for r in items:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
    return rows, report, removed


def main():
    rows, report, removed = build()
    lines = ['# First-aid assistant: training data', '']
    for split in ('train', 'val', 'test'):
        items = rows[split]
        labels = Counter(r['label'] for r in items)
        langs = Counter(r['lang'] for r in items)
        topics = [l for l in labels if l not in (OUT_OF_SCOPE, GENERAL_MEDICAL, GREETING)]
        lines.append(f'{split}: {len(items)} examples, {len(topics)} topics; languages {dict(langs)}; '
                     f'out_of_scope {labels[OUT_OF_SCOPE]}, general_medical {labels[GENERAL_MEDICAL]}, greeting {labels[GREETING]}; '
                     f'per topic min {min(labels[t] for t in topics)} / max {max(labels[t] for t in topics)}')
    lines.append(f'keyword labelling of public questions: {dict(report["labelling"])}')
    lines.append(f'sources (train): {dict(report["train"].most_common())}')
    lines.append(f'removed: {dict(removed)}')
    text = '\n'.join(lines)
    print(text)
    (DATA / 'data_report.txt').write_text(text, encoding='utf-8')


if __name__ == '__main__':
    main()
