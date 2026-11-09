"""Trains the question-understanding models for the first-aid assistant and compares them.

    python -m firstaid.train baseline        # TF-IDF words + characters, logistic regression
    python -m firstaid.train frozen          # pretrained multilingual-e5-small sentence vectors + logistic regression
    python -m firstaid.train finetune        # multilingual-e5-small fine-tuned end to end (the deployed model)
    python -m firstaid.train report          # scores every trained model on the held-out test set

Each model is fitted on train.jsonl, its settings and early stopping use val.jsonl only, and its probabilities are
calibrated on val with one temperature. The test set (eval/test_questions.tsv) is scored once, at the end.
"""
import argparse
import json
import pickle
import time

import numpy as np

from .config import ARTIFACTS, BASE_MODEL, BASE_MODEL_NAME, DATA, GREETING, MAX_TOKENS, OUT_OF_SCOPE
from .knowledge import load_guide

MODELS = DATA / 'models'
GENERAL_MEDICAL = 'general_medical'
NON_TOPICS = (OUT_OF_SCOPE, GENERAL_MEDICAL, GREETING)


def load(split):
    rows = [json.loads(l) for l in open(DATA / f'{split}.jsonl', encoding='utf-8')]
    return [r['text'] for r in rows], [r['label'] for r in rows], [r['lang'] for r in rows]


def label_list():
    guide = load_guide()
    return sorted(t for t, v in guide.items() if v['classify']) + list(NON_TOPICS)


def softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def fit_temperature(logits, y):
    """One temperature T for softmax(logits / T), chosen on validation by log-loss (simple grid, robust)."""
    best = (1e9, 1.0)
    for t in np.exp(np.linspace(np.log(0.05), np.log(10), 200)):
        p = softmax(logits / t)
        nll = -np.mean(np.log(p[np.arange(len(y)), y] + 1e-12))
        best = min(best, (nll, t))
    return float(best[1])


def macro_f1(y, pred, n):
    f1 = []
    for c in range(n):
        tp = np.sum((pred == c) & (y == c))
        fp = np.sum((pred == c) & (y != c))
        fn = np.sum((pred != c) & (y == c))
        if tp + fp + fn:
            f1.append(2 * tp / (2 * tp + fp + fn))
    return float(np.mean(f1))


# ---------------------------------------------------------------- baseline: TF-IDF + logistic regression
def train_baseline():
    from scipy.sparse import hstack
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression

    labels = label_list()
    idx = {l: i for i, l in enumerate(labels)}
    Xtr, ytr, _ = load('train')
    Xva, yva, _ = load('val')
    ytr, yva = np.array([idx[l] for l in ytr]), np.array([idx[l] for l in yva])
    words = TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, max_features=200000)
    chars = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 5), min_df=3, sublinear_tf=True, max_features=300000)
    A = hstack([words.fit_transform(Xtr), chars.fit_transform(Xtr)]).tocsr()
    B = hstack([words.transform(Xva), chars.transform(Xva)]).tocsr()
    best = None
    for C in (2.0, 8.0, 32.0):  # settings chosen on validation
        t = time.time()
        clf = LogisticRegression(C=C, max_iter=2000, class_weight='balanced')
        clf.fit(A, ytr)
        f1 = macro_f1(yva, clf.predict(B), len(labels))
        print(f'C={C}: val macro-F1 {f1:.3f} ({time.time() - t:.0f}s)', flush=True)
        if best is None or f1 > best[0]:
            best = (f1, C, clf)
    _, C, clf = best
    temperature = fit_temperature(clf.decision_function(B), yva)
    MODELS.mkdir(parents=True, exist_ok=True)
    with open(MODELS / 'baseline.pkl', 'wb') as f:
        pickle.dump({'words': words, 'chars': chars, 'clf': clf, 'labels': labels, 'temperature': temperature, 'C': C}, f)
    print(f'baseline saved (C={C}, temperature {temperature:.2f})')


class Baseline:
    name = 'TF-IDF + logistic regression'

    def __init__(self):
        with open(MODELS / 'baseline.pkl', 'rb') as f:
            self.m = pickle.load(f)
        self.labels = self.m['labels']

    def logits(self, texts):
        from scipy.sparse import hstack
        X = hstack([self.m['words'].transform(texts), self.m['chars'].transform(texts)]).tocsr()
        return self.m['clf'].decision_function(X)

    @property
    def temperature(self):
        return self.m['temperature']


# ---------------------------------------------------------------- transformer helpers
def encoder(name=BASE_MODEL):
    from transformers import AutoModel, AutoTokenizer
    return AutoTokenizer.from_pretrained(name), AutoModel.from_pretrained(name)


def mean_pool(hidden, mask):
    m = mask.unsqueeze(-1).to(hidden.dtype)
    return (hidden * m).sum(1) / m.sum(1).clamp(min=1e-6)


def prep(texts):
    return ['query: ' + t for t in texts]  # the prefix multilingual-e5 was trained with


def embed(tok, model, texts, batch=128):
    import torch
    out = []
    model.eval()
    with torch.no_grad():
        for i in range(0, len(texts), batch):
            x = tok(prep(texts[i:i + batch]), padding=True, truncation=True, max_length=MAX_TOKENS, return_tensors='pt')
            v = mean_pool(model(**x).last_hidden_state, x['attention_mask'])
            out.append(torch.nn.functional.normalize(v, dim=-1).numpy())
    return np.concatenate(out)


# ---------------------------------------------------------------- frozen sentence vectors + logistic regression
def train_frozen():
    from sklearn.linear_model import LogisticRegression
    labels = label_list()
    idx = {l: i for i, l in enumerate(labels)}
    Xtr, ytr, _ = load('train')
    Xva, yva, _ = load('val')
    ytr, yva = np.array([idx[l] for l in ytr]), np.array([idx[l] for l in yva])
    tok, model = encoder()
    t = time.time()
    A, B = embed(tok, model, Xtr), embed(tok, model, Xva)
    print(f'embedded {len(Xtr) + len(Xva)} texts in {time.time() - t:.0f}s', flush=True)
    best = None
    for C in (1.0, 10.0, 100.0):
        clf = LogisticRegression(C=C, max_iter=3000, class_weight='balanced').fit(A, ytr)
        f1 = macro_f1(yva, clf.predict(B), len(labels))
        print(f'C={C}: val macro-F1 {f1:.3f}', flush=True)
        if best is None or f1 > best[0]:
            best = (f1, C, clf)
    _, C, clf = best
    temperature = fit_temperature(clf.decision_function(B), yva)
    MODELS.mkdir(parents=True, exist_ok=True)
    with open(MODELS / 'frozen.pkl', 'wb') as f:
        pickle.dump({'clf': clf, 'labels': labels, 'temperature': temperature, 'C': C}, f)
    print(f'frozen saved (C={C}, temperature {temperature:.2f})')


class Frozen:
    name = 'multilingual-e5-small (frozen) + logistic regression'

    def __init__(self):
        with open(MODELS / 'frozen.pkl', 'rb') as f:
            self.m = pickle.load(f)
        self.labels = self.m['labels']
        self.tok, self.model = encoder()

    def logits(self, texts):
        return self.m['clf'].decision_function(embed(self.tok, self.model, texts))

    @property
    def temperature(self):
        return self.m['temperature']


# ---------------------------------------------------------------- fine-tuned transformer (deployed)
def build_classifier(n_labels):
    import torch
    from torch import nn

    class Classifier(nn.Module):
        def __init__(self):
            super().__init__()
            self.tok, self.encoder = encoder()
            self.drop = nn.Dropout(0.1)
            self.head = nn.Linear(self.encoder.config.hidden_size, n_labels)

        def forward(self, input_ids, attention_mask):
            h = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
            return self.head(self.drop(mean_pool(h, attention_mask)))
    torch.manual_seed(0)
    return Classifier()


def batch_logits(model, texts, batch=128):
    import torch
    out = []
    model.eval()
    with torch.no_grad():
        for i in range(0, len(texts), batch):
            x = model.tok(prep(texts[i:i + batch]), padding=True, truncation=True, max_length=MAX_TOKENS, return_tensors='pt')
            out.append(model(x['input_ids'], x['attention_mask']).numpy())
    return np.concatenate(out)


def train_finetune(epochs=3, batch=32, lr=5e-5, patience=1, val_every=None):
    import torch
    from torch import nn
    torch.manual_seed(0)
    labels = label_list()
    idx = {l: i for i, l in enumerate(labels)}
    Xtr, ytr, _ = load('train')
    Xva, yva, _ = load('val')
    ytr, yva = np.array([idx[l] for l in ytr]), np.array([idx[l] for l in yva])
    # validation is large (CLINC/MASSIVE); a fixed stratified subset keeps checks quick and steady
    rng = np.random.default_rng(0)
    keep = np.concatenate([rng.permutation(np.where(yva == c)[0])[:150] for c in range(len(labels))])
    Xv, yv = [Xva[i] for i in keep], yva[keep]

    model = build_classifier(len(labels))
    counts = np.bincount(ytr, minlength=len(labels)).astype(float)
    weights = torch.tensor((counts.sum() / (len(labels) * np.maximum(counts, 1))) ** 0.5, dtype=torch.float32)
    loss_fn = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.1)
    no_decay = ('bias', 'LayerNorm.weight')
    params = [{'params': [p for n, p in model.named_parameters() if not any(k in n for k in no_decay)], 'weight_decay': 0.01},
              {'params': [p for n, p in model.named_parameters() if any(k in n for k in no_decay)], 'weight_decay': 0.0}]
    opt = torch.optim.AdamW(params, lr=lr)
    steps = epochs * int(np.ceil(len(ytr) / batch))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=steps, pct_start=0.1, anneal_strategy='linear')
    val_every = val_every or int(np.ceil(len(ytr) / batch / 2))  # check twice per epoch

    best, bad, step, t0 = (-1, None), 0, 0, time.time()
    MODELS.mkdir(parents=True, exist_ok=True)
    stop = False
    for epoch in range(1, epochs + 1):
        order = rng.permutation(len(ytr))
        model.train()
        total = 0.0
        for i in range(0, len(order), batch):
            b = order[i:i + batch]
            x = model.tok(prep([Xtr[j] for j in b]), padding=True, truncation=True, max_length=MAX_TOKENS, return_tensors='pt')
            loss = loss_fn(model(x['input_ids'], x['attention_mask']), torch.from_numpy(ytr[b]))
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); opt.zero_grad()
            total += loss.item() * len(b)
            step += 1
            if step % 100 == 0:
                print(f'  step {step}/{steps} loss {loss.item():.3f} | {(time.time() - t0) / 60:.0f} min', flush=True)
            if step % val_every == 0 or step == steps:
                pred = batch_logits(model, Xv).argmax(1)
                f1 = macro_f1(yv, pred, len(labels))
                acc = float(np.mean(pred == yv))
                print(f'epoch {epoch} step {step}: val acc {acc:.3f} macro-F1 {f1:.3f} | {(time.time() - t0) / 60:.0f} min', flush=True)
                if f1 > best[0]:
                    best, bad = (f1, step), 0
                    torch.save(model.state_dict(), MODELS / 'finetune.pt')
                else:
                    bad += 1
                    if bad > patience * 2:  # two checks per epoch
                        print('early stop', flush=True)
                        stop = True
                        break
                model.train()
        if stop:
            break
    model.load_state_dict(torch.load(MODELS / 'finetune.pt'))
    temperature = fit_temperature(batch_logits(model, Xva), yva)
    meta = {'labels': labels, 'temperature': temperature, 'best_val_macro_f1': best[0], 'best_step': best[1],
            'epochs': epochs, 'batch': batch, 'lr': lr, 'train_minutes': round((time.time() - t0) / 60, 1),
            'max_tokens': MAX_TOKENS, 'base_model': BASE_MODEL_NAME}
    (MODELS / 'finetune.json').write_text(json.dumps(meta, indent=1), encoding='utf-8')
    print(f'fine-tuned saved: {meta}')


class FineTuned:
    name = 'multilingual-e5-small fine-tuned (deployed)'

    def __init__(self):
        import torch
        self.meta = json.loads((MODELS / 'finetune.json').read_text(encoding='utf-8'))
        self.labels = self.meta['labels']
        self.model = build_classifier(len(self.labels))
        self.model.load_state_dict(torch.load(MODELS / 'finetune.pt'))

    def logits(self, texts):
        return batch_logits(self.model, texts)

    @property
    def temperature(self):
        return self.meta['temperature']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('what', choices=['baseline', 'frozen', 'finetune'])
    ap.add_argument('--epochs', type=int, default=3)
    a = ap.parse_args()
    if a.what == 'baseline':
        train_baseline()
    elif a.what == 'frozen':
        train_frozen()
    else:
        train_finetune(epochs=a.epochs)


if __name__ == '__main__':
    main()
