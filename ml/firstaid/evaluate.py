"""Scores the trained question models on the held-out test set and writes artifacts/comparison.md.

    python -m firstaid.evaluate

Every model is judged the same way: its confidence threshold is chosen on validation (the lowest threshold at which
at least 95 % of the topics it answers are right), then the test set is scored once. Below the threshold the
assistant asks which topic is meant instead of answering. The safety check (danger words) is applied on top, exactly
as in the live assistant.
"""
import json
import time
from collections import Counter

import numpy as np

from .config import ARTIFACTS
from .train import NON_TOPICS, Baseline, FineTuned, Frozen, load, softmax, macro_f1

TARGET = 0.95  # share of answered topics that must be right on validation


def choose_threshold(probs, y, labels, target=TARGET):
    topic = np.array([labels[i] not in NON_TOPICS for i in range(len(labels))])
    is_topic = topic[y]
    conf, pred = probs.max(1), probs.argmax(1)
    for t in np.arange(0.20, 0.96, 0.01):
        answered = is_topic & topic[pred] & (conf >= t)
        if answered.sum() and np.mean(pred[answered] == y[answered]) >= target:
            return float(round(t, 2))
    return 0.95


def simulate(probs, texts, y, labels, threshold, guide):
    """What the live assistant would do for each test message (see assistant.FirstAidAssistant.reply)."""
    from .assistant import danger_topics
    out = []
    for p, text, truth in zip(probs, texts, y):
        label, conf = labels[int(p.argmax())], float(p.max())
        danger = danger_topics(text, guide)
        if label in NON_TOPICS and not danger:
            kind, topic = (label, None) if (conf >= threshold or label == 'greeting') else ('clarify', None)
        elif label in NON_TOPICS:
            kind, topic = 'answer', danger[0]
        elif conf >= threshold:
            kind, topic = 'answer', label
        elif danger:
            kind, topic = 'answer', label if label in danger else danger[0]
        else:
            kind, topic = 'clarify', None
        top3 = [labels[i] for i in np.argsort(-p) if labels[i] not in NON_TOPICS][:3]
        emergency = bool(danger) or (topic is not None and guide[topic]['critical']) or (
            kind == 'clarify' and topic is None and any(guide[t]['critical'] for t in top3) and labels[truth] not in NON_TOPICS)
        out.append({'truth': labels[truth], 'kind': kind, 'topic': topic, 'top3': top3, 'emergency': emergency})
    return out


def score(name, model, guide, size_mb, extra=None):
    labels = model.labels
    idx = {l: i for i, l in enumerate(labels)}
    Xva, yva, _ = load('val')
    Xte, yte, lte = load('test')
    yva, yte = np.array([idx[l] for l in yva]), np.array([idx[l] for l in yte])
    pva = softmax(model.logits(Xva) / model.temperature)
    t0 = time.time()
    pte = softmax(model.logits(Xte) / model.temperature)
    ms = (time.time() - t0) / len(Xte) * 1000
    threshold = choose_threshold(pva, yva, labels)
    pred = pte.argmax(1)
    topic_rows = np.array([labels[i] not in NON_TOPICS for i in yte])
    sim = simulate(pte, Xte, yte, labels, threshold, guide)
    answered = [s for s in sim if s['truth'] not in NON_TOPICS and s['kind'] == 'answer']
    topic_sims = [s for s in sim if s['truth'] not in NON_TOPICS]
    right = [s for s in answered if s['topic'] == s['truth']]
    clar = [s for s in topic_sims if s['kind'] == 'clarify']
    clar_ok = [s for s in clar if s['truth'] in s['top3']]
    crit = [s for s in topic_sims if guide[s['truth']]['critical']]
    nont = [s for s in sim if s['truth'] in NON_TOPICS]

    def acc_lang(lang):
        m = np.array([l == lang for l in lte]) & topic_rows
        return float(np.mean(pred[m] == yte[m])) if m.any() else float('nan')

    r = {
        'model': name,
        'test_accuracy_all': float(np.mean(pred == yte)),
        'test_topic_accuracy': float(np.mean(pred[topic_rows] == yte[topic_rows])),
        'test_topic_top3': float(np.mean([s['truth'] in s['top3'] for s in topic_sims])),
        'test_macro_f1': macro_f1(yte, pred, len(labels)),
        'topic_accuracy_en': acc_lang('en'), 'topic_accuracy_sw': acc_lang('sw'), 'topic_accuracy_mixed': acc_lang('mixed'),
        'threshold': threshold,
        'answered_share': len(answered) / len(topic_sims),
        'answered_correct': len(right) / max(1, len(answered)),
        'wrong_advice_share': (len(answered) - len(right)) / len(topic_sims),
        'clarified_share': len(clar) / len(topic_sims),
        'clarify_contains_right_topic': len(clar_ok) / max(1, len(clar)),
        'critical_flagged_as_emergency': float(np.mean([s['emergency'] for s in crit])),
        'non_topic_handled_right': float(np.mean([s['kind'] in (s['truth'], 'clarify') for s in nont])),
        'non_topic_given_advice': float(np.mean([s['kind'] == 'answer' for s in nont])),
        'val_accuracy': float(np.mean(pva.argmax(1) == yva)),
        'val_macro_f1': macro_f1(yva, pva.argmax(1), len(labels)),
        'ms_per_message': ms, 'size_mb': size_mb,
        'mistakes': [f"{s['truth']} -> {s['kind']}:{s['topic']}" for s in topic_sims if s['kind'] == 'answer' and s['topic'] != s['truth']],
    }
    if extra:
        r.update(extra)
    print(f"{name}: topic acc {r['test_topic_accuracy']:.3f}, wrong advice {r['wrong_advice_share']:.3f}, "
          f"emergency flagged {r['critical_flagged_as_emergency']:.3f}", flush=True)
    return r


class Deployed:
    """The exported 8-bit ONNX model, exactly as the backend runs it."""
    name = 'deployed (8-bit ONNX)'

    def __init__(self):
        from .assistant import FirstAidAssistant
        self.a = FirstAidAssistant()
        self.labels, self.temperature = self.a.labels, 1.0

    def logits(self, texts):
        return np.log(np.concatenate([self.a.probabilities(texts[i:i + 256]) for i in range(0, len(texts), 256)]) + 1e-12)


def main():
    from .knowledge import load_guide
    from .train import MODELS
    guide = load_guide()
    results = []
    mb = lambda p: p.stat().st_size / 1e6
    if (MODELS / 'baseline.pkl').exists():
        results.append(score(Baseline.name, Baseline(), guide, mb(MODELS / 'baseline.pkl')))
    if (MODELS / 'frozen.pkl').exists():
        results.append(score(Frozen.name, Frozen(), guide, 470 + mb(MODELS / 'frozen.pkl')))
    if (MODELS / 'finetune.pt').exists():
        meta = json.loads((MODELS / 'finetune.json').read_text())
        results.append(score(FineTuned.name, FineTuned(), guide, mb(MODELS / 'finetune.pt'),
                             {'train_minutes': meta['train_minutes']}))
    if (ARTIFACTS / 'intent.onnx').exists():
        results.append(score(Deployed.name, Deployed(), guide, mb(ARTIFACTS / 'intent.onnx')))
    (ARTIFACTS / 'comparison.json').write_text(json.dumps(results, indent=1), encoding='utf-8')
    write_markdown(results)


def write_markdown(results):
    pct = lambda v: f'{v * 100:.1f} %'
    rows = [
        ('Topic accuracy (43 topics)', 'test_topic_accuracy', pct),
        ('Right topic among the top 3', 'test_topic_top3', pct),
        ('Accuracy, all 46 labels', 'test_accuracy_all', pct),
        ('Macro-F1, all labels', 'test_macro_f1', lambda v: f'{v:.3f}'),
        ('Topic accuracy, English', 'topic_accuracy_en', pct),
        ('Topic accuracy, Kiswahili', 'topic_accuracy_sw', pct),
        ('Topic accuracy, mixed', 'topic_accuracy_mixed', pct),
        ('Confidence threshold (chosen on validation)', 'threshold', lambda v: f'{v:.2f}'),
        ('Answered straight away', 'answered_share', pct),
        ('...of which the right topic', 'answered_correct', pct),
        ('**Wrong advice given (share of all topic questions)**', 'wrong_advice_share', pct),
        ('Asked "did you mean" instead', 'clarified_share', pct),
        ('...with the right topic among the choices', 'clarify_contains_right_topic', pct),
        ('**Life-threatening questions that got "call 999"**', 'critical_flagged_as_emergency', pct),
        ('Greeting / health / unrelated handled right', 'non_topic_handled_right', pct),
        ('...given first-aid advice by mistake', 'non_topic_given_advice', pct),
        ('Validation accuracy', 'val_accuracy', pct),
        ('Time per message (CPU)', 'ms_per_message', lambda v: f'{v:.1f} ms'),
        ('Model size', 'size_mb', lambda v: f'{v:.0f} MB'),
    ]
    head = '| Metric | ' + ' | '.join(r['model'] for r in results) + ' |'
    lines = ['# First-aid assistant: model comparison', '',
             'Held-out test: 197 hand-written caretaker messages (English, Kiswahili, mixed), never used for training or '
             'settings. Thresholds are chosen on validation. "Wrong advice" counts questions where the assistant answered '
             'confidently with the wrong topic; everything else is either right or a "did you mean" question. The safety '
             'check for danger words is included, as in the live assistant. Generated by `python -m firstaid.evaluate`.', '',
             head, '|' + '---|' * (len(results) + 1)]
    for title, key, f in rows:
        lines.append(f'| {title} | ' + ' | '.join(f(r[key]) if key in r else '–' for r in results) + ' |')
    lines += ['', '## Wrong answers on the test set', '']
    for r in results:
        lines.append(f"* **{r['model']}**: " + (', '.join(r['mistakes']) or 'none'))
    (ARTIFACTS / 'comparison.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
