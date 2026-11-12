"""Round 3: caretaker-style data, a danger detector and an out-of-scope gate (see safety.py and evaluate_v3.py).

    python -m firstaid.train_v3 data      # build train/val v3 (near-duplicates of val/test removed from training)
    python -m firstaid.train_v3 linear    # train + export the baseline topic model, danger detector, out-of-scope gate

Sets (tab-separated: topic, life_threatening, advice_id, lang, message):
* frozen test   C:\\mzazicare-data\\firstaid\\frozen\\test_v3.tsv   written by an independent writer, never used here
                except to REMOVE near-duplicates from training. Scored once per final candidate by evaluate_v3.
* validation    handoff/val_caretaker.tsv (independent writer) + eval/test_questions_2.tsv (unscored, caretaker style).
                Used for C, temperatures and thresholds, and for error analysis.
* development   eval/test_questions.tsv (197, already looked at): an extra check only, never reported as a test.
* training      the earlier training data (public datasets, guide examples, variations; the old validation split is
                folded in) + caretaker-style training messages (handoff/train_caretaker_part*.tsv), oversampled, with
                typo variations.
"""
import json
import os
import random
import sys
import time
import zlib
from pathlib import Path

import numpy as np

from .config import ARTIFACTS, DATA, HERE
from .data import lang_of, vary
from .knowledge import load_guide
from .train import NON_TOPICS, fit_temperature, label_list, macro_f1

FROZEN = DATA / 'frozen'
HANDOFF = DATA / 'handoff'
V3 = DATA / 'v3'
DUP_COSINE = 0.80  # training messages this similar (char n-gram TF-IDF cosine) to a val/test message are dropped
OVERSAMPLE = 3  # caretaker-style training messages count this many times (plus typo variations)


def read_tsv(path):
    rows = []
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        parts = line.split('\t')
        if parts[0] == 'topic':  # header
            continue
        if len(parts) == 2:  # older two-column sets: label, message
            label, text = parts
            rows.append({'label': label, 'lt': None, 'advice': label, 'lang': lang_of(text), 'text': text.strip()})
        elif len(parts) == 5:
            label, lt, advice, lang, text = parts
            rows.append({'label': label.strip(), 'lt': lt.strip() == 'yes', 'advice': advice.strip(), 'lang': lang.strip(),
                         'text': text.strip()})
    return rows


def fill_lt(rows, guide):
    """Two-column sets have no per-message life_threatening label: use the topic's own flag."""
    for r in rows:
        if r['lt'] is None:
            r['lt'] = bool(r['label'] in guide and guide[r['label']]['critical'])
    return rows


def load_sets():
    guide = load_guide()
    val = fill_lt(read_tsv(HANDOFF / 'val_caretaker.tsv') + read_tsv(HERE / 'eval/test_questions_2.tsv'), guide)
    dev = fill_lt(read_tsv(HERE / 'eval/test_questions.tsv'), guide)
    return val, dev


def near_duplicates(candidates, references, threshold=DUP_COSINE):
    """Indices of candidate texts whose char n-gram TF-IDF cosine to any reference text is >= threshold."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), sublinear_tf=True).fit(candidates + references)
    A, B = vec.transform(candidates), vec.transform(references)
    drop = set()
    for s in range(0, A.shape[0], 4000):
        sim = (A[s:s + 4000] @ B.T).max(axis=1).toarray().ravel()
        drop.update(int(s + i) for i in np.nonzero(sim >= threshold)[0])
    return drop


def build_data():
    rng = random.Random(3)
    guide = load_guide()
    labels = set(label_list())
    test = [r for f in ('test_v3.tsv', 'test_v4.tsv') if (FROZEN / f).exists() for r in read_tsv(FROZEN / f)]
    val, dev = load_sets()
    old = [json.loads(l) for f in ('train.jsonl', 'val.jsonl') for l in open(DATA / f, encoding='utf-8')]
    rows = [{'text': r['text'], 'label': r['label'], 'lt': bool(r['label'] in guide and guide[r['label']]['critical']),
             'source': r['source']} for r in old]
    care = []
    parts = ('train_caretaker_part*.tsv', 'train_negatives_part*.tsv', 'train_extra_part*.tsv')
    for p in [f for pattern in parts for f in sorted(HANDOFF.glob(pattern))]:
        care += read_tsv(p)
    bad = [r for r in care if r['label'] not in labels]
    care = [r for r in care if r['label'] in labels]
    for r in care:
        lang = 'sw' if r['lang'] == 'sw' else 'en'
        variants = {r['text']}
        for _ in range(OVERSAMPLE * 3):
            if len(variants) > OVERSAMPLE:
                break
            variants.add(vary(r['text'], lang, rng))
        for i, v in enumerate(variants):
            rows.append({'text': v, 'label': r['label'], 'lt': r['lt'], 'source': 'caretaker' if i == 0 else 'caretaker_var'})
    # nothing in training may be a near-paraphrase of a validation, development or test message
    refs = [r['text'] for r in test + val + dev]
    drop = near_duplicates([r['text'] for r in rows], refs)
    kept = [r for i, r in enumerate(rows) if i not in drop]
    V3.mkdir(exist_ok=True)
    with open(V3 / 'train.jsonl', 'w', encoding='utf-8') as f:
        for r in kept:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    with open(V3 / 'val.jsonl', 'w', encoding='utf-8') as f:
        for r in val:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    by = lambda rs, k: {s: sum(1 for r in rs if r[k] == s) for s in sorted({r[k] for r in rs})}
    report = {
        'caretaker_training_messages': len(care), 'caretaker_rows_with_bad_labels': len(bad),
        'training_rows_before_dedup': len(rows), 'dropped_as_near_duplicates_of_val_dev_or_test': len(drop),
        'training_rows': len(kept), 'validation_rows': len(val), 'development_rows': len(dev), 'test_rows': len(test),
        'training_by_source': by(kept, 'source'),
        'training_life_threatening_share': float(np.mean([r['lt'] for r in kept])),
    }
    (V3 / 'data_report.json').write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps(report, indent=1))


def _load_v3(split):
    return [json.loads(l) for l in open(V3 / f'{split}.jsonl', encoding='utf-8')]


def export_linear(name, words, chars, clf, labels, temperature):
    """Weights for safety.LinearText: 8-bit per class, plus IDF and the vocabularies."""
    coef = clf.coef_.astype(np.float32)
    scale = np.abs(coef).max(axis=1, keepdims=True) / 127.0
    scale[scale == 0] = 1.0
    np.savez_compressed(
        ARTIFACTS / f'{name}.npz', coef=np.round(coef / scale).astype(np.int8), scale=scale.astype(np.float32),
        intercept=clf.intercept_.astype(np.float32),
        idf_words=words.idf_.astype(np.float32), idf_chars=chars.idf_.astype(np.float32))
    vw, vc = [None] * len(words.vocabulary_), [None] * len(chars.vocabulary_)
    for t, i in words.vocabulary_.items():
        vw[i] = t
    for t, i in chars.vocabulary_.items():
        vc[i] = t
    (ARTIFACTS / f'{name}_vocab.json').write_text(json.dumps(
        {'labels': labels, 'temperature': temperature, 'words': vw, 'chars': vc,
         'word_ngrams': list(words.ngram_range), 'char_ngrams': list(chars.ngram_range)}, ensure_ascii=False), encoding='utf-8')


def train_linear():
    from scipy.sparse import hstack
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression

    from .safety import LinearText
    guide = load_guide()
    labels = label_list()
    idx = {l: i for i, l in enumerate(labels)}
    tr, va = _load_v3('train'), _load_v3('val')
    Xtr, Xva = [r['text'] for r in tr], [r['text'] for r in va]
    words = TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, max_features=200000)
    chars = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 5), min_df=3, sublinear_tf=True, max_features=300000)
    A = hstack([words.fit_transform(Xtr), chars.fit_transform(Xtr)]).tocsr()
    B = hstack([words.transform(Xva), chars.transform(Xva)]).tocsr()

    targets = {
        'baseline': ([idx[r['label']] for r in tr], [idx[r['label']] for r in va], labels),
        'danger': ([int(r['lt']) for r in tr], [int(r['lt']) for r in va], ['safe', 'danger']),
        'oos_gate': ([int(r['label'] in NON_TOPICS) for r in tr], [int(r['label'] in NON_TOPICS) for r in va],
                     ['first_aid', 'not_first_aid']),
    }
    summary = {}
    for name, (ytr, yva, names) in targets.items():
        ytr, yva = np.array(ytr), np.array(yva)
        best = None
        for C in (2.0, 8.0, 32.0):  # chosen on validation
            t = time.time()
            clf = LogisticRegression(C=C, max_iter=3000, class_weight='balanced').fit(A, ytr)
            f1 = macro_f1(yva, clf.predict(B), len(names))
            print(f'{name} C={C}: val macro-F1 {f1:.3f} ({time.time() - t:.0f}s)', flush=True)
            if best is None or f1 > best[0]:
                best = (f1, C, clf)
        f1, C, clf = best
        z = clf.decision_function(B)
        z2 = z if z.ndim == 2 else np.stack([np.zeros_like(z), z], axis=1)  # binary: two-class logits for calibration
        temperature = fit_temperature(z2, yva)
        export_linear(name, words, chars, clf, names, temperature)
        lite = LinearText(ARTIFACTS, name)
        same = float(np.mean(lite.probabilities(Xva).argmax(1) == clf.predict(B)))
        summary[name] = {'C': C, 'val_macro_f1': f1, 'temperature': temperature, 'numpy_matches_sklearn': same}
        print(f'{name}: C={C} T={temperature:.2f}, numpy runtime agrees with scikit-learn on {same * 100:.2f} % of val',
              flush=True)
    (V3 / 'linear_report.json').write_text(json.dumps(summary, indent=1), encoding='utf-8')


def keep_awake(on=True):
    """Stop Windows from sleeping while this process runs (no system setting is changed; it ends with the process)."""
    try:
        import ctypes
        ES_CONTINUOUS, ES_SYSTEM_REQUIRED = 0x80000000, 0x00000001
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | (ES_SYSTEM_REQUIRED if on else 0))
    except (AttributeError, OSError):
        pass  # not Windows


def finetune(epochs=3, batch=32, lr=5e-5, tag='v3', init=None):
    """Fine-tune multilingual-e5-small on the v3 data. A checkpoint is written after every epoch (model, optimiser,
    schedule, random state), and a run that was stopped resumes from it. The best epoch by caretaker-validation
    macro-F1 is kept as models/finetune_v3.pt."""
    import pickle

    import torch
    from torch import nn

    from .train import MAX_TOKENS, MODELS, batch_logits, build_classifier, prep
    keep_awake(True)
    torch.manual_seed(0)
    labels = label_list()
    idx = {l: i for i, l in enumerate(labels)}
    tr, va = _load_v3('train'), _load_v3('val')
    # keep the run near 4 hours: cap the big public/variation sources; every caretaker-style row is kept
    caps = {'clinc': 3500, 'massive_en': 2500, 'massive_sw': 2500, 'medquad': 2500, 'guide_variation': 7000}
    seen, kept = {}, []
    for r in sorted(tr, key=lambda r: zlib.crc32(r['text'].encode())):
        c = caps.get(r['source'])
        if c is not None:
            seen[r['source']] = seen.get(r['source'], 0) + 1
            if seen[r['source']] > c:
                continue
        kept.append(r)
    tr = kept
    print(f'fine-tune rows: {len(tr)}', flush=True)
    Xtr, ytr = [r['text'] for r in tr], np.array([idx[r['label']] for r in tr])
    Xva, yva = [r['text'] for r in va], np.array([idx[r['label']] for r in va])
    model = build_classifier(len(labels))
    if init:  # warm start: continue from an earlier fine-tuned model (same labels)
        model.load_state_dict(torch.load(MODELS / init))
        print(f'warm start from {init}', flush=True)
    counts = np.bincount(ytr, minlength=len(labels)).astype(float)
    weights = torch.tensor((counts.sum() / (len(labels) * np.maximum(counts, 1))) ** 0.5, dtype=torch.float32)
    loss_fn = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.1)
    no_decay = ('bias', 'LayerNorm.weight')
    params = [{'params': [p for n, p in model.named_parameters() if not any(k in n for k in no_decay)], 'weight_decay': 0.01},
              {'params': [p for n, p in model.named_parameters() if any(k in n for k in no_decay)], 'weight_decay': 0.0}]
    opt = torch.optim.AdamW(params, lr=lr)
    per_epoch = int(np.ceil(len(ytr) / batch))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=epochs * per_epoch, pct_start=0.1,
                                                anneal_strategy='linear')
    ckpt, best_path = MODELS / f'finetune_{tag}_checkpoint.pt', MODELS / f'finetune_{tag}.pt'
    rng = np.random.default_rng(0)
    start, best, history, t0 = 1, -1.0, [], time.time()
    if ckpt.exists():
        c = torch.load(ckpt, weights_only=False)
        model.load_state_dict(c['model'])
        opt.load_state_dict(c['opt'])
        sched.load_state_dict(c['sched'])
        rng = pickle.loads(c['rng'])
        start, best, history = c['epoch'] + 1, c['best'], c['history']
        print(f'resuming after epoch {c["epoch"]}', flush=True)
        del c  # the checkpoint holds a second copy of the model and optimiser (~1.4 GB); free it before training
        import gc
        gc.collect()
    for epoch in range(start, epochs + 1):
        order = rng.permutation(len(ytr))
        model.train()
        for s, i in enumerate(range(0, len(order), batch), 1):
            b = order[i:i + batch]
            x = model.tok(prep([Xtr[j] for j in b]), padding=True, truncation=True, max_length=MAX_TOKENS, return_tensors='pt')
            loss = loss_fn(model(x['input_ids'], x['attention_mask']), torch.from_numpy(ytr[b]))
            if os.environ.get('MZAZI_TRACE'):
                print(f'    trace step {s} shape {tuple(x["input_ids"].shape)} loss {loss.item():.3f}', flush=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); opt.zero_grad()
            if s % 100 == 0:
                print(f'  epoch {epoch} step {s}/{per_epoch} loss {loss.item():.3f} | {(time.time() - t0) / 60:.0f} min', flush=True)
        pred = batch_logits(model, Xva).argmax(1)
        f1, acc = macro_f1(yva, pred, len(labels)), float(np.mean(pred == yva))
        history.append({'epoch': epoch, 'val_acc': acc, 'val_macro_f1': f1})
        print(f'epoch {epoch}: caretaker val acc {acc:.3f} macro-F1 {f1:.3f} | {(time.time() - t0) / 60:.0f} min', flush=True)
        if f1 > best:
            best = f1
            torch.save(model.state_dict(), best_path)
        torch.save({'model': model.state_dict(), 'opt': opt.state_dict(), 'sched': sched.state_dict(),
                    'rng': pickle.dumps(rng), 'epoch': epoch, 'best': best, 'history': history}, ckpt)
    (MODELS / f'finetune_{tag}.json').write_text(json.dumps(
        {'labels': labels, 'init': init, 'history': history, 'best_val_macro_f1': best, 'epochs': epochs, 'batch': batch, 'lr': lr},
        indent=1), encoding='utf-8')
    keep_awake(False)
    print('done', flush=True)


def export_onnx(source='finetune_v3.pt'):
    """Export models/finetune_v3.pt to 8-bit ONNX in a staging folder (models/v3_onnx). The live
    artifacts/intent.onnx is not touched: replacing it is a separate decision after the evaluation."""
    import torch
    from onnxruntime.quantization import QuantType, quantize_dynamic

    from .train import MODELS, batch_logits, build_classifier, prep
    labels = label_list()
    stage = MODELS / 'v3_onnx'
    stage.mkdir(exist_ok=True)
    model = build_classifier(len(labels))
    model.load_state_dict(torch.load(MODELS / source))
    model.eval()

    class Wrapper(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, input_ids, attention_mask):
            # second output: the sentence embedding the topic head reads (used by the danger head, see danger_head())
            h = self.m.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
            e = mean_pool(h, attention_mask)
            return self.m.head(e), e

    from .train import mean_pool
    x = model.tok(prep(['bibi ameanguka bafuni', 'he is choking']), padding=True, return_tensors='pt')
    full = MODELS / 'intent_v3_fp32.onnx'
    torch.onnx.export(Wrapper(model), (x['input_ids'], x['attention_mask']), str(full),
                      input_names=['input_ids', 'attention_mask'], output_names=['logits', 'embedding'],
                      dynamic_axes={'input_ids': {0: 'batch', 1: 'tokens'}, 'attention_mask': {0: 'batch', 1: 'tokens'},
                                    'logits': {0: 'batch'}, 'embedding': {0: 'batch'}}, opset_version=17, dynamo=False)
    quantize_dynamic(str(full), str(stage / 'intent.onnx'), weight_type=QuantType.QInt8)
    model.tok.backend_tokenizer.save(str(stage / 'tokenizer.json'))
    (stage / 'intent.json').write_text(json.dumps(
        {'labels': labels, 'temperature': 1.0, 'threshold': 0.5, 'source': source}, indent=1), encoding='utf-8')

    # does the 8-bit model agree with the PyTorch one? (validation texts; only agreement is measured, no labels)
    import onnxruntime as ort
    from tokenizers import Tokenizer
    from .train import MAX_TOKENS
    texts = [r['text'] for r in _load_v3('val')]
    a = batch_logits(model, texts).argmax(1)
    tok = Tokenizer.from_file(str(stage / 'tokenizer.json'))
    tok.enable_truncation(MAX_TOKENS)
    tok.enable_padding(pad_id=tok.token_to_id('<pad>') or 1, pad_token='<pad>')
    sess = ort.InferenceSession(str(stage / 'intent.onnx'), providers=['CPUExecutionProvider'])
    b = []
    for i in range(0, len(texts), 128):
        enc = tok.encode_batch(['query: ' + t for t in texts[i:i + 128]])
        b.append(sess.run(None, {'input_ids': np.array([e.ids for e in enc], dtype=np.int64),
                                 'attention_mask': np.array([e.attention_mask for e in enc], dtype=np.int64)})[0])
    b = np.concatenate(b).argmax(1)
    size = (stage / 'intent.onnx').stat().st_size / 1e6
    print(f'exported {stage / "intent.onnx"}: {size:.0f} MB, agreement with PyTorch on validation {np.mean(a == b):.1%}')


def danger_head():
    """Danger detector on the fine-tuned model's sentence embedding (models/v3_onnx/danger_head.npz).

    The word-based detector cannot tell a dangerous burn/fracture/insulin message from an ordinary one (the topic models
    cannot either: those topics are not life-threatening in general). The embedding carries more of the meaning.
    Trained on every caretaker-style row (life-threatening is labelled per message there) plus a sample of the public
    rows; C chosen on validation by the share of not-life-threatening messages flagged at 99 % recall."""
    from sklearn.linear_model import LogisticRegression

    from .evaluate_v3 import FT_DIR, onnx_outputs
    from .safety import DangerHead
    tr, va = _load_v3('train'), _load_v3('val')
    rng = random.Random(5)
    other = [r for r in tr if not r['source'].startswith('caretaker')]
    tr = [r for r in tr if r['source'].startswith('caretaker')] + rng.sample(other, min(15000, len(other)))
    t = time.time()
    Etr = onnx_outputs([r['text'] for r in tr])[1]
    Eva = onnx_outputs([r['text'] for r in va])[1]
    print(f'embedded {len(tr)} training + {len(va)} validation rows ({time.time() - t:.0f}s)', flush=True)
    ytr, yva = np.array([int(r['lt']) for r in tr]), np.array([int(r['lt']) for r in va])
    mu, sd = Etr.mean(0), Etr.std(0) + 1e-6
    Ztr, Zva = (Etr - mu) / sd, (Eva - mu) / sd

    def flagged_at_recall(score, recall=0.99):
        cut = np.quantile(score[yva == 1], 1 - recall)
        return float(np.mean(score[yva == 0] >= cut))

    from .safety import LinearText
    tfidf = LinearText(ARTIFACTS, 'danger').logits([r['text'] for r in va])[:, 0]
    print(f'word-based detector: flags {flagged_at_recall(tfidf):.1%} of not-life-threatening validation messages '
          f'at 99 % recall', flush=True)
    best = None
    for C in (0.01, 0.03, 0.1, 0.3, 1.0):
        clf = LogisticRegression(C=C, max_iter=5000, class_weight='balanced').fit(Ztr, ytr)
        fpr = flagged_at_recall(clf.decision_function(Zva))
        print(f'danger head C={C}: flags {fpr:.1%} at 99 % recall (validation)', flush=True)
        if best is None or fpr < best[0]:
            best = (fpr, C, clf)
    fpr, C, clf = best
    z = clf.decision_function(Zva)
    temperature = fit_temperature(np.stack([np.zeros_like(z), z], 1), yva)
    path = FT_DIR / 'danger_head.npz'
    np.savez(path, mu=mu.astype(np.float32), sd=sd.astype(np.float32), w=clf.coef_[0].astype(np.float32),
             b=np.float32(clf.intercept_[0]), temperature=np.float32(temperature))
    same = np.allclose(DangerHead(path).logits(Eva), z, atol=1e-3)
    print(f'saved {path}: C={C} T={temperature:.2f}; numpy matches scikit-learn: {same}', flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'finetune_warm':  # round 3b: 2 more epochs from finetune_v3.pt on the extended data
        finetune(epochs=2, lr=3e-5, tag='v3b', init='finetune_v3.pt')
    elif sys.argv[1] == 'export' and len(sys.argv) > 2:
        export_onnx(sys.argv[2])
    else:
        {'data': build_data, 'linear': train_linear, 'finetune': finetune, 'export': export_onnx,
         'danger_head': danger_head}[sys.argv[1]]()
