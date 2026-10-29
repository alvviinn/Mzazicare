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

Three further models were compared with the deployed CNN on the same speaker-independent split and scored once on the
same 2,048 test windows (`python -m voice.compare`, full table in [`artifacts/comparison.md`](artifacts/comparison.md)).
To keep the comparison fair, each model was given the conditions that suit it best, under the same rules:

* **Input that suits the model.** The CNN and BiLSTM read the MFCC frames directly. The SVM and forest cannot read a
  sequence, so they get the standard classical speech-emotion input: 1,680 *functionals*. These describe the 40 MFCCs and
  their first and second deltas (how fast and how sharply each one changes) with mean, spread, percentiles, trend, skew and
  kurtosis, plus separate statistics for the start, middle and end of the window. This lets them see how the voice changes
  over time.
* **Settings search on the validation speakers only.**
  * SVM: PCA size {128, 256} x C {1, 4, 16}.
  * Forest: features per split {sqrt, 5 %} x leaf size {1, 3}, 500 trees.
  * BiLSTM: given the same training budget as the CNN (30 epochs, early stop after 7 without gain).
* **The same calibration** (temperature fitted on validation) for all four.
* **Each model gets its own anger-alert rule,** chosen on validation as the threshold and window count that catch the
  most anger with at most 1 % false alarms on calm recordings.
* **Time per window includes feature extraction,** which the server would have to do.

| | CNN (deployed) | BiLSTM + attention | Random forest | SVM (RBF) |
|---|---|---|---|---|
| Input | MFCC frames (40 x 149) | MFCC frames (40 x 149) | 1,680 functionals | 1,680 functionals |
| Speech-only accuracy (5 tones) | **75.4 %** | 68.6 % | 64.3 % | 63.7 % |
| Speech-only macro-F1 | **0.706** | 0.614 | 0.563 | 0.559 |
| Overall accuracy (with noise) | **83.0 %** | 75.9 % | 73.6 % | 74.2 % |
| Accuracy on RAVDESS / CREMA-D speakers | **65.9 / 70.2 %** | 51.1 / 63.3 % | 36.4 / 59.0 % | 36.9 / 59.6 % |
| Own alert rule | p >= 0.8, 2 windows | p >= 0.8, 2 windows | p >= 0.6, 3 windows | p >= 0.6, 3 windows |
| Alert: false alarms / mild caught / heated caught | 1.1 / **72.5** / **97.1 %** | 0.8 / 53.9 / 91.7 % | 1.8 / 42.4 / 89.8 % | 0.4 / 23.1 / 69.6 % |
| Calibration error (ECE) | **0.017** | 0.059 | 0.042 | 0.031 |
| Time per 3 s window (CPU, incl. features) | **1.4 ms** | 2.0 ms | 147 ms | 12.7 ms |
| File size | **0.5 MB** | 0.6 MB | 50.2 MB | 7.4 MB |

**Chosen for the product: the CNN (unchanged).** Under fair conditions it still has the highest score on every tone and
both acted datasets. It gives the most honest probabilities and catches the most anger with its own alert rule. It is
also the smallest and fastest.

**Ranking and role of each model:**

1. **CNN: the deployed model.** With its own validated rule (p >= 0.8 on 2 windows) it would catch 72.5 % of mild and
   97.1 % of heated arguments, at 1.1 % false alarms on calm recordings. The live rule stays at p >= 0.6 on 3 windows
   because it has fewer false alarms (0.4 %), which suits a precision-first alert. At that rule it still catches 94.7 % of
   heated arguments.
2. **BiLSTM + attention: the reserve model.** With the CNN's training budget its speech accuracy is 1 point higher than before (67.6 → 68.6 %), though its macro-F1 is slightly lower (0.631 → 0.614). It is
   still 7 points behind on speech and worse calibrated. It uses the same input and ONNX interface, so it can replace the
   CNN with no backend change. It is worth retrying when real recordings exist, or as a second opinion in an ensemble.
3. **SVM: a classical baseline only.** It has the fewest false alarms but catches only 70 % of heated arguments. It is
   12 points behind on speech, 9 times slower (mostly feature extraction) and 15 times larger.
4. **Random forest: not suitable.** With fair calibration it no longer misses almost all anger (90 % of heated arguments
   caught). But its alert has the most false alarms (1.8 %, over the 1 % target on test). It is the weakest on RAVDESS,
   by far the slowest (147 ms per window) and the largest (50 MB).

**What the fair setup changed:**
* **Calibration and alert rules fixed the forest's alert.** Heated arguments caught went from 9 % to 90 %.
* **The richer features improved the classical models on validation, but not on the unseen test speakers.** Speech-only
  accuracy was SVM 66.9 → 63.7 % and forest 65.6 → 64.3 %. The extra 1,680 numbers fit the training actors more closely
  instead of generalising better.

Neither change closed the gap, so the CNN's lead does not come from an unfair setup. Reading the whole MFCC image works
better on unseen speakers than summary numbers do.

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
