# More situations (round 4: classes of the trained model, also reached by the medical word list)

<!--
Same format as 01-life-threatening.md. Added in round 4 as classes of the trained model; until the round-4 model is installed the assistant reaches
them through firstaid/lexicon.py when a message names them.
Sources: IFRC International First Aid, Resuscitation and Education Guidelines 2020; St John Ambulance; British and
Kenya Red Cross first-aid manuals; WHO mhGAP (suicide and self-harm). Kenyan numbers: 922 national medical emergency
line (Ministry of Health, Aug 2026), 999 / 112, Kenya Red Cross 1199, Befrienders Kenya +254 722 178 177.
Kiswahili text must be reviewed by a native-speaking first-aid trainer before real use.
-->

## internal_bleeding
critical: yes
classify: yes
title: Vomiting or coughing up blood, black stools | Kutapika au kukohoa damu, kinyesi cheusi
keywords: vomiting blood, coughing up blood, black stool, blood in stool, internal bleeding, kutapika damu, kukohoa damu, kinyesi cheusi

### en
urgent: Call 922 or 999 now. Vomiting or coughing up blood, or black, sticky stools, can mean serious bleeding inside the body.
intro: Blood from inside the body can be bright red, dark like coffee grounds, or turn stools black and tarry. It always needs a hospital.
steps:
- If they are vomiting or coughing, help them sit leaning forward so they do not choke.
- If they are drowsy but breathing, put them in the recovery position.
- Keep them still and warm, and stay with them.
- Watch for shock: pale, cold, clammy skin, fast breathing, confusion. If you see it, lay them flat and raise their legs if they have no injury.
- Keep their medicine list ready for the paramedics, especially blood thinners and pain killers.
avoid:
- Do not give food, drink or medicine.
- Do not let them walk about or travel to hospital on their own.
after: Even if it seems to stop, they must be checked in hospital today.

### sw
urgent: Piga 922 au 999 sasa hivi. Kutapika au kukohoa damu, au kinyesi cheusi kinachonata, kunaweza kumaanisha kutokwa damu nyingi ndani ya mwili.
intro: Damu inayotoka ndani ya mwili inaweza kuwa nyekundu, nyeusi kama mashapo ya kahawa, au kufanya kinyesi kuwa cheusi na kinachonata. Daima inahitaji hospitali.
steps:
- Kama anatapika au kukohoa, msaidie akae ameinama mbele ili asikabwe.
- Kama anasinzia lakini anapumua, mlaze katika mkao wa kujiokoa (recovery position).
- Mweke atulie na apate joto, na ukae naye.
- Angalia dalili za mshtuko: ngozi iliyopauka, baridi na yenye jasho, kupumua haraka, kuchanganyikiwa. Ukiziona, mlaze chali na uinue miguu yake kama hana jeraha.
- Weka tayari orodha ya dawa zake kwa wahudumu wa afya, hasa dawa za kupunguza kuganda kwa damu na za maumivu.
avoid:
- Usimpe chakula, kinywaji wala dawa.
- Usimwache atembee wala aende hospitali peke yake.
after: Hata kama inaonekana imekoma, lazima akaguliwe hospitalini leo.

### examples
- he is vomiting blood
- she coughed up blood this morning
- his stool is black and sticky
- vomit looks like coffee grounds
- there is blood in her poo
- anatapika damu
- mzee anakohoa damu
- kinyesi chake ni cheusi kama lami
- bibi ametapika damu nyingi

## mental_health_crisis
critical: yes
classify: yes
title: Thoughts of suicide or self-harm | Mawazo ya kujiua au kujidhuru
keywords: suicide, suicidal, kill myself, self harm, wants to die, kujiua, kujidhuru, anataka kufa

### en
urgent: If they have hurt themselves, taken an overdose, or may act now, call 922 or 999 and do not leave them alone.
intro: Thoughts of suicide are an emergency. Asking about them does not make them more likely. Staying with the person and listening helps.
steps:
- Stay with them. If you must step away, make sure someone else is with them.
- If it is safe, remove things they could use to harm themselves: medicines, poisons, knives, rope.
- Speak calmly. Ask directly, "Are you thinking of ending your life?", and listen without judging.
- Tell them they are not alone and that help is available.
- Give first aid for any injury, for example press firmly on bleeding.
- Get support now: Kenya Red Cross free line 1199, or Befrienders Kenya +254 722 178 177. Tell the family and their doctor.
avoid:
- Do not promise to keep it a secret.
- Do not argue, lecture or tell them to cheer up.
- Do not leave them alone.
after: Help them see a doctor or counsellor soon, and keep medicines locked away.

### sw
urgent: Kama amejidhuru, amemeza dawa nyingi, au anaweza kuchukua hatua sasa, piga 922 au 999 na usimwache peke yake.
intro: Mawazo ya kujiua ni dharura. Kuuliza kuhusu mawazo hayo hakuyaongezi. Kukaa na mtu na kumsikiliza kunasaidia.
steps:
- Kaa naye. Ukilazimika kuondoka kidogo, hakikisha mtu mwingine yuko naye.
- Kama ni salama, ondoa vitu anavyoweza kutumia kujidhuru: dawa, sumu, visu, kamba.
- Ongea kwa utulivu. Uliza moja kwa moja, "Je, unafikiria kujiua?", na usikilize bila kumhukumu.
- Mwambie hayuko peke yake na kwamba msaada upo.
- Toa huduma ya kwanza kwa jeraha lolote, kwa mfano bonyeza kwa nguvu mahali damu inatoka.
- Pata msaada sasa: nambari ya bure ya Kenya Red Cross 1199, au Befrienders Kenya +254 722 178 177. Ijulishe familia na daktari wake.
avoid:
- Usiahidi kuweka siri.
- Usibishane, usimhubirie wala kumwambia achangamke tu.
- Usimwache peke yake.
after: Msaidie amwone daktari au mshauri hivi karibuni, na ufungie dawa mahali salama.

### examples
- he says he wants to kill himself
- she is talking about ending her life
- my dad took all his tablets on purpose
- she cut her wrists
- he says life is not worth living anymore
- anataka kujiua
- mzee amesema hataki kuishi tena
- amejikata kwa makusudi
- cucu anasema anataka kufa

## embedded_object
critical: no
classify: yes
title: Something stuck in a wound | Kitu kilichokwama kwenye jeraha
keywords: impaled, embedded, stuck in the wound, splinter, kitu kimekwama, kibanzi

### en
urgent: Call 922 or 999 if the object is large or deep, is in the chest, belly, neck, head or eye, or there is heavy bleeding.
intro: Leave a large or deep object where it is: it may be holding back bleeding. Small splinters near the surface can be taken out.
steps:
- Do not pull out anything large or deep. Press firmly around the object, not on it, with a clean cloth.
- Pad around it with rolled cloth on each side and bandage over the padding without pressing on the object.
- Keep them still, lying down if they feel faint, and watch for shock.
- For a small splinter near the surface: wash the area, grip the splinter with clean tweezers, pull it out the way it went in, then wash again and cover.
- If something dirty or rusty broke the skin, ask a clinic about a tetanus injection.
avoid:
- Do not remove a large or deep object, even if it looks easy.
- Do not dig for a splinter you cannot see.
after: Any deep wound needs a clinic or hospital today.

### sw
urgent: Piga 922 au 999 kama kitu ni kikubwa au kimeingia ndani sana, kiko kifuani, tumboni, shingoni, kichwani au jichoni, au kuna damu nyingi.
intro: Acha kitu kikubwa au kilichoingia ndani pale kilipo: huenda kinazuia damu. Vibanzi vidogo vilivyo juu ya ngozi vinaweza kutolewa.
steps:
- Usitoe kitu chochote kikubwa au kilichoingia ndani. Bonyeza kwa nguvu kuzunguka kitu, si juu yake, kwa kitambaa safi.
- Weka vitambaa vilivyokunjwa pande zote mbili na ufunge bendeji juu ya vitambaa hivyo bila kukibonyeza kitu.
- Mweke atulie, alale kama anahisi kuzimia, na uangalie dalili za mshtuko.
- Kwa kibanzi kidogo kilicho juu ya ngozi: osha mahali hapo, kishike kwa koleo safi, kivute kwa njia kilivyoingia, kisha osha tena na ufunike.
- Kama kitu kichafu au chenye kutu kilitoboa ngozi, uliza kliniki kuhusu sindano ya pepopunda.
avoid:
- Usitoe kitu kikubwa au kilichoingia ndani, hata kama kinaonekana rahisi.
- Usichimbe kutafuta kibanzi usichokiona.
after: Jeraha lolote refu linahitaji kliniki au hospitali leo.

### examples
- a nail went into his foot and is still in
- there is a piece of glass stuck in her hand
- a stick is stuck in his leg
- a knife is still in the wound
- should i pull out the thorn stuck deep in her arm
- msumari umemchoma mguu na bado umekwama
- kipande cha glasi kimekwama mkononi
- kijiti kimekwama kwenye jeraha

## foreign_object
critical: no
classify: yes
title: Something in the ear or nose, or swallowed | Kitu sikioni au puani, au kilichomezwa
keywords: in his ear, stuck in nose, swallowed something, button battery, kitu sikioni, kitu puani, amemeza

### en
urgent: Call 922 or 999 now if they cannot breathe, speak or cough. Go to hospital straight away if a battery, magnet or something sharp was swallowed, or they have pain, drooling or vomiting after swallowing.
intro: Most small things pass or come out on their own, but batteries, magnets and sharp objects can do serious harm. Never dig an object out.
steps:
- If they are choking (cannot breathe, speak or cough), follow the choking steps and call for help.
- Nose: ask them to close the clear side and blow gently out through the blocked side.
- Insect in the ear: lay them with that ear up and pour in a little lukewarm water to float it out, only if the ear is not injured.
- If the object does not come out easily, take them to a clinic.
- Swallowed object: if they breathe and swallow normally, note what it was and when, and watch them. Go to hospital if they get pain, vomiting, drooling or blood.
avoid:
- Do not push tweezers, cotton buds or anything else into the ear or nose.
- Do not make them vomit.
after: Bring the packet or a similar object to show the nurse or doctor.

### sw
urgent: Piga 922 au 999 sasa hivi kama hawezi kupumua, kuongea wala kukohoa. Nenda hospitali mara moja kama amemeza betri, sumaku au kitu chenye ncha kali, au ana maumivu, anatokwa mate au anatapika baada ya kumeza.
intro: Vitu vingi vidogo hupita au hutoka vyenyewe, lakini betri, sumaku na vitu vyenye ncha kali vinaweza kuleta madhara makubwa. Kamwe usichimbe kutoa kitu.
steps:
- Kama amekabwa (hawezi kupumua, kuongea wala kukohoa), fuata hatua za kukabwa na uite msaada.
- Puani: mwambie afunge upande usio na kitu na apumue nje kwa upole kupitia upande ulioziba.
- Mdudu sikioni: mlaze sikio hilo likiwa juu na umimine maji kidogo ya uvuguvugu ili mdudu aelee nje, ikiwa tu sikio halina jeraha.
- Kama kitu hakitoki kwa urahisi, mpeleke kliniki.
- Kitu kilichomezwa: kama anapumua na kumeza kawaida, andika kilikuwa nini na saa ngapi, na umwangalie. Nenda hospitali akipata maumivu, kutapika, kutokwa mate au damu.
avoid:
- Usisukume koleo, vijiti vya pamba wala kitu kingine sikioni au puani.
- Usimfanye atapike.
after: Beba pakiti au kitu kinachofanana ili kumwonyesha muuguzi au daktari.

### examples
- he pushed a bean into his ear
- there is something stuck in her nose
- she swallowed a coin
- grandpa swallowed his denture clip
- an insect went into his ear
- amemeza sarafu
- kuna kitu kimeingia sikioni
- bibi amemeza meno yake ya bandia
- mdudu ameingia sikioni mwa babu

## headache
critical: no
classify: yes
title: Bad headache | Maumivu makali ya kichwa
keywords: headache, migraine, head pain, kichwa kinauma, maumivu ya kichwa

### en
urgent: Call 922 or 999 now if it is sudden and very severe (the worst ever), or comes with a weak face or arm, slurred speech, confusion, a stiff neck with fever, a fit, or follows a head injury.
intro: Most headaches are not dangerous and ease with rest, water and simple pain relief.
steps:
- Help them sit or lie down somewhere quiet and dim.
- Give water to drink if they are not vomiting.
- They can take their usual pain relief, such as paracetamol, at the dose on the packet, if their doctor allows it.
- If you have a blood pressure machine, check it: a very high reading with a headache needs a doctor today.
- Check on them again within an hour.
avoid:
- Do not give more pain relief than the packet says.
- Do not give aspirin or ibuprofen to someone on blood thinners unless their doctor said so.
after: See a doctor if the headaches are new, getting worse, wake them at night or keep coming back.

### sw
urgent: Piga 922 au 999 sasa hivi kama yalianza ghafla na ni makali sana (makali kuliko yote), au yanakuja pamoja na uso au mkono kudhoofika, kuongea kwa shida, kuchanganyikiwa, shingo kukakamaa pamoja na homa, kifafa, au baada ya kuumia kichwa.
intro: Maumivu mengi ya kichwa si hatari na hupungua kwa kupumzika, kunywa maji na dawa rahisi za maumivu.
steps:
- Msaidie akae au alale mahali tulivu na penye mwanga hafifu.
- Mpe maji ya kunywa kama hatapiki.
- Anaweza kumeza dawa yake ya kawaida ya maumivu, kama paracetamol, kwa kipimo kilichoandikwa kwenye pakiti, ikiwa daktari wake anaruhusu.
- Kama una mashine ya kupima shinikizo la damu, mpime: kipimo cha juu sana pamoja na maumivu ya kichwa kinahitaji daktari leo.
- Mwangalie tena ndani ya saa moja.
avoid:
- Usimpe dawa ya maumivu zaidi ya kilichoandikwa kwenye pakiti.
- Usimpe aspirin wala ibuprofen mtu anayetumia dawa za kupunguza kuganda kwa damu bila daktari kusema hivyo.
after: Mwone daktari kama maumivu ya kichwa ni mapya, yanazidi, yanamwamsha usiku au yanarudi mara kwa mara.

### examples
- she has a very bad headache
- his head has been pounding since morning
- sudden worst headache of her life
- headache with fever and a stiff neck
- what can i give for a headache
- kichwa kinamuuma sana
- mzee analalamika maumivu ya kichwa
- kichwa kinauma ghafla kwa nguvu sana
