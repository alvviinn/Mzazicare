# MzaziCare tone model (acoustic AI)

Listens to short clips of a care visit and reports how the voices **sound**: happy, calm, neutral, stressed or
angry. It does not understand words, and the family always makes the final call (alerts are confirmed or
dismissed by a person).

## Privacy
- Audio is sent to the server as the raw request body, analysed **in memory**, and dropped. Nothing is written to disk
  (uploads use the in-memory handler only) and the clip is not stored in the database.
- Only totals are kept: seconds of speech per tone for a shift (`care_tonereading`).
- Clips are only analysed while a shift is **verified** (the caretaker is within range of the elderly person's phone).

## How it works
`audio -> 16 kHz mono -> 3 s windows (1.5 s hop) -> level-normalise -> 40 MFCC x 149 frames -> small 2D CNN (126 k parameters) -> 6 classes`

Classes: `happy, calm, neutral, stressed, angry, noise`. `noise` means "not a person speaking" (TV, dogs, traffic,
appliances). Those windows are ignored when summarising tone. The same `features.py` runs in training and in the
backend, so there is no train/serve mismatch (checked: `python -m voice.check_live_path`).

## Training data (all public)
| Dataset | Used for | Notes |
|---|---|---|
| RAVDESS (speech, 24 actors) | all tones incl. calm | acted |
| CREMA-D (91 actors) | happy, neutral, stressed, angry | acted |
| LibriSpeech dev-clean (40 speakers) | neutral | natural read speech, adds variety |
| ESC-50 (non-human classes) | noise | 5 s clips, 2 windows each |

Label mapping: fearful and sad -> `stressed` (a person who sounds distressed). Disgust and surprise are left out
(ambiguous). Training clips also get background-noise and phone-band augmentation. Splits are by **speaker** (and by
ESC-50 fold), so the test set contains only voices the model never heard.

## Results (held-out speakers, 2,048 windows)
| | precision | recall | F1 | n |
|---|---|---|---|---|
| happy | 0.68 | 0.48 | 0.56 | 228 |
| calm | 0.58 | 0.66 | 0.62 | 32 |
| neutral | 0.82 | 0.84 | 0.83 | 464 |
| stressed | 0.75 | 0.80 | 0.77 | 456 |
| angry | 0.71 | 0.79 | 0.75 | 228 |
| noise | 1.00 | 1.00 | 1.00 | 640 |

- Overall accuracy **83.0 %** (macro-F1 0.75). Spec target: >= 80 %.
- **Speech only (the 5 tones): 75.4 %.** This is below 80 %; the overall figure is helped by the easy noise class.
- Per dataset: CREMA-D 70 %, RAVDESS 66 %, LibriSpeech 99 %, ESC-50 99.7 %.
- Live path on every held-out clip: RAVDESS 68 %, CREMA-D 70 % (matches training).

### Alert rule (precision first)
The family gets an "angry voices" alert only when at least 3 windows in one clip have a >= 60 % angry probability.
Simulated on held-out windows as 10-window recordings (`python -m voice.operating_point`):
wrongly fires on 0.2 % of recordings with no anger, catches 44 % of mild arguments (3 of 10 windows) and 95 % of heated
ones (6 of 10). Per window at p >= 0.6, angry precision is 80 %.

### Service-quality rating
Based on the share of **stressed + angry** speech: <= 15 % good, <= 30 % fair, above that needs attention. Neutral
speech is normal and does not count against anyone.

## Model comparison and choice

Three further models were trained on exactly the same features and speaker-independent split, tuned on the validation
speakers only, and scored once on the same 2,048 test windows (`python -m voice.compare`, full table in
[`artifacts/comparison.md`](artifacts/comparison.md)).

| | CNN (deployed) | BiLSTM + attention | SVM (RBF) | Random forest |
|---|---|---|---|---|
| Input | MFCC image (40 x 149) | MFCC sequence (74 steps) | 240 MFCC statistics | 240 MFCC statistics |
| Speech-only accuracy (5 tones) | **75.4 %** | 67.6 % | 66.9 % | 65.6 % |
| Speech-only macro-F1 | **0.706** | 0.631 | 0.577 | 0.597 |
| Overall accuracy (with noise) | **83.0 %** | 75.8 % | 76.5 % | 75.0 % |
| Accuracy on RAVDESS / CREMA-D speakers | **65.9 / 70.2 %** | 51.7 / 62.0 % | 45.5 / 62.4 % | 39.2 / 60.9 % |
| Anger alert: false alarms / mild caught / heated caught | 0.4 / 44.6 / 94.7 % | 0.7 / 47.0 / 95.2 % | 0.6 / 31.4 / 83.5 % | 0.0 / 1.1 / 9.3 % |
| Calibration error (ECE) | **0.017** | 0.050 | 0.028 | 0.169 |
| Time per 3 s window (CPU) | **1.2 ms** | 2.4 ms | 6.1 ms | 94 ms |
| File size | **0.5 MB** | 0.6 MB | 10.6 MB | 53.5 MB |

**Chosen for the product: the CNN (unchanged).** It is the most accurate on every tone and on both acted datasets,
its probabilities are the most honest (which the precision-first anger alert relies on), and it is the smallest and
fastest. Ranking and role of the others:

1. **CNN**: deployed model.
2. **BiLSTM + attention**: the runner-up and the reserve model. It takes the same input and ONNX interface, so it can be
   swapped in with no backend change, and its anger alert behaves almost the same (catches slightly more, false-alarms
   slightly more). It is 8 points behind on speech and worse calibrated, so it does not replace the CNN. Worth retrying
   when real recordings exist, or as a second opinion in an ensemble.
3. **SVM**: the best classical baseline. Well calibrated and simple, but about 9 points behind, 20 times larger and
   noticeably weaker on calm and happy. Useful as a reference point only.
4. **Random forest**: not suitable. Its anger probabilities are so cautious that the alert would catch only 9 % of
   heated arguments, its probabilities are badly calibrated, and it is the largest and slowest model.

Fairness notes: the BiLSTM averages frames in pairs and was capped at 20 epochs (it stopped early at 15) to keep CPU
training practical, while the CNN had 30; the SVM and forest only see summary statistics, so they cannot use how the
voice changes over time, which is the likely reason they trail. All four share the same acted-speech limits below.

## Limits you should know about
- **Acted data.** RAVDESS and CREMA-D are actors reading set sentences in English. Real homes, Kenyan English,
  Kiswahili and code-switching, older voices, and a TV on in the background are not covered. Expect lower accuracy in the
  field until the model is tuned on consented recordings from the pilot.
- LibriSpeech neutral is recorded very cleanly, so its 99 % is not a real-world number.
- Happy is the weakest tone (often mistaken for stressed or angry). Calm has only 192 training clips.
- The model cannot tell *who* is speaking, so it measures the tone of the room, not of the caretaker alone.
- The family's confirm/dismiss decisions on alerts are the labels to use for the next training round.

## Commands (run from the `ml` folder, ML venv)
```
python -m voice.get_data           # download datasets to C:\mzazicare-data\voice (~1.7 GB)
python -m voice.build_features     # MFCC cache
python -m voice.train --epochs 30  # about 1 hour on a 4-core CPU; writes artifacts/
python -m voice.operating_point    # alert-rule analysis
python -m voice.compare train --model svm|rf|bilstm   # train an alternative model (saved to C:\mzazicare-data\voice\comparison)
python -m voice.compare report     # compare them all with the deployed CNN -> artifacts/comparison.md
python -m voice.check_live_path    # live pipeline vs. test labels
python -m voice.infer some.wav     # analyse one file
python -m voice.test_endpoint      # end to end against the running backend
```
