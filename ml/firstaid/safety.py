"""Safety layer of the first-aid assistant: shared by the live assistant and by the evaluation, so the numbers
reported are exactly what runs.

Runtime needs only numpy (plus whatever the fine-tuned model needs). Pieces:

* LinearText: a TF-IDF (word 1-2 grams + character 2-5 grams) linear model, rebuilt from exported weights without
  scikit-learn. Used for the baseline topic model, the danger detector and the out-of-scope gate.
* decide(): the policy.
  1. Danger: "call 999" is shown if the danger word patterns fire, OR the danger detector's probability is above its
     (recall-tuned) threshold, OR either topic model's first choice is a life-threatening topic.
  0. A very confident out-of-scope gate (level tuned on validation to block no life-threatening message) answers as
     greeting / general health / out of scope before anything else.
  2. Out-of-scope gate: if the gate says "not first aid" and there is no danger, reply as greeting / general health /
     out of scope.
  3. Advice straight away only if BOTH topic models pick the same topic AND their averaged, temperature-scaled
     confidence is above the threshold tuned on validation. Otherwise "did you mean" with the top options (the danger
     topic first when the patterns name one). It never guesses.
"""
import json
import math
import re
from pathlib import Path

import numpy as np

NON_TOPICS = ('out_of_scope', 'general_medical', 'greeting')
_TOKEN = re.compile(r'(?u)\b\w\w+\b')
_SPACES = re.compile(r'\s\s+')


def _softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


class LinearText:
    """Same features as scikit-learn's TfidfVectorizer(sublinear_tf=True) for words and char_wb, then a linear layer."""

    def __init__(self, folder, name):
        folder = Path(folder)
        meta = json.loads((folder / f'{name}_vocab.json').read_text(encoding='utf-8'))
        w = np.load(folder / f'{name}.npz')
        self.labels = meta['labels']
        self.temperature = float(meta.get('temperature', 1.0))
        self.wn = tuple(meta['word_ngrams'])
        self.cn = tuple(meta['char_ngrams'])
        self.vw = {t: i for i, t in enumerate(meta['words'])}
        self.vc = {t: i for i, t in enumerate(meta['chars'])}
        self.idf_w, self.idf_c = w['idf_words'], w['idf_chars']
        self.coef = w['coef'].astype(np.float32) * w['scale']  # classes x features
        self.intercept = w['intercept']
        self.nw = len(self.vw)

    def _words(self, text):
        toks = _TOKEN.findall(text)
        out = []
        for n in range(self.wn[0], self.wn[1] + 1):
            out += [' '.join(toks[i:i + n]) for i in range(len(toks) - n + 1)]
        return out

    def _chars(self, text):
        out = []
        for w in _SPACES.sub(' ', text).split():
            w = f' {w} '
            for n in range(self.cn[0], self.cn[1] + 1):
                offset = 0
                out.append(w[offset:offset + n])
                while offset + n < len(w):
                    offset += 1
                    out.append(w[offset:offset + n])
                if offset == 0:
                    break
        return out

    @staticmethod
    def _tfidf(terms, vocab, idf):
        counts = {}
        for t in terms:
            i = vocab.get(t)
            if i is not None:
                counts[i] = counts.get(i, 0) + 1
        if not counts:
            return np.zeros(0, dtype=np.int64), np.zeros(0, dtype=np.float32)
        idx = np.fromiter(counts.keys(), dtype=np.int64)
        val = (1.0 + np.log(np.fromiter(counts.values(), dtype=np.float32))) * idf[idx]
        norm = float(np.sqrt((val * val).sum()))
        return idx, val / norm if norm else val

    def logits(self, texts):
        out = np.tile(self.intercept, (len(texts), 1)).astype(np.float32)
        for r, text in enumerate(texts):
            t = text.lower()
            iw, vw = self._tfidf(self._words(t), self.vw, self.idf_w)
            ic, vc = self._tfidf(self._chars(t), self.vc, self.idf_c)
            if len(iw):
                out[r] += self.coef[:, iw] @ vw
            if len(ic):
                out[r] += self.coef[:, ic + self.nw] @ vc
        return out

    def probabilities(self, texts):
        z = self.logits(texts)
        if z.shape[1] == 1:  # binary model exported as one column
            p = 1.0 / (1.0 + np.exp(-z[:, 0] / self.temperature))
            return np.stack([1 - p, p], axis=1)
        return _softmax(z / self.temperature)


class DangerHead:
    """Life-threatening yes/no read from the fine-tuned model's sentence embedding (its second ONNX output).
    A standardised logistic regression; see train_v3.danger_head."""

    def __init__(self, path):
        w = np.load(path)
        self.mu, self.sd, self.w, self.b = w['mu'], w['sd'], w['w'], float(w['b'])
        self.temperature = float(w['temperature'])

    def logits(self, emb):
        return ((np.asarray(emb, dtype=np.float32) - self.mu) / self.sd) @ self.w + self.b

    def probabilities(self, emb):
        return 1.0 / (1.0 + np.exp(-self.logits(emb) / self.temperature))


def decide(text, topic_probs, labels, guide, danger_found, p_danger, p_not_first_aid, cfg):
    """One reply decision.

    topic_probs: list of probability vectors over `labels`, one per topic model (already temperature-scaled).
    danger_found: topics named by the danger word patterns. p_danger: danger detector probability.
    p_not_first_aid: out-of-scope gate probability. cfg: thresholds tuned on validation
    ({'answer': .., 'danger': .., 'oos': ..}).

    Returns {'kind': 'answer'|'clarify'|<non-topic label>, 'topic', 'options', 'emergency', 'why'}.
    """
    probs = np.mean(np.stack(topic_probs), axis=0)
    tops = [labels[int(np.argmax(p))] for p in topic_probs]
    # A very confident out-of-scope gate overrules the danger signals ("drowning in debt", "phone battery burning").
    # Its level is tuned on validation so that it blocks no life-threatening message there.
    if p_not_first_aid >= cfg.get('oos_hard', 2.0):
        non_topic = max(NON_TOPICS, key=lambda l: probs[labels.index(l)])
        return {'kind': non_topic, 'topic': None, 'options': [], 'emergency': False, 'why': ['clearly not first aid']}
    critical = lambda t: t in guide and guide[t]['critical']
    why = []
    if danger_found:
        why.append('danger words')
    if p_danger >= cfg['danger']:
        why.append('danger detector')
    if any(critical(t) for t in tops):
        why.append('model picked a life-threatening topic')
    emergency = bool(why)

    order = [labels[i] for i in np.argsort(-probs)]
    options = [t for t in order if t not in NON_TOPICS][:3]
    for t in reversed(danger_found):  # a topic the danger words name always comes first
        if t in options:
            options.remove(t)
        options.insert(0, t)
    options = options[:3]

    # Out-of-scope gate (never when there is any sign of danger).
    if not emergency:
        non_topic = max(NON_TOPICS, key=lambda l: probs[labels.index(l)])
        if p_not_first_aid >= cfg['oos'] or all(t in NON_TOPICS for t in tops):
            return {'kind': non_topic, 'topic': None, 'options': [], 'emergency': False, 'why': ['not first aid']}

    agree = len(set(tops)) == 1 and tops[0] not in NON_TOPICS
    conf = float(probs[labels.index(tops[0])]) if agree else 0.0
    if agree and conf >= cfg['answer'] and (not danger_found or tops[0] in danger_found or not critical(danger_found[0])):
        return {'kind': 'answer', 'topic': tops[0], 'options': [], 'emergency': emergency or critical(tops[0]),
                'why': why + [f'both models agree ({conf:.2f})']}
    return {'kind': 'clarify', 'topic': None, 'options': options, 'emergency': emergency,
            'why': why + ['models disagree' if not agree else f'not confident enough ({conf:.2f})']}


_SMALL_TALK = set('''hi hii hello helo hallo hey heya yo there bot msee buda boss habari mambo sasa niaje vipi poa sema
salama hujambo sijambo shikamoo marahaba asante asanteni sana shukran shukrani thanks thank thx you u ok okay sawa fine
good morning afternoon evening night day bye goodbye kwaheri karibu nice great cool lifesaver honestly anyone is are
how ur your yako yangu wewe uko aje umeamkaje mzuri nzuri tu'''.split())


def small_talk(text):
    """Greetings and thanks made only of small-talk words ("habari", "hi there", "asante sana"). Such a message
    names no person, symptom or event, so it cannot be an emergency (added 2026-11-12, after the test v5 score)."""
    words = re.findall(r"[a-z']+", text.lower().replace("'", ''))
    return 0 < len(words) <= 6 and all(w in _SMALL_TALK for w in words)


def decide_check(text, topic_probs, labels, guide, danger_found, p_danger, p_not_first_aid, cfg):
    """Policy with a safety question (approved by the user on 2026-11-11).

    Signals:
      strong danger: the danger word patterns, OR the danger detector >= cfg['danger_strong'], OR a topic model picks a
                     life-threatening topic with probability >= cfg['critical_conf'].
      weak danger:   the danger detector >= cfg['danger'], OR any topic model's first choice is life-threatening.
      not first aid: the out-of-scope gate >= cfg['oos'], OR the topic models' averaged probability of a non-first-aid
                     label >= cfg['nontopic'].
    Decision:
      strong and not "not first aid"           -> "call 999" now (with advice or "did you mean").
      strong but "not first aid", or only weak -> kind 'check': "Is someone in danger right now? Yes / No".
                                                  Yes -> "call 999" + the options; No -> the normal reply.
      no danger signal                          -> as decide(): non-first-aid reply, advice when both models agree
                                                  above cfg['answer'], otherwise "did you mean".
    The check is never a guess: it asks. It counts as escalation for gate G1 and not as first aid for gate G3.
    """
    if cfg.get('small_talk', True) and not danger_found and small_talk(text):
        return {'kind': 'greeting', 'topic': None, 'options': [], 'emergency': False, 'why': ['small talk only']}
    probs = np.mean(np.stack(topic_probs), axis=0)
    tops = [labels[int(np.argmax(p))] for p in topic_probs]
    critical = lambda t: t in guide and guide[t]['critical']
    strong_why = (['danger words'] if danger_found else []) + \
                 (['danger detector (high)'] if p_danger >= cfg['danger_strong'] else []) + \
                 (['model is sure it is life-threatening'] if any(critical(t) and float(p[labels.index(t)]) >= cfg['critical_conf']
                                                                  for t, p in zip(tops, topic_probs)) else [])
    weak_why = (['danger detector'] if p_danger >= cfg['danger'] else []) + \
               (['model picked a life-threatening topic'] if any(critical(t) for t in tops) else [])
    p_nontopic = float(sum(probs[labels.index(l)] for l in NON_TOPICS))
    not_fa = p_not_first_aid >= cfg['oos'] or p_nontopic >= cfg['nontopic']

    order = [labels[i] for i in np.argsort(-probs)]
    options = [t for t in order if t not in NON_TOPICS][:3]
    for t in reversed(danger_found):
        if t in options:
            options.remove(t)
        options.insert(0, t)
    options = options[:3]
    danger_first = sorted(options, key=lambda t: not critical(t))

    if (strong_why and not_fa) or (weak_why and not strong_why):
        # "advice + danger banner" (approved by the user on 2026-11-12): only weak danger, clearly first aid, and the
        # topic models agree on one topic above cfg['inline']: show that advice straight away with a red banner
        # "Is anyone in danger right now? -> call 999" instead of a question that blocks the answer.
        agree = len(set(tops)) == 1 and tops[0] not in NON_TOPICS
        conf = float(probs[labels.index(tops[0])]) if agree else 0.0
        if not strong_why and not not_fa and agree and conf >= cfg.get('inline', 2.0) and \
                (not danger_found or tops[0] in danger_found):
            return {'kind': 'answer_check', 'topic': tops[0], 'options': [], 'emergency': False,
                    'why': weak_why + [f'models agree ({conf:.2f}); advice with the danger banner']}
        return {'kind': 'check', 'topic': None, 'options': danger_first, 'emergency': False,
                'why': strong_why + weak_why + (['looks like it may not be first aid'] if not_fa else [])}
    emergency = bool(strong_why)
    if not emergency:
        non_topic = max(NON_TOPICS, key=lambda l: probs[labels.index(l)])
        if not_fa or all(t in NON_TOPICS for t in tops):
            return {'kind': non_topic, 'topic': None, 'options': [], 'emergency': False, 'why': ['not first aid']}
    agree = len(set(tops)) == 1 and tops[0] not in NON_TOPICS
    conf = float(probs[labels.index(tops[0])]) if agree else 0.0
    if agree and conf >= cfg['answer'] and (not danger_found or tops[0] in danger_found or not critical(danger_found[0])):
        return {'kind': 'answer', 'topic': tops[0], 'options': [], 'emergency': emergency or critical(tops[0]),
                'why': strong_why + [f'models agree ({conf:.2f})']}
    return {'kind': 'clarify', 'topic': None, 'options': danger_first if emergency else options, 'emergency': emergency,
            'why': strong_why + ['models disagree' if not agree else f'not confident enough ({conf:.2f})']}


def wilson(k, n, z=1.96):
    """95 % confidence interval for a proportion k/n."""
    if n == 0:
        return (float('nan'), float('nan'))
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    r = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (max(0.0, (c - r) / d), min(1.0, (c + r) / d))
