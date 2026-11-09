"""The first-aid assistant used by the backend: understands a caretaker's message and answers from the guide.

Runtime needs only numpy, onnxruntime and tokenizers (no PyTorch). Files come from firstaid/artifacts:
guide.json (the advice), intent.onnx + tokenizer.json (the fine-tuned question model) and intent.json (labels,
temperature, confidence threshold).

How a reply is chosen:
1. A tapped follow-up button names its topic directly.
2. A typed "yes"/"no" answers the last follow-up question.
3. A safety check looks for danger words (not breathing, chest pain, heavy bleeding...). If it fires, the reply
   always starts with "call 999 or 112", whatever the model says.
4. The model picks a topic. If it is not confident enough, the assistant asks which of its top guesses is meant
   rather than guessing. Advice text only ever comes from the guide.
"""
import json
import re
import zlib
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ARTIFACTS = HERE / 'artifacts'
NON_TOPICS = ('out_of_scope', 'general_medical', 'greeting')
MAX_TOKENS = 64

# Danger signs -> the topic to answer if the model is unsure. Matching is on lower-case text.
DANGER = [
    ('cpr', r"not breathing|isn'?t breathing|stopped breathing|no pulse|heart (has )?stopped|cardiac arrest|"
            r"hapumui|ameacha kupumua|haupumui|moyo (wake )?umesimama|kifua hakipandi"),
    ('unresponsive_breathing', r"unconscious|unresponsive|not responding|won'?t wake|can'?t wake|passed out|"
                               r"hajitambui|amepoteza fahamu|hazinduki|amezimia|hajibu chochote"),
    ('choking_severe', r"chok(e|ed|ing)|kabwa|kimekwama kooni|umekwama kooni|umemkwama"),
    ('heart_attack', r"chest pain|pain in (his|her|my|the) chest|chest (is )?(tight|pressure|squeez)|heart attack|"
                     r"maumivu ya kifua|kifua kina(uma|muuma|bana|mbana)|mshtuko wa moyo"),
    ('stroke', r"stroke|face (is )?droop|drooping|slurred|kiharusi|uso (wake )?umepinda|mdomo umepinda|amepooza"),
    ('severe_bleeding', r"(bleeding|blood)[^.]{0,25}(a lot|heavily|won'?t stop|not stopping|spurting|pumping|gushing|everywhere|so much)|"
                        r"heavy bleeding|damu nyingi|damu haikomi|damu inaruka|damu inatoka (sana|kwa nguvu)|damu nyingi sana"),
    ('anaphylaxis', r"(throat|tongue|lips?) (is |are )?(swell|swollen)|epipen|anaphyla|koo limevimba|ulimi umevimba|midomo imevimba"),
    ('seizure', r"seizure|convuls|fitting|epileptic|kifafa|degedege"),
    ('poisoning', r"poison|drank (bleach|paraffin|jik)|swallowed (bleach|paraffin|jik|pesticide)|charcoal|carbon monoxide|"
                  r"sumu|mafuta ya taa|dawa ya (panya|mende|wadudu)|moshi wa (jiko|makaa)|jiko la makaa"),
    ('snake_bite', r"snake|nyoka|swila"),
    ('drowning', r"drown|kuzama|amezama"),
    ('electric_shock', r"electrocut|electric shock|live wire|umeme umemshika|amepigwa na umeme|stima imemshika|ameguswa na stima"),
    ('spinal_injury', r"can'?t (feel|move) (his|her|my) (legs|feet)|hawezi kuhisi miguu|hawezi kusogeza miguu"),
    ('breathing_difficulty', r"can'?t breathe|cannot breathe|struggling to breathe|hawezi kupumua|hapati hewa"),
]
DANGER = [(topic, re.compile(rx)) for topic, rx in DANGER]
YES = re.compile(r"^\s*(yes|yeah|yep|y|ndio|ndiyo|eeh|ee|yes he is|yes she is|anapumua)\b", re.I)
NO = re.compile(r"^\s*(no|nope|n|hapana|la|hapumui|not)\b", re.I)

SW_WORDS = set('''na ya wa kwa ni la za je nini gani vipi mtu yeye wake yake huyo hii hiyo sana tu bado kama lakini au
anaweza hawezi hana hajui nifanye nimpe tafadhali haraka msaada nisaidie mzee bibi babu mgonjwa mama baba damu kichwa
tumbo kifua mguu mkono jicho pua koo moto maji dawa sukari homa pumzi kupumua baada kabla leo jana asubuhi usiku ghafla
kidogo nyingi habari asante sasa mambo poa ndio ndiyo hapana'''.split())

TEXT = {
    'en': {
        'open': ['Okay, let\'s go through this together.', 'I\'m here to help. Stay calm, you are doing the right thing.',
                 'Thank you for asking. Here is what to do.', 'Let\'s deal with this step by step.'],
        'open_urgent': ['This could be an emergency.', 'This sounds serious.', 'Act quickly, this may be an emergency.'],
        'steps': 'What to do:', 'avoid': 'Do not:', 'more': 'Tap an answer, or describe what is happening.',
        'note': 'This is first-aid guidance, not a diagnosis. If you are unsure or things get worse, call 999 or 112.',
        'clarify': 'I want to make sure I give you the right steps. Is it one of these?',
        'clarify_other': 'Something else',
        'other_hint': 'Tell me in a few words what happened, for example "she fell and hit her head" or "he is choking".',
        'greeting': 'Hello! I can guide you through first aid, for example falls, bleeding, burns, choking, chest pain, '
                    'fits or low blood sugar. Describe what is happening, in English or Kiswahili.',
        'out_of_scope': 'I can only help with first aid and emergencies. Describe what has happened to the person, '
                        'for example "she fell" or "he has chest pain".',
        'general_medical': 'That sounds like a general health question rather than first aid. Their doctor, nurse or '
                           'pharmacist is the best person to ask. If they are unwell right now, tell me the signs you see.',
        'emergency': 'Call 999 or 112 now.',
        'clarify_urgent': 'If the person is unresponsive, not breathing normally, bleeding heavily or getting worse, call 999 or 112 now.',
    },
    'sw': {
        'open': ['Sawa, tupitie hili pamoja.', 'Niko hapa kukusaidia. Tulia, unafanya jambo sahihi.',
                 'Asante kwa kuuliza. Haya ndiyo ya kufanya.', 'Tushughulikie hili hatua kwa hatua.'],
        'open_urgent': ['Hii inaweza kuwa dharura.', 'Hili linaonekana kuwa zito.', 'Chukua hatua haraka, hii inaweza kuwa dharura.'],
        'steps': 'Cha kufanya:', 'avoid': 'Usifanye:', 'more': 'Gusa jibu, au eleza kinachoendelea.',
        'note': 'Huu ni ushauri wa huduma ya kwanza, si uchunguzi wa daktari. Ukiwa na shaka au hali ikizidi, piga 999 au 112.',
        'clarify': 'Nataka kuhakikisha nakupa hatua sahihi. Je, ni mojawapo ya haya?',
        'clarify_other': 'Kitu kingine',
        'other_hint': 'Niambie kwa maneno machache kilichotokea, kwa mfano "ameanguka akagonga kichwa" au "amekabwa".',
        'greeting': 'Habari! Naweza kukuongoza katika huduma ya kwanza, kwa mfano kuanguka, kutokwa damu, kuungua, '
                    'kukabwa, maumivu ya kifua, kifafa au sukari kushuka. Eleza kinachoendelea, kwa Kiswahili au Kiingereza.',
        'out_of_scope': 'Naweza kusaidia tu na huduma ya kwanza na dharura. Eleza kilichompata mtu, kwa mfano '
                        '"ameanguka" au "ana maumivu ya kifua".',
        'general_medical': 'Hilo linaonekana kuwa swali la afya kwa ujumla badala ya huduma ya kwanza. Daktari, muuguzi '
                           'au mfamasia wake ndiye bora kuulizwa. Kama anaumwa sasa hivi, niambie dalili unazoziona.',
        'emergency': 'Piga 999 au 112 sasa hivi.',
        'clarify_urgent': 'Kama mtu hajitambui, hapumui kawaida, anatokwa damu nyingi au hali inazidi, piga 999 au 112 sasa hivi.',
    },
}


def detect_lang(text):
    words = re.findall(r"[a-z']+", text.lower())
    if not words:
        return 'en'
    sw = sum(w in SW_WORDS or (len(w) > 4 and w.startswith(('ame', 'ana', 'hawe', 'nime', 'ali', 'aki', 'ata', 'ku')))
             for w in words)
    return 'sw' if sw / len(words) >= 0.35 else 'en'


_KEYWORD_DANGER = {}


def keyword_danger(guide):
    """Danger patterns from the guide itself: every keyword of every life-threatening topic."""
    key = id(guide)
    if key not in _KEYWORD_DANGER:
        pats = []
        for tid, t in guide.items():
            if t['critical'] and t.get('classify', True):
                words = sorted(t['keywords'], key=len, reverse=True)
                pats.append((tid, re.compile(r'\b(' + '|'.join(re.escape(w) for w in words) + r')\b')))
        _KEYWORD_DANGER[key] = pats
    return _KEYWORD_DANGER[key]


def danger_topics(text, guide=None):
    """Life-threatening topics whose danger words appear in the message (hand-written patterns first)."""
    t = text.lower()
    found = [topic for topic, rx in DANGER if rx.search(t)]
    if guide:
        found += [topic for topic, rx in keyword_danger(guide) if topic not in found and rx.search(t)]
    return found


class FirstAidAssistant:
    def __init__(self, artifacts=ARTIFACTS):
        import onnxruntime as ort
        from tokenizers import Tokenizer
        artifacts = Path(artifacts)
        self.guide = json.loads((artifacts / 'guide.json').read_text(encoding='utf-8'))
        meta = json.loads((artifacts / 'intent.json').read_text(encoding='utf-8'))
        self.labels = meta['labels']
        self.temperature = meta['temperature']
        self.threshold = meta['threshold']
        self.tok = Tokenizer.from_file(str(artifacts / 'tokenizer.json'))
        self.tok.enable_truncation(MAX_TOKENS)
        self.tok.enable_padding(pad_id=self.tok.token_to_id('<pad>') or 1, pad_token='<pad>')
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2
        self.session = ort.InferenceSession(str(artifacts / 'intent.onnx'), opts, providers=['CPUExecutionProvider'])

    # ------------------------------------------------------------ understanding
    def probabilities(self, texts):
        enc = self.tok.encode_batch(['query: ' + t for t in texts])
        ids = np.array([e.ids for e in enc], dtype=np.int64)
        mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
        logits = self.session.run(None, {'input_ids': ids, 'attention_mask': mask})[0] / self.temperature
        logits -= logits.max(axis=1, keepdims=True)
        p = np.exp(logits)
        return p / p.sum(axis=1, keepdims=True)

    def understand(self, text):
        """(label, confidence, top-3 topic ids, danger topics)."""
        p = self.probabilities([text])[0]
        order = np.argsort(-p)
        top_topics = [self.labels[i] for i in order if self.labels[i] not in NON_TOPICS][:3]
        return self.labels[order[0]], float(p[order[0]]), top_topics, danger_topics(text, self.guide)

    # ------------------------------------------------------------ replying
    def reply(self, message='', topic=None, awaiting=None, lang=None):
        """message: what the caretaker typed. topic: a tapped button. awaiting: the topic whose follow-up question
        was just asked (so a typed yes/no can answer it). lang: 'en'/'sw' to force a language."""
        message = (message or '').strip()[:500]
        lang = lang if lang in TEXT else detect_lang(message) if message else 'en'
        if topic in self.guide:
            return self.answer(topic, lang, emergency=self.guide[topic]['critical'], how='button')
        if awaiting in self.guide and self.guide[awaiting].get('followup') and message:
            options = self.guide[awaiting]['followup']['options']
            if YES.match(message):
                return self.answer(options[0]['goto'], lang, emergency=self.guide[options[0]['goto']]['critical'], how='yes')
            if NO.match(message) and len(options) > 1:
                return self.answer(options[1]['goto'], lang, emergency=self.guide[options[1]['goto']]['critical'], how='no')
        if not message:
            return self.simple('greeting', lang)

        label, confidence, top, danger = self.understand(message)
        emergency = bool(danger)
        if label in NON_TOPICS and not danger:
            if confidence >= self.threshold or label == 'greeting':
                return self.simple(label, lang, confidence)
            return self.clarify(top, lang, confidence, emergency=False)
        if label in NON_TOPICS:  # danger words but the model saw no first-aid topic: trust the safety check
            return self.answer(danger[0], lang, emergency=True, how='safety', confidence=confidence)
        if confidence >= self.threshold:
            return self.answer(label, lang, emergency=emergency or self.guide[label]['critical'], how='model',
                               confidence=confidence)
        if danger:
            chosen = label if label in danger else danger[0]
            return self.answer(chosen, lang, emergency=True, how='safety', confidence=confidence)
        return self.clarify(top, lang, confidence, emergency=False)

    def _pick(self, options, key):
        return options[zlib.crc32(key.encode()) % len(options)]

    def answer(self, topic, lang, emergency, how, confidence=None):
        t, words = self.guide[topic], TEXT[lang]
        a = t['answer'][lang]
        urgent = a.get('urgent') or (words['emergency'] if emergency else None)
        opener = self._pick(words['open_urgent'] if emergency else words['open'], topic + lang + how)
        lines = [opener]
        if urgent:
            lines.append(urgent)
        lines.append(a['intro'])
        lines.append(words['steps'])
        lines += [f'{i}. {s}' for i, s in enumerate(a['steps'], 1)]
        if a['avoid']:
            lines.append(words['avoid'])
            lines += [f'- {s}' for s in a['avoid']]
        if a.get('after'):
            lines.append(a['after'])
        followup = None
        if t.get('followup'):
            f = t['followup']
            followup = {'question': f['ask'][lang],
                        'options': [{'label': o['label'][lang], 'topic': o['goto']} for o in f['options']]}
            lines.append(f['ask'][lang])
        return {'kind': 'answer', 'topic': topic, 'title': t['title'][lang], 'lang': lang, 'emergency': emergency,
                'how': how, 'confidence': confidence, 'opener': opener, 'urgent': urgent, 'intro': a['intro'],
                'steps': a['steps'], 'avoid': a['avoid'], 'after': a.get('after'), 'followup': followup,
                'note': words['note'], 'text': '\n'.join(lines)}

    def clarify(self, top, lang, confidence, emergency):
        words = TEXT[lang]
        options = [{'label': self.guide[t]['title'][lang], 'topic': t} for t in top]
        # if any guess is life-threatening, say how to get help now rather than wait for the answer
        emergency = emergency or any(self.guide[t]['critical'] for t in top)
        urgent = words['clarify_urgent'] if emergency else None
        text = '\n'.join([urgent, words['clarify']] if urgent else [words['clarify']])
        return {'kind': 'clarify', 'topic': None, 'lang': lang, 'emergency': emergency, 'confidence': confidence,
                'urgent': urgent, 'text': text, 'followup': {'question': words['clarify'], 'options': options},
                'hint': words['other_hint'], 'note': words['note']}

    def simple(self, label, lang, confidence=None):
        return {'kind': label, 'topic': None, 'lang': lang, 'emergency': False, 'confidence': confidence,
                'text': TEXT[lang][label], 'followup': None, 'note': TEXT[lang]['note']}
