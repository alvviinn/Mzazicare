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
    # added in round 3 (red flags from first-aid guidance, written before looking at the round-3 validation/test sets)
    ('burns', r"(burn|burnt|burned|scald)\w*[^.]{0,30}\b(face|mouth|throat|lips|airway|nose)\b|smoke inhal|breath\w* (in )?(the )?smoke|"
              r"(hoarse|singed|soot)[^.]{0,30}(voice|nose|mouth|hair)|ameungua (uso|mdomo|koo)|amevuta moshi"),
    ('head_injury', r"\b(hit|banged|knocked|bumped|fell)\b[^.]{0,40}\bhead\b[^.]{0,60}(vomit|throw\w* up|confus|sleepy|drowsy|"
                    r"not making sense|fit|seizure|blood from (his |her )?(ear|nose))|kichwa[^.]{0,40}(anatapika|amechanganyikiwa|usingizi)"),
    ('cpr', r"turn(ing|ed)? blue|lips (are |r )?blue|gone blue|midomo (ni |imekuwa )?(bluu|blue)"),
    ('severe_bleeding', r"lots of blood|blood everywhere|too much blood|so much blood|soak\w* (through|the)|pool of blood|"
                        r"damu (kibao|mingi|imejaa)"),
    # added in round 3b: red flags of normally minor topics (standard first-aid "call an ambulance" signs). Written
    # AFTER seeing round-3 validation errors, so validation over-states their effect; the frozen test does not.
    ('severe_bleeding', r"bleeding[^.]{0,20}like a tap|damu (inatoka |inamwagika )?kama (bomba|maji)"),
    ('fracture', r"bone[^.]{0,15}(sticking|poking|coming|showing|through)[^.]{0,10}(out|skin)|open fracture|"
                 r"mfupa[^.]{0,20}(umetoka nje|unaonekana nje|nje ya ngozi|umetoboa ngozi)|leg[^.]{0,30}(shorter|turned out|rolled out)|mguu[^.]{0,30}(mfupi|umegeuka)"),
    ('burns', r"(large|big|huge|whole|entire|most of)[^.]{0,25}(burn|scald)|(burn|scald)\w*[^.]{0,40}\b(white|leathery|charred|black)\b|"
              r"(boiling|hot) (water|oil|porridge|uji|chai|tea)[^.]{0,40}\b(baby|chest|back|body|all over)\b|"
              r"ameungua[^.]{0,20}(mwili|sana|kifua|mgongo)"),
    ('eye_injury', r"(chemical|bleach|jik|acid|hot oil|cement|lime|paraffin)[^.]{0,30}\beyes?\b|"
                   r"\beyes?\b[^.]{0,30}(chemical|bleach|jik|acid|hot oil)|(stuck|sticking|lodged|embedded)[^.]{0,20}\beyes?\b|"
                   r"\beyes?\b[^.]{0,20}(stuck|sticking out|pierced)|jicho[^.]{0,30}(jik|kemikali|asidi|mafuta ya moto|kimekwama)"),
    ('medication_mistake', r"(double|twice|extra|two)[^.]{0,20}insulin|insulin[^.]{0,30}(double|twice|too much|extra|overdose)|"
                           r"overdose|too many (pills|tablets)|whole (bottle|packet|strip|box) of|ameza dawa (nyingi|zote)|"
                           r"insulini[^.]{0,30}(mara mbili|nyingi)"),
    ('high_blood_sugar', r"(insulin|insulini|kisukari|diabet|sugar)[^.]{0,60}(vomit|kutapika|anatapika|drowsy|fruity)|"
                         r"(vomit|kutapika|anatapika)[^.]{0,60}(insulin|insulini|kisukari|diabet)"),
    ('fever', r"stiff neck|neck (is )?(stiff|rigid)|rash[^.]{0,20}(does ?n'?t|doesnt|won'?t|not) fade|shingo (imekaza|ngumu)"),
    ('heat_illness', r"not sweating|stopped sweating|no sweat|hatoi jasho"),
    ('abdominal_pain', r"(belly|stomach|tummy|tumbo)[^.]{0,30}(hard|rigid|like a board|kama jiwe)|vomit\w*[^.]{0,10}blood|"
                       r"blood in (his|her|the) vomit|anatapika damu"),
    ('dehydration', r"(no|not|hasn'?t) (pee|peed|urine|passed urine)|hajakojoa|sunken eyes|macho yamezama"),
    ('head_injury', r"(warfarin|blood thinner|rivaroxaban|apixaban|xarelto)[^.]{0,80}\b(head|fell|fall)\b|"
                    r"\b(head|fell|fall)\b[^.]{0,80}(warfarin|blood thinner|rivaroxaban|apixaban|xarelto)|"
                    r"headache[^.]{0,20}(getting worse|worse and worse|inazidi)|kichwa[^.]{0,40}inazidi"),
    ('asthma', r"inhaler[^.]{0,20}(not|isn'?t|hasn'?t|doesn'?t|haisaidii)[^.]{0,10}(help|work)|"
               r"can'?t (speak|talk)[^.]{0,20}breath|pumu[^.]{0,40}(haisaidii|haifanyi kazi)"),
    ('fall', r"(on|kwenye) (the )?(floor|sakafu|sakafuni)[^.]{0,40}(all night|since (last night|morning)|hours|cold|baridi)|"
             r"usiku[^.]{0,20}(sakafuni|chini)|ako sakafuni[^.]{0,30}baridi"),
]
DANGER += [
    # added in round 3c: subtle red flags (standard first-aid signs; prompted by the misses on the round-3 frozen test,
    # which is now retired; the round-3c test is new and unseen)
    ('hypothermia', r"(not|no longer|stopped) shivering|isn'?t shivering|ameacha kutetemeka|hatetemeki (tena|tena)"),
    ('head_injury', r"(clear|watery|colou?rless) (fluid|liquid|water|discharge)[^.]{0,30}\b(nose|ears?|pua|sikio|masikio)\b|"
                    r"maji (meupe |safi )?(yanatoka|kutoka|yanayotoka)[^.]{0,20}(pua|sikio|masikio)"),
    ('confusion', r"(can'?t|cannot|barely|hard to|struggl\w* to) (keep (him|her|them|mum|dad) awake|wake (him|her|them) up)|"
                  r"(so|very|really) (sleepy|drowsy)[^.]{0,40}(can'?t|barely|hard to|won'?t) (keep|stay|wake)|"
                  r"haamki vizuri|ni vigumu kumwamsha|analala lala sana"),
    ('breathing_difficulty', r"(oxygen|oksijeni|o2)[^.]{0,25}(finished|run out|ran out|running out|empty|imeisha|imekwisha)|"
                             r"(ran out of|run out of|finished the|no more) (home )?oxygen|"
                             r"(lips|fingers|fingertips|nails)[^.]{0,15}(dusky|grey|gray|bluish)"),
    ('abdominal_pain', r"coffee[- ]?grounds?|black (tarry|sticky) (stool|poo|poop)|tarry stool|choo cheusi"),
]
DANGER = [(topic, re.compile(rx)) for topic, rx in DANGER]

_NUM = r"(\d{1,3}(?:[.,]\d)?)"
_SUGAR = re.compile(r"\b(sugar|sukari|glucose|glucometer|gluco|bs|rbs|fbs|meter|reading)\b[^0-9\n]{0,20}" + _NUM)
_SUGAR_HILO = re.compile(r"\b(glucometer|meter|sugar|sukari|glucose)\b[^.\n]{0,25}\b(hi|high|lo)\b(?![a-z])")
_TEMP = re.compile(r"\b(temp|temperature|thermometer|joto|homa)\b[^0-9\n]{0,20}" + _NUM)
_BP = re.compile(r"(\d{2,3})\s*(?:/|over|juu ya)\s*(\d{2,3})")
_BP_WORD = re.compile(r"\b(bp|pressure|presha|shinikizo)\b")
_SPO2 = re.compile(r"\b(spo2|sp02|spo|sats?|saturation|oxygen|oximeter|o2)\b[^0-9\n]{0,20}(\d{2})\s*%?")


_HIGH_SUGAR_SIGNS = re.compile(r"vomit|throw\w* up|kutapika|anatapika|drows|sleepy|usingizi|confus|changanyikiwa|"
                               r"breath|kupumua|fruity|not making sense|ovyo|hajitambui|weak and|very weak|dhaifu sana")
_BP_SIGNS = re.compile(r"headache|head is pounding|chest|vision|blurr|confus|weak|numb|vomit|slurr|nose ?bleed|"
                       r"kichwa|kifua|kutapika|anatapika|macho|amechanganyikiwa")


def reading_danger(text):
    """Life-threatening topics from numbers in the message (home device readings), standard first-aid thresholds:
    blood sugar >= 25 mmol/L (450 mg/dL) or the meter showing HI, WITH a warning sign (vomiting, drowsy, confused,
    breathing hard); <= 2.0 mmol/L (36 mg/dL) or LO; temperature <= 35 C or >= 40.5 C; blood pressure >= 180 systolic
    or >= 120 diastolic WITH a warning sign (headache, chest pain, vision, weakness, confusion), or >= 220/130 on its
    own, or <= 80 systolic; oxygen saturation < 90 %."""
    t = text.lower()
    found = []
    for m in _SUGAR.finditer(t):
        v = float(m.group(2).replace(',', '.'))
        mmol = v if v <= 40 else v / 18.0
        if mmol >= 25 and _HIGH_SUGAR_SIGNS.search(t):
            found.append('high_blood_sugar')
        elif 0 < mmol <= 2.0:
            found.append('low_blood_sugar')
    for m in _SUGAR_HILO.finditer(t):
        if m.group(2) == 'lo':
            found.append('low_blood_sugar')
        elif _HIGH_SUGAR_SIGNS.search(t):
            found.append('high_blood_sugar')
    for m in _TEMP.finditer(t):
        v = float(m.group(2).replace(',', '.'))
        if 25 <= v <= 35:
            found.append('hypothermia')
        elif 40.5 <= v <= 45:
            found.append('fever')
    if _BP_WORD.search(t):
        for m in _BP.finditer(t):
            s, d = int(m.group(1)), int(m.group(2))
            if 60 <= s <= 300 and 30 <= d <= 200 and s > d:
                if s >= 220 or d >= 130 or ((s >= 180 or d >= 120) and _BP_SIGNS.search(t)):
                    found.append('high_blood_pressure')
                elif s <= 80:
                    found.append('shock')
    for m in _SPO2.finditer(t):
        v = int(m.group(2))
        if 50 <= v < 90:
            found.append('breathing_difficulty')
    return list(dict.fromkeys(found))
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
    found = list(dict.fromkeys([topic for topic, rx in DANGER if rx.search(t)] + reading_danger(t)))
    if guide:
        found += [topic for topic, rx in keyword_danger(guide) if topic not in found and rx.search(t)]
    return found


CHECK_TEXT = {
    'en': {'question': 'Is someone in danger right now? For example not breathing, not waking, bleeding heavily, or '
                       'getting worse fast.', 'yes': 'Yes, in danger', 'no': 'No',
           'banner': 'Is anyone in danger right now: not breathing, not waking, bleeding heavily or getting worse '
                     'fast? Call 999 or 112 now.'},
    'sw': {'question': 'Je, kuna mtu yuko hatarini sasa hivi? Kwa mfano hapumui, haamki, anatokwa damu nyingi, au hali '
                       'inazidi haraka.', 'yes': 'Ndiyo, yuko hatarini', 'no': 'Hapana',
           'banner': 'Je, kuna mtu yuko hatarini sasa hivi: hapumui, haamki, anatokwa damu nyingi au hali inazidi '
                     'haraka? Piga 999 au 112 sasa hivi.'},
}
CHECK_YES, CHECK_NO = '__check_yes', '__check_no'


class FirstAidAssistant:
    """Round-3 policy (safety.decide_check, chosen on validation and passed on the sealed test v4) when
    artifacts/policy.json names a chosen candidate and its models are present; otherwise the original policy."""

    def __init__(self, artifacts=ARTIFACTS):
        import onnxruntime as ort
        from tokenizers import Tokenizer
        artifacts = Path(artifacts)
        self.guide = json.loads((artifacts / 'guide.json').read_text(encoding='utf-8'))
        meta = json.loads((artifacts / 'intent.json').read_text(encoding='utf-8'))
        self.labels = meta['labels']
        self.temperature = meta['temperature']
        self.threshold = meta['threshold']
        self.policy = None
        pol = artifacts / 'policy.json'
        if pol.exists():
            p = json.loads(pol.read_text(encoding='utf-8'))
            chosen = p.get('chosen_before_test')
            if chosen and all((artifacts / f'{m}.npz').exists() for m in ('baseline', 'danger', 'oos_gate')):
                from .safety import LinearText
                c = dict(p['candidates'][chosen])
                self.models = c.pop('models')
                c.pop('passes_on_validation_with_margin', None)
                c.setdefault('oos_hard', 2.0)
                self.policy = {'temperature': p['temperature'], **c}
                self.linear = {m: LinearText(artifacts, m) for m in ('baseline', 'danger', 'oos_gate')}
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

    def _logits(self, text):
        enc = self.tok.encode_batch(['query: ' + text])
        ids = np.array([e.ids for e in enc], dtype=np.int64)
        mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
        return self.session.run(None, {'input_ids': ids, 'attention_mask': mask})[0]

    def decide(self, text, no_danger=False):
        """The round-3 decision, computed exactly as in evaluate_v3.run. no_danger: the caretaker answered "No" to the
        safety question, so the danger signals are set aside."""
        from .safety import decide_check

        def soft(z, t):
            z = z / t
            z = z - z.max(axis=1, keepdims=True)
            e = np.exp(z)
            return e / e.sum(axis=1, keepdims=True)
        cfg, temp = self.policy, self.policy['temperature']
        z = {'finetuned': self._logits(text), 'baseline': self.linear['baseline'].logits([text])}
        probs = [soft(z[m], temp[m])[0] for m in self.models]
        sig = lambda m: float(1.0 / (1.0 + np.exp(-self.linear[m].logits([text])[0, 0] / temp[m])))
        p_danger, p_oos = sig('danger'), sig('oos_gate')
        found = danger_topics(text, self.guide)
        if no_danger:
            found, p_danger = [], 0.0
            probs = [p.copy() for p in probs]
            for p in probs:  # without the danger signals, a life-threatening first choice must not re-trigger the question
                for i, l in enumerate(self.labels):
                    if l in self.guide and self.guide[l]['critical']:
                        p[i] *= 0.0
                s = p.sum()
                if s > 0:
                    p /= s
        return decide_check(text, probs, self.labels, self.guide, found, p_danger, p_oos, cfg)

    def _reply_v3(self, message, lang, check=None):
        if check == 'yes':
            d = self.decide(message)
            options = d['options'] or [t for t in danger_topics(message, self.guide)][:3] or ['call_for_help']
            r = self.clarify(options[:3], lang, None, emergency=True)
            r['urgent'] = TEXT[lang]['emergency']
            r['text'] = '\n'.join([r['urgent'], TEXT[lang]['clarify']])
            r['how'] = 'check_yes'
            return r
        d = self.decide(message, no_danger=(check == 'no'))
        if d['kind'] == 'check':
            words = CHECK_TEXT[lang]
            return {'kind': 'check', 'topic': None, 'lang': lang, 'emergency': False, 'confidence': None,
                    'text': words['question'], 'check_message': message, 'note': TEXT[lang]['note'],
                    'followup': {'question': words['question'],
                                 'options': [{'label': words['yes'], 'topic': CHECK_YES},
                                             {'label': words['no'], 'topic': CHECK_NO}]}}
        if d['kind'] == 'answer':
            return self.answer(d['topic'], lang, emergency=d['emergency'], how='model')
        if d['kind'] == 'answer_check':  # advice at once, under the red "anyone in danger? call 999" banner
            r = self.answer(d['topic'], lang, emergency=False, how='banner')
            r['danger_banner'] = CHECK_TEXT[lang]['banner']
            r['text'] = r['danger_banner'] + '\n' + r['text']
            return r
        if d['kind'] == 'clarify':
            return self.clarify(d['options'], lang, None, emergency=d['emergency'], escalate=False)
        return self.simple(d['kind'], lang)

    def understand(self, text):
        """(label, confidence, top-3 topic ids, danger topics)."""
        p = self.probabilities([text])[0]
        order = np.argsort(-p)
        top_topics = [self.labels[i] for i in order if self.labels[i] not in NON_TOPICS][:3]
        return self.labels[order[0]], float(p[order[0]]), top_topics, danger_topics(text, self.guide)

    # ------------------------------------------------------------ replying
    def reply(self, message='', topic=None, awaiting=None, lang=None, check=None):
        """message: what the caretaker typed. topic: a tapped button. awaiting: the topic whose follow-up question
        was just asked (so a typed yes/no can answer it). lang: 'en'/'sw' to force a language. check: 'yes'/'no',
        the answer to the safety question "Is someone in danger right now?" (sent with the original message)."""
        message = (message or '').strip()[:500]
        lang = lang if lang in TEXT else detect_lang(message) if message else 'en'
        if check in ('yes', 'no') and message and self.policy:
            return self._reply_v3(message, lang, check)
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
        if self.policy:
            return self._reply_v3(message, lang)

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

    def clarify(self, top, lang, confidence, emergency, escalate=True):
        words = TEXT[lang]
        options = [{'label': self.guide[t]['title'][lang], 'topic': t} for t in top]
        # if any guess is life-threatening, say how to get help now rather than wait for the answer (the round-3
        # policy decides this itself, escalate=False, so the app shows exactly what was evaluated)
        emergency = emergency or (escalate and any(self.guide[t]['critical'] for t in top))
        urgent = words['clarify_urgent'] if emergency else None
        text = '\n'.join([urgent, words['clarify']] if urgent else [words['clarify']])
        return {'kind': 'clarify', 'topic': None, 'lang': lang, 'emergency': emergency, 'confidence': confidence,
                'urgent': urgent, 'text': text, 'followup': {'question': words['clarify'], 'options': options},
                'hint': words['other_hint'], 'note': words['note']}

    def simple(self, label, lang, confidence=None):
        return {'kind': label, 'topic': None, 'lang': lang, 'emergency': False, 'confidence': confidence,
                'text': TEXT[lang][label], 'followup': None, 'note': TEXT[lang]['note']}
