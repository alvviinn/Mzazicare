# Life-threatening emergencies

<!--
Format (read by firstaid/knowledge.py):
  ## <topic id>
  critical: yes|no          yes = the reply starts with "call 999 or 112 now"
  title: English | Kiswahili
  keywords: words that point to this topic (English and Kiswahili, comma-separated); used for data labelling and the
            safety check
  ### en / ### sw           intro:, urgent:, steps: (list), avoid: (list), after:
  ### followup              ask: English | Kiswahili, then options "- English | Kiswahili -> topic id"
  ### examples              ways people ask (training data; English, Kiswahili and mixed)
Sources: IFRC International First Aid, Resuscitation and Education Guidelines 2020; ILCOR/AHA 2020-2025 CPR
guidance; St John Ambulance; British and Kenya Red Cross first-aid manuals; WHO.
Kiswahili text must be reviewed by a native-speaking first-aid trainer before real use.
-->

## call_for_help
critical: no
title: Calling for emergency help | Kuita msaada wa dharura
keywords: ambulance, emergency number, call 999, call 112, who do i call, which number, gari la wagonjwa, ambulensi, nambari ya dharura, nipige simu wapi, piga 999

### en
intro: In Kenya you can call 999 or 112 for an ambulance, free from any phone, even without airtime. The Kenya Red Cross emergency line is 1199.
steps:
- Stay calm and speak clearly.
- Say exactly where you are: the area, road, building and a landmark the driver can find.
- Say what happened, how old the person is, and whether they are awake and breathing.
- Give your phone number and keep the phone on, they may call back.
- Do not hang up until they tell you to. They can guide you through first aid on the phone.
- Send someone to the gate or road to show the ambulance the way, and unlock the door.
after: Keep the person's medicine list and ID ready for the paramedics, and tell the family.

### sw
intro: Nchini Kenya unaweza kupiga 999 au 112 kuita gari la wagonjwa, bure kutoka simu yoyote, hata bila salio. Nambari ya dharura ya Kenya Red Cross ni 1199.
steps:
- Tulia na uongee waziwazi.
- Eleza mahali hasa ulipo: eneo, barabara, jengo na alama ambayo dereva anaweza kuipata.
- Eleza kilichotokea, umri wa mtu, na kama yuko macho na anapumua.
- Toa nambari yako ya simu na uiache ikiwa wazi, wanaweza kukupigia tena.
- Usikate simu mpaka wakuambie. Wanaweza kukuelekeza jinsi ya kutoa huduma ya kwanza kwenye simu.
- Mtume mtu asimame langoni au barabarani kuonyesha gari la wagonjwa njia, na ufungue mlango.
after: Weka tayari orodha ya dawa za mgonjwa na kitambulisho chake kwa wahudumu wa afya, na uijulishe familia.

### examples
- what number do i call for an ambulance
- how do i call an ambulance in kenya
- emergency number please
- who should i call in an emergency
- is 999 free to call
- what do i tell the ambulance people
- how do i get emergency help fast
- the ambulance number
- i need an ambulance number
- nambari ya ambulensi ni gani
- nipige simu wapi kuita gari la wagonjwa
- nambari ya dharura kenya
- naitaje ambulance
- niseme nini nikipiga simu ya dharura
- nikiita ambulance nipige namba gani
- red cross number ni gani

## unresponsive_breathing
critical: yes
title: Unresponsive but breathing | Hajitambui lakini anapumua
keywords: unconscious, unresponsive, passed out, not waking, won't wake up, collapsed, knocked out, recovery position, breathing but not responding, hajitambui, amepoteza fahamu, hazinduki, ameanguka hajitambui, ana pumua lakini hajibu, mkao wa kupona

### en
intro: Someone who does not respond but is breathing needs their airway kept open.
urgent: Call 999 or 112 now, or ask someone else to call while you help.
steps:
- Check for danger first, then shout their name and tap their shoulders.
- If they do not respond, tilt their head back gently and lift the chin to open the airway.
- Look, listen and feel for normal breathing for up to 10 seconds.
- If they are breathing normally, roll them onto their side into the recovery position: the top leg bent at the knee to stop them rolling, the top hand under the cheek, head tilted back so the mouth points down.
- Keep checking that they are still breathing normally until help arrives.
- If they stop breathing normally or only gasp, start CPR straight away.
avoid:
- Do not give them anything to eat or drink.
- Do not leave them alone.
- Do not put a pillow under their head while they lie on their back, it can block the airway.
after: Keep them warm with a blanket and tell the paramedics how long they were unresponsive.

### sw
intro: Mtu asiyejibu lakini anapumua anahitaji njia yake ya hewa iwe wazi.
urgent: Piga 999 au 112 sasa hivi, au mwombe mtu mwingine apige wakati wewe unasaidia.
steps:
- Kwanza hakikisha hakuna hatari, kisha mwite kwa jina kwa sauti na umguse mabegani.
- Asipojibu, rudisha kichwa chake nyuma polepole na uinue kidevu ili kufungua njia ya hewa.
- Tazama, sikiliza na uhisi kama anapumua kawaida kwa hadi sekunde 10.
- Kama anapumua kawaida, mlaze kwa ubavu katika mkao wa kupona (recovery position): mguu wa juu ukunje gotini asibingirike, mkono wa juu chini ya shavu, kichwa nyuma kidogo ili mdomo uelekee chini.
- Endelea kuhakikisha bado anapumua kawaida mpaka msaada ufike.
- Akiacha kupumua kawaida au anatweta tu, anza CPR mara moja.
avoid:
- Usimpe chakula wala kinywaji.
- Usimwache peke yake.
- Usiweke mto chini ya kichwa chake akiwa amelala chali, unaweza kuziba njia ya hewa.
after: Mfunike kwa blanketi apate joto na uwaambie wahudumu wa afya muda gani hakujitambua.

### followup
ask: Is the person breathing normally? | Je, mtu huyo anapumua kawaida?
- Yes, breathing normally | Ndiyo, anapumua kawaida -> unresponsive_breathing
- No, or only gasping | Hapana, au anatweta tu -> cpr

### examples
- my patient is unconscious what do i do
- she collapsed and is not responding
- he passed out but he is breathing
- grandma won't wake up but she is breathing
- how do i put someone in the recovery position
- the old man fainted and is not waking up
- he is breathing but not answering me
- what to do if someone is unconscious
- she is knocked out after falling
- mzee amezimia hajitambui
- bibi hajitambui lakini anapumua
- amepoteza fahamu nifanye nini
- hazinduki na anapumua
- mgonjwa ameanguka na hajibu
- mkao wa kupona unafanywaje
- ameanguka hajitambui please help
- my mum is unresponsive but breathing

## cpr
critical: yes
title: Not breathing: CPR | Hapumui: CPR
keywords: not breathing, stopped breathing, no pulse, heart stopped, cardiac arrest, cpr, chest compressions, gasping, resuscitate, hapumui, ameacha kupumua, moyo umesimama, mapigo ya moyo hayapo, kufufua, kubonyeza kifua, anatweta

### en
intro: If someone is unresponsive and not breathing normally, their heart has probably stopped. CPR keeps blood flowing to the brain until help arrives.
urgent: Call 999 or 112 now and put the phone on speaker. If there is a defibrillator (AED) nearby, send someone to get it.
steps:
- Kneel beside them on a firm surface, on the floor rather than a bed.
- Put the heel of one hand in the centre of the chest, on the lower half of the breastbone, and your other hand on top.
- Keep your arms straight and push straight down hard and fast, 5 to 6 cm deep, about 2 pushes every second (100 to 120 a minute).
- Let the chest come all the way back up after each push.
- If you are trained and willing, give 2 rescue breaths after every 30 pushes. If not, just keep pushing without stopping.
- When the AED arrives, switch it on and follow its spoken instructions. Nobody touches the person while it checks or shocks.
- Keep going until help takes over, the person starts breathing normally, or you are too exhausted to continue. If someone else can help, swap every 2 minutes.
avoid:
- Do not stop pushing to check for a pulse.
- Do not be afraid of hurting them. Ribs can crack in older people, keep going anyway: without CPR they will not survive.
after: If they start breathing normally, put them in the recovery position and keep watching their breathing.

### sw
intro: Mtu asiyejibu na asiyepumua kawaida, huenda moyo wake umesimama. CPR husaidia damu kuendelea kufika kwenye ubongo mpaka msaada ufike.
urgent: Piga 999 au 112 sasa hivi na uweke simu kwenye spika. Kama kuna mashine ya kushtua moyo (AED) karibu, mtume mtu akaileta.
steps:
- Piga magoti kando yake akiwa juu ya sehemu ngumu, sakafuni badala ya kitandani.
- Weka kisigino cha kiganja kimoja katikati ya kifua, nusu ya chini ya mfupa wa kifua, na kiganja kingine juu yake.
- Nyoosha mikono na ubonyeze moja kwa moja chini kwa nguvu na haraka, kina cha sentimita 5 hadi 6, kama mara 2 kila sekunde (100 hadi 120 kwa dakika).
- Acha kifua kirudi juu kabisa baada ya kila kubonyeza.
- Kama umefunzwa na uko tayari, mpe pumzi 2 baada ya kila mabonyezo 30. Kama sivyo, endelea tu kubonyeza bila kusimama.
- AED ikifika, iwashe na ufuate maelekezo yake ya sauti. Mtu yeyote asimguse mgonjwa wakati inapima au inashtua.
- Endelea mpaka wahudumu wachukue nafasi, mtu aanze kupumua kawaida, au umechoka kabisa. Kama kuna mtu mwingine, badilishaneni kila dakika 2.
avoid:
- Usisimame kubonyeza ili kupima mapigo ya moyo.
- Usiogope kumuumiza. Mbavu zinaweza kuvunjika kwa wazee, endelea tu: bila CPR hataishi.
after: Akianza kupumua kawaida, mlaze katika mkao wa kupona na uendelee kuangalia anavyopumua.

### examples
- he is not breathing
- she stopped breathing what do i do
- how do i do cpr
- how to give chest compressions
- my patient has no pulse
- i think his heart stopped
- she is gasping and not responding
- how many compressions per minute
- how to use a defibrillator
- he is not breathing and not responding help
- grandpa collapsed and is not breathing
- hapumui nifanye nini
- ameacha kupumua
- moyo wake umesimama
- jinsi ya kufanya cpr
- mzee hapumui saidia haraka
- bibi haupumui na hajibu
- namna ya kubonyeza kifua
- not breathing tafadhali help

## choking_severe
critical: yes
title: Choking | Kukabwa (chakula kukwama kooni)
keywords: choking, choke, food stuck in throat, can't breathe after eating, something stuck in throat, swallowed something stuck, abdominal thrusts, heimlich, back blows, anakabwa, amekabwa, chakula kimekwama kooni, kimekwama kooni, hawezi kupumua akila, mfupa umekwama

### en
intro: Choking happens when something blocks the airway. If the person cannot cough, speak or breathe, act straight away.
urgent: Ask someone to call 999 or 112 while you start.
steps:
- Ask "Are you choking?" If they can cough, encourage them to keep coughing.
- If they cannot cough, speak or breathe, stand to the side and slightly behind them and lean them forward.
- Give up to 5 firm back blows between the shoulder blades with the heel of your hand. Check after each one whether the object has come out.
- If it has not cleared, give up to 5 abdominal thrusts: stand behind them, put your fist just above the belly button, hold it with your other hand, and pull sharply inwards and upwards.
- Keep repeating 5 back blows and 5 abdominal thrusts until the object comes out or help arrives.
- If they become unresponsive, lower them carefully to the floor, call 999 or 112 if nobody has, and start CPR.
avoid:
- Do not put your fingers in their mouth to feel for the object, you can push it deeper. Only remove something you can clearly see.
- Do not give water while they are choking.
after: Anyone who has had abdominal thrusts must see a doctor the same day, as they can cause internal injury.

### sw
intro: Kukabwa hutokea kitu kinapoziba njia ya hewa. Kama mtu hawezi kukohoa, kuongea wala kupumua, chukua hatua mara moja.
urgent: Mwombe mtu apige 999 au 112 wakati wewe unaanza.
steps:
- Muulize "Umekabwa?" Kama anaweza kukohoa, mhimize aendelee kukohoa.
- Kama hawezi kukohoa, kuongea wala kupumua, simama kando yake na nyuma kidogo, kisha umwinamishe mbele.
- Mpige makofi hadi 5 kwa nguvu katikati ya mabega kwa kisigino cha kiganja. Angalia baada ya kila kofi kama kitu kimetoka.
- Kisipotoka, fanya mibano ya tumbo hadi 5: simama nyuma yake, weka ngumi juu kidogo ya kitovu, ishike kwa mkono mwingine, na uvute kwa nguvu ndani na juu.
- Endelea kurudia makofi 5 na mibano ya tumbo 5 mpaka kitu kitoke au msaada ufike.
- Akiacha kujitambua, mlaze sakafuni kwa uangalifu, piga 999 au 112 kama hakuna aliyepiga, na uanze CPR.
avoid:
- Usiingize vidole mdomoni kutafuta kitu, unaweza kukisukuma ndani zaidi. Toa tu kitu unachokiona waziwazi.
- Usimpe maji wakati amekabwa.
after: Mtu yeyote aliyefanyiwa mibano ya tumbo lazima amwone daktari siku hiyo hiyo, kwani inaweza kusababisha jeraha la ndani.

### followup
ask: Can the person cough or speak? | Je, mtu huyo anaweza kukohoa au kuongea?
- Yes, coughing or speaking | Ndiyo, anakohoa au anaongea -> choking_mild
- No, cannot breathe | Hapana, hawezi kupumua -> choking_severe
- They became unresponsive | Amepoteza fahamu -> cpr

### examples
- she is choking on food
- he is choking what do i do
- food is stuck in his throat
- grandma choked on a piece of meat
- he cannot breathe after eating
- how to do the heimlich manoeuvre
- how do i help someone who is choking
- something is stuck in her throat and she can't talk
- the patient choked while drinking tea
- anakabwa na chakula
- mzee amekabwa nifanye nini
- chakula kimekwama kooni
- mfupa wa samaki umekwama kooni
- hawezi kupumua baada ya kula
- bibi amekabwa na ugali
- anakabwa hawezi kuongea
- choking haraka msaada

## choking_mild
critical: no
classify: no
title: Choking, still coughing | Amekabwa lakini anakohoa
keywords: coughing after choking, still coughing

### en
intro: If they can cough, speak or breathe, their airway is only partly blocked and coughing is the best way to clear it.
steps:
- Encourage them to keep coughing hard.
- Stay with them and keep watching.
- If they stop coughing, cannot speak or breathe, or start turning blue, start back blows and abdominal thrusts straight away.
avoid:
- Do not slap their back while they are coughing well.
- Do not give water or food until it has cleared.
after: If they still feel something stuck, have pain, or keep coughing afterwards, take them to a doctor.

### sw
intro: Kama anaweza kukohoa, kuongea au kupumua, njia ya hewa imeziba kidogo tu na kukohoa ndiyo njia bora ya kukitoa.
steps:
- Mhimize aendelee kukohoa kwa nguvu.
- Kaa naye na uendelee kumwangalia.
- Akiacha kukohoa, hawezi kuongea wala kupumua, au anaanza kubadilika rangi kuwa bluu, anza makofi ya mgongo na mibano ya tumbo mara moja.
avoid:
- Usimpige mgongoni wakati anakohoa vizuri.
- Usimpe maji wala chakula mpaka kitoke.
after: Kama bado anahisi kitu kimekwama, ana maumivu, au anaendelea kukohoa baadaye, mpeleke kwa daktari.

## heart_attack
critical: yes
title: Chest pain or heart attack | Maumivu ya kifua au mshtuko wa moyo
keywords: chest pain, heart attack, chest pressure, chest tightness, pain spreading to arm, pain in left arm, jaw pain, angina, crushing chest, maumivu ya kifua, kifua kinauma, mshtuko wa moyo, moyo unauma, kifua kimebana, maumivu mkono wa kushoto, shambulio la moyo

### en
intro: Chest pain, pressure or tightness that may spread to the arm, jaw, neck or back, often with breathlessness, sweating or feeling sick, can be a heart attack. Older people, women and people with diabetes may only feel tired, breathless or unwell.
urgent: Call 999 or 112 now. Treat it as a heart attack until a doctor says otherwise.
steps:
- Help them sit down in a comfortable half-sitting position, for example on the floor leaning against a wall with knees bent.
- Loosen tight clothing and keep them calm and still.
- If they are an adult, not allergic to aspirin, have no bleeding problem, and a doctor has not told them to avoid it, give one 300 mg aspirin to chew slowly.
- If they have their own heart spray or tablets (GTN) prescribed for chest pain, help them take it as the doctor directed.
- Stay with them and watch their breathing and how alert they are.
- If they become unresponsive and stop breathing normally, start CPR.
avoid:
- Do not let them walk around, climb stairs or drive themselves to hospital.
- Do not give food or drinks.
- Do not wait to see if the pain goes away.
after: Write down when the pain started and what medicine they took, and give this to the paramedics.

### sw
intro: Maumivu, mgandamizo au kubana kifuani kunakoweza kuenea mkononi, tayani, shingoni au mgongoni, mara nyingi pamoja na kukosa pumzi, kutokwa jasho au kichefuchefu, kunaweza kuwa mshtuko wa moyo. Wazee, wanawake na watu wenye kisukari wanaweza kuhisi uchovu tu, kukosa pumzi au kujisikia vibaya.
urgent: Piga 999 au 112 sasa hivi. Lichukulie kama mshtuko wa moyo mpaka daktari aseme vinginevyo.
steps:
- Msaidie akae katika mkao wa nusu kukaa, kwa mfano sakafuni ameegemea ukuta na magoti yamekunjwa.
- Legeza nguo zinazobana na umtulize asisogee.
- Kama ni mtu mzima, hana mzio wa aspirini, hana tatizo la kutokwa damu, na daktari hajamkataza, mpe aspirini moja ya miligramu 300 aitafune polepole.
- Kama ana dawa yake ya kupuliza au vidonge vya moyo (GTN) alivyoandikiwa kwa maumivu ya kifua, msaidie atumie kama daktari alivyoelekeza.
- Kaa naye na uangalie anavyopumua na kama yuko macho.
- Akiacha kujitambua na kuacha kupumua kawaida, anza CPR.
avoid:
- Usimwache atembee, apande ngazi wala ajiendeshe hospitalini.
- Usimpe chakula wala vinywaji.
- Usisubiri kuona kama maumivu yataisha.
after: Andika saa ambayo maumivu yalianza na dawa alizotumia, uwape wahudumu wa afya.

### examples
- he has chest pain
- she says her chest is tight and painful
- i think he is having a heart attack
- pain in his chest going to the left arm
- crushing chest pain and sweating
- my patient complains of chest pressure
- grandpa has chest pain and can't breathe well
- should i give aspirin for chest pain
- her jaw and arm hurt and she is sweating
- signs of a heart attack
- kifua kinamuuma sana
- ana maumivu ya kifua
- nadhani amepata mshtuko wa moyo
- mzee analalamika kifua kimebana
- maumivu ya kifua hadi mkono wa kushoto
- moyo unauma na anatokwa jasho
- bibi ana chest pain
- chest pain mbaya sana nifanye nini

## stroke
critical: yes
title: Stroke | Kiharusi
keywords: stroke, face drooping, face droop, slurred speech, can't speak properly, one side weak, arm weakness, numb on one side, sudden confusion, sudden severe headache, lost balance suddenly, mouth twisted, fast test, kiharusi, uso umepinda, mdomo umepinda, upande mmoja umelegea, hawezi kuongea vizuri, maneno hayatoki, mkono hauinuki, stroke imempata, amepooza upande mmoja

### en
intro: A stroke is when blood stops reaching part of the brain. Every minute counts. Use the FAST check.
urgent: Call 999 or 112 now if you see any of these signs, even if they go away.
steps:
- Face: ask them to smile. Does one side of the face droop?
- Arms: ask them to lift both arms. Does one drift down or feel weak?
- Speech: is their speech slurred, strange or are they unable to speak or understand?
- Time: call 999 or 112 straight away and note the exact time the signs started, doctors need this.
- Also watch for sudden loss of balance, sudden loss of vision, a sudden very bad headache or sudden confusion.
- Keep them comfortable, sitting or lying with head and shoulders slightly raised, and reassure them.
- If they become unresponsive but are breathing, put them in the recovery position.
avoid:
- Do not give anything by mouth: no food, drink or medicine, including aspirin. Swallowing may be affected and they could choke.
- Do not let them sleep it off or wait to see if it improves.
after: If the signs disappeared within minutes, it may have been a mini-stroke (TIA). They still need to see a doctor urgently today.

### sw
intro: Kiharusi ni pale damu inapoacha kufika sehemu ya ubongo. Kila dakika ni muhimu. Tumia kipimo cha FAST.
urgent: Piga 999 au 112 sasa hivi ukiona dalili yoyote kati ya hizi, hata kama zitaisha.
steps:
- Uso: mwambie atabasamu. Je, upande mmoja wa uso umeshuka?
- Mikono: mwambie ainue mikono yote miwili. Je, mmoja unashuka au ni dhaifu?
- Kuongea: je, maneno yake hayatoki vizuri, ni ya ajabu, au hawezi kuongea wala kuelewa?
- Muda: piga 999 au 112 mara moja na uandike saa hasa dalili zilipoanza, madaktari wanahitaji hili.
- Pia angalia kupoteza usawa ghafla, kupoteza uwezo wa kuona ghafla, maumivu makali sana ya kichwa ghafla au kuchanganyikiwa ghafla.
- Mtulize akiwa amekaa au amelala na kichwa na mabega yameinuliwa kidogo.
- Akiacha kujitambua lakini anapumua, mlaze katika mkao wa kupona.
avoid:
- Usimpe chochote kwa mdomo: chakula, kinywaji wala dawa, hata aspirini. Huenda hawezi kumeza vizuri na akakabwa.
- Usimwache alale ili ipite wala usisubiri kuona kama itaboreka.
after: Kama dalili ziliisha ndani ya dakika chache, huenda ilikuwa kiharusi kidogo (TIA). Bado anahitaji kumwona daktari haraka leo.

### examples
- i think she is having a stroke
- his face is drooping on one side
- he suddenly can't speak properly
- her speech is slurred and her arm is weak
- one side of his body is weak
- signs of a stroke
- grandma's mouth is twisted and she is confused
- he can't lift his right arm suddenly
- sudden numbness on one side of the face
- what is the fast test
- nadhani amepata kiharusi
- uso wake umepinda upande mmoja
- mdomo umepinda na hawezi kuongea
- mkono mmoja hauinuki ghafla
- upande mmoja wa mwili umelegea
- maneno hayatoki vizuri ghafla
- mzee amepooza upande mmoja
- dalili za kiharusi ni zipi
- bibi ame-stroke nifanye nini

## severe_bleeding
critical: yes
title: Heavy bleeding | Kutokwa na damu nyingi
keywords: bleeding heavily, heavy bleeding, lots of blood, blood won't stop, bleeding badly, spurting blood, deep cut bleeding, blood everywhere, tourniquet, haemorrhage, hemorrhage, anatokwa damu nyingi, damu nyingi, damu haikomi, damu inatoka sana, damu inaruka, jeraha kubwa linavuja damu

### en
intro: Heavy bleeding must be stopped quickly. Firm, direct pressure is the most important thing you can do.
urgent: Call 999 or 112 now, or ask someone else to call.
steps:
- Put on gloves or use a plastic bag over your hand if you can, but do not delay.
- Press firmly and directly on the wound with a clean cloth, pad or your hand.
- Keep pressing hard without letting go for at least 10 minutes. Do not lift it to look.
- If blood soaks through, put more cloth on top and keep pressing.
- Once bleeding slows, tie a bandage or cloth firmly over the pad, not so tight that fingers or toes go cold or blue.
- If it is an arm or leg, the bleeding is life-threatening and pressure is not stopping it, a tourniquet can be used by someone trained: 5 to 7 cm above the wound, tightened until bleeding stops, with the time written down.
- Help them lie down. If they look pale, cold or sweaty, raise their legs and keep them warm.
avoid:
- Do not remove something stuck in the wound. Press around it instead.
- Do not remove soaked pads, add more on top.
after: Tell the paramedics if the person takes blood thinners, such as warfarin or aspirin, as they will bleed more.

### sw
intro: Damu nyingi lazima isimamishwe haraka. Kubonyeza kwa nguvu moja kwa moja kwenye jeraha ndiyo jambo muhimu zaidi unaloweza kufanya.
urgent: Piga 999 au 112 sasa hivi, au mwombe mtu mwingine apige.
steps:
- Vaa glavu au funika mkono na mfuko wa plastiki kama unaweza, lakini usichelewe.
- Bonyeza kwa nguvu moja kwa moja juu ya jeraha kwa kitambaa safi, pedi au mkono wako.
- Endelea kubonyeza kwa nguvu bila kuachia kwa angalau dakika 10. Usiinue kuangalia.
- Damu ikilowa, weka kitambaa kingine juu na uendelee kubonyeza.
- Damu ikipungua, funga bendeji au kitambaa kwa nguvu juu ya pedi, lakini si kwa kubana sana hadi vidole viwe baridi au bluu.
- Kama ni mkono au mguu, damu ni hatari kwa maisha na kubonyeza hakuisimamishi, mtu aliyefunzwa anaweza kufunga tourniquet: sentimita 5 hadi 7 juu ya jeraha, kaza mpaka damu isimame, na uandike saa.
- Msaidie alale chini. Akionekana mweupe, baridi au anatokwa jasho, inua miguu yake na umpe joto.
avoid:
- Usitoe kitu kilichokwama ndani ya jeraha. Bonyeza kuzunguka kitu hicho.
- Usiondoe vitambaa vilivyolowa damu, ongeza vingine juu.
after: Waambie wahudumu wa afya kama mtu anatumia dawa za kupunguza kuganda kwa damu, kama warfarin au aspirini, kwani atatokwa na damu zaidi.

### followup
ask: Is the blood spurting or soaking through cloth quickly? | Je, damu inaruka au inalowanisha kitambaa haraka?
- Yes, it is heavy | Ndiyo, ni nyingi -> severe_bleeding
- No, it is a small cut | Hapana, ni jeraha dogo -> minor_wound

### examples
- he is bleeding a lot
- the bleeding won't stop
- she cut her leg and there is so much blood
- blood is spurting from his arm
- how do i stop heavy bleeding
- deep cut on the hand bleeding badly
- how to use a tourniquet
- blood is soaking through the bandage
- he fell and is bleeding heavily from the head
- anatokwa na damu nyingi
- damu haikomi kutoka
- amejikata na damu inatoka sana
- damu inaruka kutoka kwenye jeraha
- jinsi ya kusimamisha damu nyingi
- jeraha kubwa mguuni damu inavuja
- mzee anavuja damu nyingi help

## anaphylaxis
critical: yes
title: Severe allergic reaction | Mzio mkali (anaphylaxis)
keywords: anaphylaxis, severe allergic reaction, throat swelling, tongue swelling, lips swelling, face swelling, epipen, adrenaline, allergic and can't breathe, swollen throat, mzio mkali, koo limevimba, ulimi umevimba, midomo imevimba, uso umevimba, mzio na hawezi kupumua, sindano ya adrenaline

### en
intro: A severe allergic reaction (anaphylaxis) can follow a sting, food or medicine. Signs include swelling of the lips, tongue or throat, wheezing or difficulty breathing, a hoarse voice, feeling faint, and often a rash.
urgent: Call 999 or 112 now.
steps:
- If they have an adrenaline auto-injector (such as an EpiPen), help them use it straight away into the outer thigh. It can go through clothing.
- Hold it in place for as long as the device instructions say, then note the time.
- If breathing is difficult, let them sit up. If they feel faint, lie them down with legs raised.
- If there is no improvement after 5 minutes and they have a second injector, give the second dose.
- Stay with them. If they become unresponsive and stop breathing normally, start CPR.
avoid:
- Do not wait to see if it gets better.
- Do not let them stand up or walk suddenly, even if they feel better.
after: They must go to hospital even if the adrenaline works, because the reaction can come back.

### sw
intro: Mzio mkali (anaphylaxis) unaweza kufuata kuumwa na mdudu, chakula au dawa. Dalili ni kuvimba midomo, ulimi au koo, kupumua kwa shida au kwa mluzi, sauti kukwaruza, kuhisi kuzimia, na mara nyingi vipele.
urgent: Piga 999 au 112 sasa hivi.
steps:
- Kama ana sindano ya adrenaline (kama EpiPen), msaidie aitumie mara moja kwenye upande wa nje wa paja. Inaweza kupita kwenye nguo.
- Ishikilie kwa muda ambao maelekezo ya kifaa yanasema, kisha andika saa.
- Kama anapumua kwa shida, mwache akae. Akihisi kuzimia, mlaze na uinue miguu yake.
- Kama hakuna nafuu baada ya dakika 5 na ana sindano ya pili, mpe dozi ya pili.
- Kaa naye. Akiacha kujitambua na kuacha kupumua kawaida, anza CPR.
avoid:
- Usisubiri kuona kama itapona.
- Usimwache asimame wala atembee ghafla, hata akijisikia vizuri.
after: Lazima aende hospitali hata kama adrenaline imesaidia, kwa sababu mzio unaweza kurudi.

### examples
- her lips and tongue are swelling
- his throat is swelling after eating peanuts
- severe allergic reaction what do i do
- she was stung by a bee and can't breathe
- how to use an epipen
- face swelling and wheezing after taking a new medicine
- allergic reaction with difficulty breathing
- anaphylaxis first aid
- koo limevimba baada ya kula
- midomo na ulimi vimevimba
- ameumwa na nyuki na anapumua kwa shida
- mzio mkali nifanye nini
- uso umevimba baada ya kumeza dawa
- jinsi ya kutumia epipen

## seizure
critical: yes
title: Seizure (fit) | Kifafa au degedege
keywords: seizure, fit, fitting, convulsions, convulsing, shaking uncontrollably, epilepsy, epileptic, jerking, kifafa, degedege, anatetemeka bila kujizuia, anarusha mikono na miguu, amepata kifafa, mwili unatetemeka

### en
intro: During a seizure a person may fall, go stiff and jerk. Most seizures stop on their own within a few minutes. Your job is to keep them safe.
urgent: Call 999 or 112 if it lasts more than 5 minutes, it is their first seizure, another one follows, they are injured, they have trouble breathing afterwards, it happened in water, or they do not wake up.
steps:
- Stay calm and note the time the seizure started.
- Move hard or sharp objects away and put something soft under their head.
- Loosen anything tight around the neck, and remove glasses.
- When the jerking stops, roll them onto their side into the recovery position and check their breathing.
- Stay with them, talk calmly and reassure them until they are fully awake. They may be confused or sleepy for a while.
avoid:
- Do not hold them down or try to stop the movements.
- Do not put anything in their mouth, they will not swallow their tongue.
- Do not give food or drink until they are fully alert.
after: Write down how long it lasted and what happened, and tell their doctor and the family.

### sw
intro: Wakati wa kifafa mtu anaweza kuanguka, kukakamaa na kurusha viungo. Vifafa vingi huisha vyenyewe ndani ya dakika chache. Kazi yako ni kumweka salama.
urgent: Piga 999 au 112 kama kinachukua zaidi ya dakika 5, ni mara yake ya kwanza, kingine kinafuata, ameumia, anapumua kwa shida baadaye, kilitokea majini, au hazinduki.
steps:
- Tulia na uandike saa kifafa kilipoanza.
- Ondoa vitu vigumu au vyenye ncha karibu naye na uweke kitu laini chini ya kichwa chake.
- Legeza kitu chochote kinachobana shingoni, na umvue miwani.
- Kutetemeka kukiisha, mlaze kwa ubavu katika mkao wa kupona na uangalie anavyopumua.
- Kaa naye, ongea kwa utulivu na umtulize mpaka azinduke kabisa. Anaweza kuchanganyikiwa au kusinzia kwa muda.
avoid:
- Usimshike kwa nguvu wala kujaribu kusimamisha mitikisiko.
- Usiweke chochote mdomoni mwake, hatameza ulimi wake.
- Usimpe chakula wala kinywaji mpaka azinduke kabisa.
after: Andika muda kilichodumu na kilichotokea, uwaambie daktari wake na familia.

### examples
- she is having a seizure
- he is shaking and jerking on the floor
- what do i do during a fit
- my patient is convulsing
- he had an epileptic fit
- the old man is fitting and foaming at the mouth
- should i put something in his mouth during a seizure
- how long can a seizure last before i call
- anapata kifafa nifanye nini
- ana degedege
- mzee anatetemeka sakafuni hajitambui
- mwili wake unatetemeka bila kujizuia
- amepata kifafa sasa hivi
- bibi ana convulsions

## shock
critical: yes
title: Shock (circulation failing) | Mshtuko wa mwili (shock)
keywords: shock, pale cold clammy, cold and clammy, weak fast pulse, going into shock, pale and sweaty after injury, mshtuko, baridi na jasho, amepauka na baridi, mapigo dhaifu ya haraka

### en
intro: Shock means not enough blood is reaching the organs, for example after heavy bleeding, burns, severe vomiting or diarrhoea, a serious infection or an allergic reaction. Signs are pale, cold, clammy skin, a fast weak pulse, fast breathing, dizziness and confusion.
urgent: Call 999 or 112 now.
steps:
- Treat the cause if you can, for example press on a bleeding wound.
- Help them lie down. Raise their legs if this does not hurt them and there is no injury to the legs, hips, back or head.
- Loosen tight clothing and cover them with a blanket to keep them warm.
- Reassure them and keep checking their breathing and how alert they are.
- If they become unresponsive but are breathing, put them in the recovery position. If they stop breathing normally, start CPR.
avoid:
- Do not give food or drink. You can wet their lips if they are thirsty.
- Do not leave them alone.
after: Tell the paramedics what caused it and any changes you noticed.

### sw
intro: Mshtuko (shock) maana yake damu haitoshi kufika kwenye viungo, kwa mfano baada ya kutokwa damu nyingi, kuungua, kutapika au kuhara sana, maambukizi makali au mzio. Dalili ni ngozi nyeupe, baridi na yenye jasho, mapigo ya haraka na dhaifu, kupumua haraka, kizunguzungu na kuchanganyikiwa.
urgent: Piga 999 au 112 sasa hivi.
steps:
- Tibu chanzo kama unaweza, kwa mfano bonyeza jeraha linalovuja damu.
- Msaidie alale chini. Inua miguu yake kama haimuumizi na hakuna jeraha miguuni, kiunoni, mgongoni au kichwani.
- Legeza nguo zinazobana na umfunike kwa blanketi apate joto.
- Mtulize na uendelee kuangalia anavyopumua na kama yuko macho.
- Akiacha kujitambua lakini anapumua, mlaze katika mkao wa kupona. Akiacha kupumua kawaida, anza CPR.
avoid:
- Usimpe chakula wala kinywaji. Unaweza kulowesha midomo yake akiwa na kiu.
- Usimwache peke yake.
after: Waambie wahudumu wa afya kilichosababisha na mabadiliko uliyoyaona.

### examples
- he is pale cold and sweaty after the accident
- signs of shock
- she looks grey and clammy and her pulse is fast
- how to treat someone in shock
- he is going into shock after losing blood
- amepauka na ana baridi na jasho
- dalili za mshtuko wa mwili
- mapigo yake ni ya haraka na dhaifu na ana jasho baridi

## drowning
critical: yes
title: Drowning | Kuzama majini
keywords: drowning, drowned, pulled from water, nearly drowned, fell in the water, swimming pool accident, river, water in lungs, kuzama, amezama, ametolewa majini, ameangukia majini, amezama kisimani

### en
intro: A person pulled from water may have stopped breathing. Your safety comes first.
urgent: Call 999 or 112 now.
steps:
- Do not go into the water yourself unless trained. Reach with a stick or throw something that floats.
- Once they are out, check if they are breathing normally.
- If they are not breathing normally, give 5 rescue breaths if you can, then start CPR with 30 pushes and 2 breaths.
- If they are breathing, put them in the recovery position so water can drain from the mouth.
- Remove wet clothes if you can and cover them to keep them warm.
avoid:
- Do not press on the belly to push water out, it wastes time and can cause vomiting.
after: Anyone who was under water must go to hospital, even if they seem fine, as breathing problems can start hours later.

### sw
intro: Mtu aliyetolewa majini huenda ameacha kupumua. Usalama wako ni wa kwanza.
urgent: Piga 999 au 112 sasa hivi.
steps:
- Usiingie majini mwenyewe kama hujafunzwa. Mfikie kwa fimbo au mrushie kitu kinachoelea.
- Akishatoka, angalia kama anapumua kawaida.
- Kama hapumui kawaida, mpe pumzi 5 kama unaweza, kisha anza CPR kwa mabonyezo 30 na pumzi 2.
- Kama anapumua, mlaze katika mkao wa kupona ili maji yatoke mdomoni.
- Mvue nguo zilizolowa kama unaweza na umfunike apate joto.
avoid:
- Usibonyeze tumbo kutoa maji, inapoteza muda na inaweza kusababisha kutapika.
after: Mtu yeyote aliyekuwa chini ya maji lazima aende hospitali, hata kama anaonekana mzima, kwani matatizo ya kupumua yanaweza kuanza saa kadhaa baadaye.

### examples
- someone is drowning
- we pulled him out of the water and he is not breathing
- she nearly drowned in the pool
- what to do for a drowning person
- he fell into the river
- amezama majini
- tumemtoa majini hapumui
- ameangukia kisimani
- mtoto amezama kwenye bwawa

## electric_shock
critical: yes
title: Electric shock | Kushtuliwa na umeme
keywords: electric shock, electrocuted, electrocution, touched a live wire, shocked by electricity, power line, socket shock, kushtuliwa na umeme, amepigwa na umeme, ameshika waya wa umeme, umeme umemshika, stima imemshika

### en
intro: Electricity can stop the heart and cause deep burns. Make it safe before you touch them.
urgent: Call 999 or 112 now.
steps:
- Switch off the power at the main switch or pull out the plug. Do not touch the person until the power is off.
- If you cannot switch it off, stand on something dry like a wooden board or folded newspaper and push them away from the source with a dry wooden broom or chair.
- For high-voltage power lines, stay at least 18 metres away and wait for the power company or emergency services.
- Once safe, check if they are breathing normally. If not, start CPR.
- Cool any burns under cool running water for 20 minutes and cover them loosely with cling film or a clean cloth.
avoid:
- Do not touch them with bare hands while they are still in contact with electricity.
- Do not use anything metal or wet to move them.
after: Everyone who has had an electric shock should see a doctor, because it can affect the heart rhythm.

### sw
intro: Umeme unaweza kusimamisha moyo na kusababisha kuungua kwa ndani. Hakikisha ni salama kabla ya kumgusa.
urgent: Piga 999 au 112 sasa hivi.
steps:
- Zima umeme kwenye swichi kuu au chomoa plagi. Usimguse mtu mpaka umeme uzimwe.
- Kama huwezi kuzima, simama juu ya kitu kikavu kama ubao au gazeti lililokunjwa na umsukume mbali na chanzo kwa ufagio au kiti kikavu cha mbao.
- Kwa nyaya za umeme mkubwa, kaa angalau mita 18 mbali na usubiri kampuni ya umeme au huduma za dharura.
- Ikiwa salama, angalia kama anapumua kawaida. Kama hapumui, anza CPR.
- Poza majeraha ya moto chini ya maji baridi yanayotiririka kwa dakika 20 na uyafunike kwa ulegevu kwa karatasi ya plastiki au kitambaa safi.
avoid:
- Usimguse kwa mikono mitupu akiwa bado anagusa umeme.
- Usitumie kitu cha chuma au chenye unyevu kumsogeza.
after: Kila aliyeshtuliwa na umeme amwone daktari, kwa sababu unaweza kuathiri mapigo ya moyo.

### examples
- he got an electric shock
- she touched a live wire
- someone has been electrocuted
- what to do after an electric shock from a socket
- amepigwa na umeme
- ameshika waya wa umeme
- stima imemshika nifanye nini
- umeme umemshtua jikoni
