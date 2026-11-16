"""Medical word list: clinical and everyday words (English and Kiswahili) that name a first-aid situation.

The trained models handle ordinary descriptions well, but they gave up on single medical words ("laceration") and on
situations they were never trained on (suicidal thoughts, vomiting blood). This list is used ONLY where the models
gave up: when they said "not first aid" / "general health", or asked "did you mean" without naming the situation.
It never overrides an answer the models gave, so their tested behaviour on ordinary messages is unchanged.

topics(text)    -> the guide topics the message names, most urgent first (at most 3)
is_health(text) -> True if the message is about health, the body or an injury at all (so it is never turned away)
"""
import re

# (pattern, topics). Patterns are matched on the lower-cased message. The first topic listed is the likelier one.
TERMS = [
    # bleeding and wounds
    (r'\b(h(a)?emorrhag\w*|spurting|won\'?t stop bleeding|bleeding (a lot|heavily|badly|everywhere)|'
     r'blood everywhere|damu nyingi|anavuja damu|damu haikomi)\b', ['severe_bleeding']),
    # how bad a cut is is not said: offer both, under the red "anyone in danger?" banner
    (r'\b(lacerat\w*|gash\w*|deep cut|bad(ly)? cut|cut (really |very )?(bad|deep)\w*|slash\w*|stab(bed|bing)?|'
     r'amechomwa kisu)\b', ['severe_bleeding', 'minor_wound']),
    (r'\b(cut|cuts|wound|wounds|bleeding|bleeds|bled|jeraha|kidonda|amekatwa|amejikata|kukatwa|anatokwa damu|'
     r'kutokwa (na )?damu)\b', ['severe_bleeding', 'minor_wound']),
    (r'\b(graze\w*|scrape\w*|scratch\w*|abrasion\w*|plaster|mchubuko|amekwaruzwa)\b', ['minor_wound']),
    (r'\b(skin tear\w*|torn skin|thin skin|ngozi imechanika)\b', ['skin_tear']),
    (r'\b(impaled|embedded|stuck in (the |his |her |their )?(wound|leg|arm|hand|foot|skin|chest|back)|'
     r'nail (in|through)|splinter\w*|kibanzi|msumari umeingia|kitu kimekwama)\b', ['embedded_object']),
    (r'\b(nose ?bleed\w*|bleeding (from the |from his |from her )?nose|epistaxis|damu puani)\b', ['nosebleed']),
    (r'\b(vomit\w* blood|throw\w* up blood|cough\w* (up )?blood|blood in (the |his |her )?(stool|poo|vomit)|'
     r'black (stool|poo)\w*|tarry stool|h(a)?ematemesis|melaena|melena|internal bleeding|kutapika damu|'
     r'anatapika damu|kukohoa damu|kinyesi cheusi)\b', ['internal_bleeding']),
    # breathing, heart, brain
    (r'\b(not breathing|stopped breathing|no pulse|cardiac arrest|cpr|hapumui|ameacha kupumua)\b', ['cpr']),
    (r'\b(unconscious|unresponsive|won\'?t wake|not waking|not responding|hajitambui|amepoteza fahamu|haamki)\b',
     ['unresponsive_breathing', 'cpr']),
    (r'\b(chok\w*|something stuck in (his |her |the )?throat|kukabwa|amekabwa|anakabwa)\b', ['choking_severe']),
    (r'\b(chest pain|heart attack|cardiac|angina|tight chest|chest (is )?tight|palpitation\w*|racing heart|'
     r'maumivu ya kifua|kifua kinauma|shambulio la moyo)\b', ['heart_attack']),
    (r'\b(stroke|face (is )?droop\w*|droopy face|slurred speech|slurring|one side weak|weak (on one side|arm)|'
     r'kiharusi|mdomo umepinda|anaongea kwa shida)\b', ['stroke']),
    (r'\b(asthma\w*|inhaler|wheez\w*|pumu)\b', ['asthma']),
    (r'\b(short(ness)? of breath|breathless\w*|can\'?t breathe|cannot breathe|struggling to breathe|'
     r'difficulty breathing|hard to breathe|anakosa pumzi|kupumua kwa shida|hawezi kupumua)\b',
     ['breathing_difficulty', 'asthma']),
    (r'\b(seizure\w*|convuls\w*|fitting|having a fit|epilep\w*|kifafa|degedege)\b', ['seizure']),
    (r'\b(faint\w*|passed out|pass out|black(ed)? out|syncope|dizz\w*|light ?headed|kuzimia|amezimia|'
     r'kizunguzungu)\b', ['fainting']),
    (r'\b(confus\w*|delirium|disorient\w*|not making sense|amechanganyikiwa)\b', ['confusion']),
    (r'\b(headache\w*|head ?ache|migraine\w*|head (hurts|pain)|kichwa kinauma|maumivu ya kichwa|kipandauso)\b',
     ['headache']),
    (r'\b(shock|pale and (cold|clammy)|cold and clammy|clammy)\b', ['shock']),
    # injuries
    (r'\b(fell|fall|falls|fallen|slipped|tripped|ameanguka|kuanguka|ameteleza)\b', ['fall']),
    (r'\b(fractur\w*|broken (bone|arm|leg|wrist|hip|ankle|rib|finger|toe)\w*|dislocat\w*|'
     r'mfupa (umevunjika|umevunjika)|amevunjika)\b', ['fracture']),
    (r'\b(sprain\w*|strain\w*|twist\w* (his |her |an |the )?(ankle|knee|wrist)|bruis\w*|swollen (ankle|knee|wrist)|'
     r'ameteguka|kuteguka|kuvilia damu)\b', ['sprain']),
    (r'\b(concuss\w*|head (injury|wound|trauma)|hit (his |her |their |the )?head|bump(ed)? (his |her )?head|'
     r'knock(ed)? (on|to) the head|amegonga kichwa|kugonga kichwa)\b', ['head_injury']),
    (r'\b(neck injury|back injury|spin(e|al)\w*|paraly\w*|uti wa mgongo)\b', ['spinal_injury']),
    (r'\b(burn\w*(?! (hot|up))|scald\w*|sunburn\w*|blister\w*|kuungua|ameungua|kuchomeka|maji ya moto)\b', ['burns']),
    (r'\b(eye|eyes|jicho|macho|machoni)\b', ['eye_injury']),
    (r'\b(electrocut\w*|electric shock|shock from (a |the )?(socket|wire)|umeme|amenaswa na umeme)\b',
     ['electric_shock']),
    (r'\b(drown\w*(?! in (debt|work|bills|loans|paperwork))|amezama|kuzama)\b', ['drowning']),
    (r'\b(in (his|her|their|my) ear|insect in (the |his |her )?ear|(up|in) (his|her|their|the) nose|'
     r'stuck in (his |her )?(ear|nose)|swallowed (a |an |something|his |her |the )?\w*|button battery|'
     r'kitu sikioni|kitu puani|mdudu sikioni|amemeza)\b', ['foreign_object']),
    # bites and stings
    (r'\b(snake\w*|nyoka)\b', ['snake_bite']),
    (r'\b(dog bite|bitten|bite|bit (him|her)|rabies|monkey|kuumwa na mbwa|ameumwa na mbwa)\b', ['animal_bite']),
    (r'\b(bee|bees|wasp\w*|sting|stung|scorpion|insect bite|nyuki|nge|ameumwa na nyuki)\b', ['insect_sting']),
    # illness
    (r'\b(anaphyla\w*|epi-?pen|swollen (face|lips|tongue|throat)|throat (is )?swelling|amevimba (uso|midomo|ulimi))\b',
     ['anaphylaxis']),
    (r'\b(allerg\w*|hives|rash|itchy|itching|mzio|vipele|mwasho)\b', ['allergic_reaction', 'anaphylaxis']),
    (r'\b(hypo|hypoglyc\w*|low (blood )?sugar|sugar (is )?low|sukari (imeshuka|iko chini|chini))\b', ['low_blood_sugar']),
    (r'\b(hyperglyc\w*|high (blood )?sugar|sugar (is )?high|sukari (iko juu|imepanda|juu))\b', ['high_blood_sugar']),
    (r'\b(diabet\w*|insulin|kisukari)\b', ['low_blood_sugar', 'high_blood_sugar']),
    (r'\b(poison\w*|bleach|paraffin|kerosene|pesticide\w*|rat poison|carbon monoxide|charcoal (fumes|smoke)|'
     r'jiko (fumes|smoke)|sumu|moshi wa mkaa)\b', ['poisoning']),
    (r'\b(overdos\w*|too many (tablets|pills)|wrong (medicine|tablets|pills|dose)|double dose|extra (dose|pill)|'
     r'dawa nyingi|amezidisha dawa|dawa (isiyo sahihi|mbaya))\b', ['medication_mistake']),
    (r'\b(heat ?stroke|heat exhaustion|overheat\w*|too hot|joto kali)\b', ['heat_illness']),
    (r'\b(hypotherm\w*|very cold|freezing|baridi kali)\b', ['hypothermia']),
    (r'\b(vomit\w*|diarrh\w*|dehydrat\w*|cholera|running stomach|food poisoning|throwing up|kuharisha|kuhara|'
     r'anaharisha|kutapika|anatapika|upungufu wa maji)\b', ['dehydration']),
    (r'\b(fever\w*|feverish|high temperature|malaria|hot to (the )?touch|burning (hot|up)|homa|joto mwilini)\b',
     ['fever']),
    (r'\b(blood pressure|bp|hypertens\w*|presha|shinikizo la damu)\b', ['high_blood_pressure']),
    (r'\b(stomach (pain|ache)|stomachache|tummy (pain|ache)|abdominal|belly pain|appendi\w*|tumbo linauma|'
     r'maumivu ya tumbo)\b', ['abdominal_pain']),
    (r'\b(panic\w*|anxiety attack|hyperventilat\w*|wasiwasi mwingi|hofu kubwa)\b', ['panic_attack']),
    (r'\b(bed ?sores?|pressure (sore|ulcer)\w*|vidonda vya kulala)\b', ['pressure_sore']),
    (r'\b(suicid\w*|kill (myself|himself|herself|themselves)|end (my|his|her|their) life|self[- ]?harm\w*|'
     r'cut(ting)? (himself|herself|themselves) on purpose|wants? to die|kujiua|anataka kujiua|kujidhuru|'
     r'anataka kufa|kujinyonga)\b', ['mental_health_crisis']),
    (r'\b(ambulance|emergency number|who do i call|922|999|112|gari la wagonjwa|ambulensi|nambari ya dharura)\b',
     ['call_for_help']),
    (r'\b(first aid kit|sanduku la huduma ya kwanza)\b', ['first_aid_kit']),
]
_TERMS = [(re.compile(p), t) for p, t in TERMS]

# Anything about health, the body or an injury: such a message is never turned away as "not first aid".
_HEALTH = re.compile(
    r'\b(pain\w*|hurt\w*|ache\w*|sore|sick|ill|illness|unwell|injur\w*|bleed\w*|blood|wound\w*|swell\w*|swollen|'
    r'doctor|nurse|hospital|clinic|medicine\w*|medication\w*|tablet\w*|pills?|symptom\w*|disease|infection|'
    r'infected|breath\w*|cough\w*|vomit\w*|fever|rash|weak|tired|faint\w*|numb\w*|tingl\w*|collaps\w*|emergency|'
    r'head|chest|heart|stomach|belly|leg|arm|hand|foot|feet|back|neck|eye|ear|nose|mouth|throat|skin|bone|'
    r'maumivu|anaumwa|mgonjwa|ugonjwa|daktari|hospitali|dawa|damu|jeraha|kichwa|kifua|moyo|tumbo|mguu|mkono|'
    r'mgongo|shingo|jicho|sikio|pua|koo|ngozi|homa|kikohozi|kutapika|dhaifu|uchovu|dharura)\b')

def topics(text, guide):
    """Guide topics the message names (life-threatening first, then in the order they were named), at most 3."""
    t = (text or '').lower()
    found = []
    for rx, names in _TERMS:
        m = rx.search(t)
        if m:
            for i, name in enumerate(names):
                if name in guide:
                    found.append((m.start(), i, name))
    order, seen = [], set()
    for _, _, name in sorted(found):
        if name not in seen:
            seen.add(name)
            order.append(name)
    order.sort(key=lambda n: not guide[n]['critical'])  # stable: keeps the named order within each group
    return order[:3]


def is_health(text):
    return bool(_HEALTH.search((text or '').lower()))


# "my laptop is overheating", "the chicken is burnt", "my cow has a fever": first-aid words about things or animals.
_THINGS = re.compile(
    r"\b(laptop|computer|phone|wifi|printer|server|website|engine|motor|car|probox|brakes|fan|oven|jiko|chimney|"
    r"solar|controller|panel|paint|wall|bread|milk|chicken|meat|rice|cake|food is|seedlings?|tomato\w*|plants?|"
    r"garden|crops?|cow|cows|goat\w*|chicks|kuku|ng'?ombe|mbuzi|mzinga|vet|debt|loan|fees|deposit|landlord|stocks?|"
    r"shares|market|prices?|bei|dukani|shilling|dollar|nse|economy|traffic|road|city|team|match|game|chess|pawn|"
    r"arsenal|movie|song|party|boxing|sermon|business|salary|exam|email|reports?|paperwork|office)\b")
_PERSON = re.compile(
    r'\b(he|she|him|her|his|hers|they|them|mum|mom|dad|father|mother|grandma|grandpa|granny|uncle|aunt|nephew|'
    r'niece|son|daughter|wife|husband|child|baby|patient|client|elder|cucu|shosho|guka|bibi|babu|mzee|mama|baba|'
    r'mgonjwa|mtoto)\b')
# idioms that use first-aid words for something else
_IDIOMS = re.compile(
    r"\b(fell asleep|free ?fall|heart is broken|broken heart|(having|throw\w*) a fit about|bleeding (me|us|them) dry|"
    r"bleed the brakes|choking (on|with) (all )?(this |the )?(paper\w*|soot|traffic)|traffic .* choking|"
    r"got burn(ed|t) by|burn(ed|t) out|sting like a bee|drowning in|can'?t breathe lol|gave me a heart attack|"
    r"heart attack with|shock (my|our|the) (friends|family|guests)|poisoned pawn)\b")


def about_a_thing(text):
    """First-aid words used about an object or animal, or in an idiom, not about a person's health."""
    t = (text or '').lower()
    return bool(_IDIOMS.search(t)) or (bool(_THINGS.search(t)) and not _PERSON.search(t))
