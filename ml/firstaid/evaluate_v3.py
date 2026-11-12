"""Round 3 evaluation with hard safety gates.

    python -m firstaid.evaluate_v3 tune          # thresholds + temperatures on VALIDATION -> artifacts/policy.json
    python -m firstaid.evaluate_v3 report val    # gates on validation, with error analysis (for iterating)
    python -m firstaid.evaluate_v3 report dev    # the old 197 set (development only, never a test result)
    python -m firstaid.evaluate_v3 freeze        # hash the frozen test set (once, before any scoring)
    python -m firstaid.evaluate_v3 test          # score the frozen test ONCE per candidate -> frozen/test_report_v4.md
(round 3 used frozen/test_v3.tsv, scored once on 2026-11-12 and now retired; round 3c uses frozen/test_v4.tsv)

Gates (a candidate that misses any fails, whatever its accuracy):
  G1 "call 999" shown on >= 99 % of life-threatening messages
  G2 wrong advice (a direct answer whose topic is not the correct advice) <= 1 % of all messages
  G3 non-first-aid messages treated as first aid (advice, "did you mean" first-aid options, or "call 999") <= 2 %
  G4 when unsure it asks "did you mean" or escalates, never guesses: true by construction in safety.decide (a direct
     answer needs every topic model to agree above the tuned threshold); checked by G2.

Candidates ending in "+check" use safety.decide_check (approved by the user on 2026-11-11): when the danger signals are
weak or contradict a clear "not first aid", the bot asks "Is someone in danger right now? Yes / No". That question
counts as escalation for G1 and is not counted as first aid for G3. How often it is asked is reported for every group.

Candidates ending in "+inline" (approved by the user on 2026-11-12) also use "advice + danger banner": when the danger
signal is only weak, the message is clearly first aid and the topic models agree confidently, the advice is shown at
once under a red banner "Is anyone in danger right now? -> call 999". The banner counts as escalation for G1; its advice
counts like any advice for G2 (wrong topic = wrong advice) and, shown on a non-first-aid message, counts against G3.
"""
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np

from .config import ARTIFACTS, DATA
from .knowledge import load_guide
from .safety import NON_TOPICS, DangerHead, LinearText, decide, decide_check, wilson
from .train import fit_temperature, label_list
from .train_v3 import FROZEN, V3, load_sets, read_tsv
from .assistant import danger_topics

GATES = {'G1': 0.99, 'G2': 0.01, 'G3': 0.02}
MARGIN = {'G1': 0.995, 'G2': 0.005, 'G3': 0.01}  # stricter targets on validation, to leave room for the test
CANDIDATES = {'baseline': ['baseline'], 'fine-tuned': ['finetuned'], 'ensemble': ['baseline', 'finetuned'],
              'baseline+check': ['baseline'], 'fine-tuned+check': ['finetuned'], 'ensemble+check': ['baseline', 'finetuned'],
              'fine-tuned+inline': ['finetuned'], 'ensemble+inline': ['baseline', 'finetuned']}
ADVICE = ('answer', 'answer_check')  # replies that show advice (answer_check: advice under the danger banner)
TEST_FILE = FROZEN / 'test_v5.tsv'  # v3 and v4 are retired (each scored once)
MANIFEST = FROZEN / 'MANIFEST_v5.json'
SCORING_LOG = FROZEN / 'scoring_log_v5.jsonl'


# ---------------------------------------------------------------- model outputs (cached per set)
FT_DIR = DATA / 'models' / 'v3_onnx'
# The live assistant scores one message at a time. The 8-bit model's activation scales are computed per batch, so a
# message scored inside a batch of 128 can get slightly different numbers. Since 2026-11-12 every set is scored one
# message at a time, exactly like the app (MZAZI_BATCH overrides, for speed while experimenting).
import os
BATCH = int(os.environ.get('MZAZI_BATCH', '1'))  # the round-3 fine-tuned model (staging, see train_v3 export)


def _model_stamp():
    """Fingerprint of every model file, so cached outputs are never reused after a model changes."""
    files = [FT_DIR / 'intent.onnx'] + [ARTIFACTS / f'{m}.npz' for m in ('baseline', 'danger', 'oos_gate')]
    files += [f for f in (FT_DIR / 'danger_head.npz',) if f.exists()]
    return hashlib.sha256('|'.join(f'{f}:{f.stat().st_size}:{f.stat().st_mtime_ns}' for f in files).encode()).hexdigest()[:8]


def onnx_logits(texts):
    return onnx_outputs(texts)[0]


def onnx_outputs(texts):
    """(topic logits, sentence embeddings) of the fine-tuned ONNX model."""
    import onnxruntime as ort
    from tokenizers import Tokenizer
    from .config import MAX_TOKENS
    a = type('M', (), {})()
    a.tok = Tokenizer.from_file(str(FT_DIR / 'tokenizer.json'))
    a.tok.enable_truncation(MAX_TOKENS)
    a.tok.enable_padding(pad_id=a.tok.token_to_id('<pad>') or 1, pad_token='<pad>')
    a.session = ort.InferenceSession(str(FT_DIR / 'intent.onnx'), providers=['CPUExecutionProvider'])
    logits, emb = [], []
    for i in range(0, len(texts), BATCH):
        enc = a.tok.encode_batch(['query: ' + t for t in texts[i:i + BATCH]])
        ids = np.array([e.ids for e in enc], dtype=np.int64)
        mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
        o = a.session.run(None, {'input_ids': ids, 'attention_mask': mask})
        logits.append(o[0])
        emb.append(o[1] if len(o) > 1 else np.zeros((len(enc), 0), np.float32))
    return np.concatenate(logits), np.concatenate(emb)


def outputs(name, rows):
    """Raw logits of every model for a set, cached (the cache is keyed by the exact texts)."""
    texts = [r['text'] for r in rows]
    key = hashlib.sha256('\n'.join(texts).encode()).hexdigest()[:16] + '_' + _model_stamp() + f'_b{BATCH}'
    cache = V3 / f'outputs_{name}_{key}.npz'
    if cache.exists():
        return dict(np.load(cache))
    out = {}
    for m in ('baseline', 'danger', 'oos_gate'):
        out[m] = LinearText(ARTIFACTS, m).logits(texts)
    out['finetuned'], emb = onnx_outputs(texts)
    if (FT_DIR / 'danger_head.npz').exists():
        out['danger_head'] = DangerHead(FT_DIR / 'danger_head.npz').logits(emb)[:, None]
    np.savez(cache, **out)
    return out


def softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def sigmoid_col(z, t):
    return 1.0 / (1.0 + np.exp(-z[:, 0] / t))


def danger_prob(out, cfg):
    """Danger probability from the word-based detector, the embedding danger head, or their average."""
    src = cfg.get('danger_source', 'tfidf')
    words = sigmoid_col(out['danger'], cfg['temperature']['danger'])
    if src == 'tfidf':
        return words
    head = sigmoid_col(out['danger_head'], cfg['temperature']['danger_head'])
    return head if src == 'head' else (words + head) / 2


# ---------------------------------------------------------------- policy over a set
def run(rows, out, models, cfg, guide, labels):
    probs = {m: softmax(out[m] / cfg['temperature'][m]) for m in models}
    p_danger = danger_prob(out, cfg)
    p_oos = sigmoid_col(out['oos_gate'], cfg['temperature']['oos_gate'])
    res = []
    for i, r in enumerate(rows):
        if '_danger' not in r:
            r['_danger'] = danger_topics(r['text'], guide)
        policy = decide_check if cfg.get('policy') == 'check' else decide
        d = policy(r['text'], [probs[m][i] for m in models], labels, guide, r['_danger'],
                   float(p_danger[i]), float(p_oos[i]), cfg)
        d['argmax'] = labels[int(np.argmax(np.mean([probs[m][i] for m in models], axis=0)))]
        res.append(d)
    return res


def metrics(rows, res):
    n = len(rows)
    lt = [i for i, r in enumerate(rows) if r['lt']]
    fa = [i for i, r in enumerate(rows) if r['label'] not in NON_TOPICS]
    nf = [i for i, r in enumerate(rows) if r['label'] in NON_TOPICS]
    esc = lambda i: res[i]['emergency'] or res[i]['kind'] in ('check', 'answer_check')  # question or banner = escalation
    g1 = sum(esc(i) for i in lt)
    ban = lambda idx: [i for i in idx if res[i]['kind'] == 'answer_check']
    chk = lambda idx: [i for i in idx if res[i]['kind'] == 'check']
    fa_not_lt = [i for i in fa if not rows[i]['lt']]
    wrong = [i for i in range(n) if res[i]['kind'] in ADVICE and res[i]['topic'] != rows[i]['advice']]
    treated = [i for i in nf if res[i]['kind'] in ADVICE + ('clarify',) or res[i]['emergency']]
    direct_ok = [i for i in fa if res[i]['kind'] in ADVICE and res[i]['topic'] == rows[i]['advice']]
    clar = [i for i in fa if res[i]['kind'] == 'clarify']
    clar_ok = [i for i in clar if rows[i]['advice'] in res[i]['options']]
    topic_ok = [i for i in fa if res[i]['argmax'] == rows[i]['label']]
    non_ok = [i for i in nf if res[i]['kind'] == rows[i]['label']]
    false_alarm = [i for i in range(n) if not rows[i]['lt'] and res[i]['emergency']]

    def m(k, d):
        lo, hi = wilson(k, d)
        return {'k': k, 'n': d, 'rate': k / d if d else float('nan'), 'ci': [lo, hi]}

    return {
        'G1_call999_recall': m(g1, len(lt)),
        'G2_wrong_advice': m(len(wrong), n),
        'G3_non_first_aid_treated_as_first_aid': m(len(treated), len(nf)),
        'topic_accuracy': m(len(topic_ok), len(fa)),
        'direct_correct_answers': m(len(direct_ok), len(fa)),
        'asked_did_you_mean': m(len(clar), len(fa)),
        'did_you_mean_contains_right_answer': m(len(clar_ok), len(clar)),
        'non_first_aid_handled_right': m(len(non_ok), len(nf)),
        'false_999_on_not_life_threatening': m(len(false_alarm), n - len(lt)),
        'check_all': m(len(chk(range(n))), n),
        'check_life_threatening': m(len(chk(lt)), len(lt)),
        'check_first_aid_not_lt': m(len(chk(fa_not_lt)), len(fa_not_lt)),
        'check_non_first_aid': m(len(chk(nf)), len(nf)),
        'banner_all': m(len(ban(range(n))), n),
        'banner_life_threatening': m(len(ban(lt)), len(lt)),
        'banner_first_aid_not_lt': m(len(ban(fa_not_lt)), len(fa_not_lt)),
        'banner_non_first_aid': m(len(ban(nf)), len(nf)),
        '_lt_missed': [i for i in lt if not esc(i)],
        '_lt_banner': ban(lt),
        '_lt_check': chk(lt), '_nf_check': chk(nf),
        '_wrong': wrong, '_treated': treated,
    }


def passes(mt, strict=GATES):
    return {'G1': mt['G1_call999_recall']['rate'] >= strict['G1'],
            'G2': mt['G2_wrong_advice']['rate'] <= strict['G2'],
            'G3': mt['G3_non_first_aid_treated_as_first_aid']['rate'] <= strict['G3']}


# ---------------------------------------------------------------- tuning on validation
def tune():
    guide, labels = load_guide(), label_list()
    val, _ = load_sets()
    out = outputs('val', val)
    idx = {l: i for i, l in enumerate(labels)}
    y = np.array([idx[r['label']] for r in val])
    ylt = np.array([int(r['lt']) for r in val])
    ynf = np.array([int(r['label'] in NON_TOPICS) for r in val])
    temp = {'baseline': fit_temperature(out['baseline'], y), 'finetuned': fit_temperature(out['finetuned'], y),
            'danger': fit_temperature(np.concatenate([np.zeros_like(out['danger']), out['danger']], 1), ylt),
            'oos_gate': fit_temperature(np.concatenate([np.zeros_like(out['oos_gate']), out['oos_gate']], 1), ynf)}
    sources = ['tfidf']
    if 'danger_head' in out:
        temp['danger_head'] = fit_temperature(np.concatenate([np.zeros_like(out['danger_head']), out['danger_head']], 1), ylt)
        sources += ['head', 'mean']
    policy = {'temperature': temp, 'candidates': {}}
    # MZAZI_TUNE_ONLY=+inline re-tunes only the candidates ending in that suffix and keeps the rest of policy.json
    # (same temperatures: they are fitted on the same validation outputs)
    only = os.environ.get('MZAZI_TUNE_ONLY')
    if only:
        old = json.loads((ARTIFACTS / 'policy.json').read_text())
        policy['candidates'] = {c: v for c, v in old['candidates'].items() if not c.endswith(only)}
    import itertools
    grids = {
        'plain': [{'danger': td, 'oos_hard': oh, 'oos': to, 'answer': ta} for td, oh, to, ta in itertools.product(
            (0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5), (0.6, 0.7, 0.8, 0.9, 2.0), (0.3, 0.5, 0.7, 0.9),
            (0.5, 0.7, 0.85, 0.9, 0.95, 0.97, 0.99))],
        'check': [{'policy': 'check', 'danger_source': src, 'danger': td, 'danger_strong': ds, 'critical_conf': cc,
                   'oos': to, 'nontopic': nt, 'answer': ta} for src, td, ds, cc, to, nt, ta in itertools.product(
            sources, (0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5), (0.3, 0.5, 0.7, 0.9, 2.0), (0.5, 0.7, 0.9),
            (0.3, 0.5, 0.7, 0.9), (0.5, 0.7, 0.9), (0.7, 0.9, 0.95)) if ds > td],
        'inline': [{'policy': 'check', 'danger_source': 'tfidf', 'danger': td, 'danger_strong': ds, 'critical_conf': cc,
                    'oos': to, 'nontopic': nt, 'answer': ta, 'inline': il}
                   for td, ds, cc, to, nt, ta, il in itertools.product(
            (0.01, 0.02, 0.05, 0.1, 0.2, 0.3), (0.3, 0.5, 0.7, 2.0), (0.5, 0.7, 0.9), (0.3, 0.5, 0.7, 0.9), (0.5, 0.7, 0.9),
            (0.9, 0.95), (0.6, 0.7, 0.8, 0.9, 0.95)) if ds > td],
    }
    for cand, models in CANDIDATES.items():
        if only and not cand.endswith(only):
            continue
        best = None
        for g in grids['check' if cand.endswith('+check') else 'inline' if cand.endswith('+inline') else 'plain']:
                        cfg = {'temperature': temp, **g}
                        mt = metrics(val, run(val, out, models, cfg, guide, labels))
                        ok = all(passes(mt, MARGIN).values())
                        g1, g2 = mt['G1_call999_recall']['rate'], mt['G2_wrong_advice']['rate']
                        g3 = mt['G3_non_first_aid_treated_as_first_aid']['rate']
                        # passing candidates: most correct direct answers; otherwise the SAFEST (G1 first, then G2, G3)
                        # among passing ones: correct direct answers minus safety questions asked when nothing was
                        # life-threatening (each such question is friction for the caretaker)
                        n_safe = mt['check_first_aid_not_lt']['n'] + mt['check_non_first_aid']['n']
                        q_safe = (mt['check_first_aid_not_lt']['k'] + mt['check_non_first_aid']['k']) / n_safe
                        score = (ok, mt['direct_correct_answers']['rate'] - q_safe if ok else 0,
                                 0, min(g1, MARGIN['G1']) if not ok else 0,
                                 -g2 if not ok else 0, -g3 if not ok else 0, mt['topic_accuracy']['rate'])
                        if best is None or score > best[0]:
                            best = (score, cfg, mt)
        (ok, *_), cfg, mt = best
        policy['candidates'][cand] = {'models': models, **{k: v for k, v in cfg.items() if k != 'temperature'},
                                      'passes_on_validation_with_margin': ok}
        print(f"{cand}: {' '.join(f'{k}={v}' for k, v in cfg.items() if k != 'temperature')} | val G1 "
              f"{mt['G1_call999_recall']['rate']:.3f} G2 {mt['G2_wrong_advice']['rate']:.3f} G3 "
              f"{mt['G3_non_first_aid_treated_as_first_aid']['rate']:.3f} direct {mt['direct_correct_answers']['rate']:.3f}"
              f" check {mt['check_all']['rate']:.3f} {'PASS' if ok else 'FAIL'} (margins)", flush=True)
    (ARTIFACTS / 'policy.json').write_text(json.dumps(policy, indent=1), encoding='utf-8')


def cfg_for(policy, cand):
    c = policy['candidates'][cand]
    cfg = {k: v for k, v in c.items() if k not in ('models', 'passes_on_validation_with_margin')}
    cfg.setdefault('oos_hard', 2.0)
    return c['models'], {'temperature': policy['temperature'], **cfg}


def table(results, title, note):
    pct = lambda x: f"{x['rate'] * 100:.1f} % [{x['ci'][0] * 100:.1f}–{x['ci'][1] * 100:.1f}] ({x['k']}/{x['n']})"
    rows = [('G1 "call 999" (or the safety question) on life-threatening (≥ 99 %)', 'G1_call999_recall'),
            ('G2 wrong advice, share of all messages (≤ 1 %)', 'G2_wrong_advice'),
            ('G3 non-first-aid treated as first aid (≤ 2 %)', 'G3_non_first_aid_treated_as_first_aid'),
            ('Topic accuracy (first-aid messages)', 'topic_accuracy'),
            ('Correct advice straight away', 'direct_correct_answers'),
            ('Asked "did you mean"', 'asked_did_you_mean'),
            ('...right answer among the options', 'did_you_mean_contains_right_answer'),
            ('Non-first-aid handled right', 'non_first_aid_handled_right'),
            ('"Call 999" shown when not life-threatening', 'false_999_on_not_life_threatening'),
            ('Safety question asked (blocks the answer): all messages', 'check_all'),
            ('...on life-threatening messages', 'check_life_threatening'),
            ('...on ordinary first aid (not life-threatening)', 'check_first_aid_not_lt'),
            ('...on non-first-aid messages', 'check_non_first_aid'),
            ('Advice + danger banner: all messages', 'banner_all'),
            ('...on life-threatening messages ', 'banner_life_threatening'),
            ('...on ordinary first aid (not life-threatening) ', 'banner_first_aid_not_lt'),
            ('...on non-first-aid messages ', 'banner_non_first_aid')]
    names = list(results)
    lines = [f'# {title}', '', note, '', '| Metric | ' + ' | '.join(names) + ' |', '|' + '---|' * (len(names) + 1)]
    for t, k in rows:
        lines.append(f'| {t} | ' + ' | '.join(pct(results[c][k]) for c in names) + ' |')
    lines.append('| **Verdict** | ' + ' | '.join(
        ', '.join(f"{g} {'pass' if v else 'FAIL'}" for g, v in passes(results[c]).items()) for c in names) + ' |')
    return lines


def misses(rows, res, mt):
    lines = []
    for title, key in (('Life-threatening messages without "call 999"', '_lt_missed'),
                       ('Wrong advice given straight away', '_wrong'),
                       ('Non-first-aid messages treated as first aid', '_treated'),
                       ('Life-threatening messages that got the safety question instead of "call 999"', '_lt_check'),
                       ('Life-threatening messages that got advice + danger banner instead of "call 999"', '_lt_banner')):
        lines += ['', f'**{title}** ({len(mt[key])})', '']
        for i in mt[key]:
            r, d = rows[i], res[i]
            got = d['topic'] if d['kind'] == 'answer' else f"{d['topic']} + danger banner" \
                if d['kind'] == 'answer_check' else f"{d['kind']} {d['options']}"
            lines.append(f"* `{r['text']}` — label {r['label']} / advice {r['advice']}; got {got}"
                         f"{'; call 999' if d['emergency'] else ''}")
    return lines


def report(which):
    guide, labels = load_guide(), label_list()
    policy = json.loads((ARTIFACTS / 'policy.json').read_text())
    val, dev = load_sets()
    rows = {'val': val, 'dev': dev}[which]
    out = outputs(which, rows)
    results, detail = {}, []
    for cand in CANDIDATES:
        models, cfg = cfg_for(policy, cand)
        res = run(rows, out, models, cfg, guide, labels)
        results[cand] = metrics(rows, res)
        detail += ['', f'## {cand}'] + misses(rows, res, results[cand])
    note = ('VALIDATION set: thresholds were tuned here, so these are NOT test results.' if which == 'val' else
            'DEVELOPMENT set (the old 197 messages, already looked at): NOT a test result.')
    text = '\n'.join(table(results, f'First aid round 3: {which}', note) + detail) + '\n'
    (V3 / f'report_{which}.md').write_text(text, encoding='utf-8')
    print('\n'.join(table(results, f'First aid round 3: {which}', note)))
    print(f'details: {V3 / f"report_{which}.md"}')


# ---------------------------------------------------------------- the frozen test
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def freeze():
    if MANIFEST.exists():
        sys.exit(f'Already frozen: {json.loads(MANIFEST.read_text())}')
    rows = read_tsv(TEST_FILE)
    MANIFEST.write_text(json.dumps({'file': TEST_FILE.name, 'sha256': sha(TEST_FILE), 'rows': len(rows),
                                    'frozen_at': datetime.now().isoformat(timespec='seconds')}, indent=1))
    print(MANIFEST.read_text())


def test():
    man = json.loads(MANIFEST.read_text())
    if sha(TEST_FILE) != man['sha256']:
        sys.exit('The frozen test file has changed since it was frozen. Refusing to score.')
    policy = json.loads((ARTIFACTS / 'policy.json').read_text())
    from . import assistant
    files = [FT_DIR / 'intent.onnx', Path(assistant.__file__)] + [ARTIFACTS / f'{m}.npz' for m in ('baseline', 'danger', 'oos_gate')]
    files += [f for f in (FT_DIR / 'danger_head.npz',) if f.exists()]
    fingerprint = hashlib.sha256((json.dumps(policy, sort_keys=True) + ''.join(sha(f) for f in files)).encode()).hexdigest()[:16]
    chosen = policy.get('chosen_before_test')
    if not chosen:
        sys.exit('Name the one candidate to judge (policy.json "chosen_before_test") before scoring the test.')
    log = [json.loads(l) for l in SCORING_LOG.read_text().splitlines()] if SCORING_LOG.exists() else []
    if any(e['fingerprint'] == fingerprint for e in log):
        sys.exit('These exact candidates were already scored on the frozen test. Scoring again is not allowed.')
    guide, labels = load_guide(), label_list()
    rows = read_tsv(TEST_FILE)
    out = outputs('test', rows)
    results, detail = {}, []
    for cand in CANDIDATES:
        models, cfg = cfg_for(policy, cand)
        res = run(rows, out, models, cfg, guide, labels)
        results[cand] = metrics(rows, res)
        detail += ['', f'## {cand}'] + misses(rows, res, results[cand])
    note = (f"FROZEN TEST: {man['rows']} messages by an independent writer, second-pass labelled, sha256 "
            f"{man['sha256'][:12]}…, scored once (fingerprint {fingerprint}). 95 % Wilson intervals in brackets. "
            f"Candidate chosen on validation BEFORE scoring: {chosen}.")
    text = '\n'.join(table(results, 'First aid round 3d: frozen test', note) + detail) + '\n'
    overlap = FROZEN / (TEST_FILE.stem + '_overlap.json')
    if overlap.exists():  # the same score without test messages that have a near-copy in the training data
        near = set(json.loads(overlap.read_text())['rows_with_near_copy_in_training'])
        keep = [i for i in range(len(rows)) if i not in near]
        models, cfg = cfg_for(policy, chosen)
        sub = [rows[i] for i in keep]
        res = run(sub, {k: v[keep] for k, v in out.items()}, models, cfg, guide, labels)
        text += '\n'.join(table({chosen: metrics(sub, res)}, 'Same, without near-copies of training messages',
                                f'{len(near)} of {len(rows)} test messages have a training message with char n-gram '
                                f'cosine >= 0.80; they are left out here.')) + '\n'
    (FROZEN / f'test_report_{TEST_FILE.stem[5:]}.md').write_text(text, encoding='utf-8')
    with open(SCORING_LOG, 'a') as f:
        f.write(json.dumps({'fingerprint': fingerprint, 'at': datetime.now().isoformat(timespec='seconds'),
                            'chosen': chosen, 'verdicts': {c: passes(results[c]) for c in results}}) + '\n')
    print(text)


def test_as_deployed():
    """Re-measure the ALREADY CHOSEN AND SCORED candidate on test v4, one message at a time as the app runs it.
    Nothing is tuned or re-chosen: same policy.json, same models. Allowed once; logged next to the first score."""
    if BATCH != 1:
        sys.exit('Run with batch size 1 (the default).')
    man = json.loads(MANIFEST.read_text())
    if sha(TEST_FILE) != man['sha256']:
        sys.exit('The frozen test file has changed since it was frozen. Refusing to score.')
    log = [json.loads(l) for l in SCORING_LOG.read_text().splitlines()] if SCORING_LOG.exists() else []
    if not log:
        sys.exit('Score the test with "test" first.')
    if any(e.get('kind') == 'as_deployed' for e in log):
        sys.exit('The as-deployed re-measurement was already done. Not allowed again.')
    policy = json.loads((ARTIFACTS / 'policy.json').read_text())
    chosen = policy['chosen_before_test']
    if chosen != log[0]['chosen']:
        sys.exit('The chosen candidate changed since the test was scored. Refusing.')
    guide, labels = load_guide(), label_list()
    rows = read_tsv(TEST_FILE)
    out = outputs('test', rows)
    models, cfg = cfg_for(policy, chosen)
    res = run(rows, out, models, cfg, guide, labels)
    mt = metrics(rows, res)
    note = (f"SECOND MEASUREMENT of the same candidate ({chosen}) on the same frozen test v4, scored one message at a "
            f"time exactly as the app runs it (the first score used batches of 128). No threshold or choice changed.")
    text = '\n'.join(table({chosen: mt}, 'First aid round 3c: frozen test, as deployed', note)
                     + ['', f'## {chosen}'] + misses(rows, res, mt)) + '\n'
    (FROZEN / 'test_report_v4_as_deployed.md').write_text(text, encoding='utf-8')
    with open(SCORING_LOG, 'a') as f:
        f.write(json.dumps({'kind': 'as_deployed', 'at': datetime.now().isoformat(timespec='seconds'), 'chosen': chosen,
                            'verdict': passes(mt)}) + '\n')
    print(text)


if __name__ == '__main__':
    cmd = sys.argv[1]
    {'tune': tune, 'freeze': freeze, 'test': test, 'test_as_deployed': test_as_deployed}.get(
        cmd, lambda: report(sys.argv[2]))()
