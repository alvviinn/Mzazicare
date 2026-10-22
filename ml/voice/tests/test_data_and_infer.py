import csv
import tempfile
import unittest
from pathlib import Path

import numpy as np

from voice import data
from voice.config import CLASSES, TONES
from voice.infer import ART, ToneAnalyzer

from .test_features import tone, wav_bytes


class LabelMappingTests(unittest.TestCase):
    """Uses empty stand-in files: only the names matter to the indexers."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self._old = data.DATA
        data.DATA = self.root

    def tearDown(self):
        data.DATA = self._old
        self._tmp.cleanup()

    def touch(self, *parts):
        p = self.root.joinpath(*parts)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b'')

    def test_ravdess_maps_emotions_and_drops_ambiguous_ones(self):
        for emotion in ('01', '02', '03', '04', '05', '06', '07', '08'):  # neutral..surprised
            self.touch('ravdess', 'Actor_01', f'03-01-{emotion}-01-01-01-01.wav')
        labels = sorted(r['label'] for r in data.ravdess())
        self.assertEqual(labels, ['angry', 'calm', 'happy', 'neutral', 'stressed', 'stressed'])  # no disgust, no surprise

    def test_ravdess_ignores_song_and_video_files(self):
        self.touch('ravdess', 'Actor_01', '02-01-05-01-01-01-01.wav')  # modality 02 = video, not speech
        self.touch('ravdess', 'Actor_01', '03-02-05-01-01-01-01.wav')  # vocal channel 02 = song
        self.assertEqual(data.ravdess(), [])

    def test_ravdess_splits_by_actor(self):
        for actor in (1, 17, 21):
            self.touch('ravdess', f'Actor_{actor:02d}', f'03-01-03-01-01-01-{actor:02d}.wav')
        split = {r['speaker']: r['split'] for r in data.ravdess()}
        self.assertEqual(split, {'rav1': 'train', 'rav17': 'val', 'rav21': 'test'})

    def test_cremad_maps_emotions_and_keeps_speakers_apart(self):
        for actor in range(1001, 1031):
            for emo in ('ANG', 'DIS', 'FEA', 'HAP', 'NEU', 'SAD'):
                self.touch('cremad', 'AudioWAV', f'{actor}_DFA_{emo}_XX.wav')
        rows = data.cremad()
        self.assertEqual(set(r['label'] for r in rows), {'angry', 'happy', 'neutral', 'stressed'})  # disgust dropped
        by_speaker = {}
        for r in rows:
            by_speaker.setdefault(r['speaker'], set()).add(r['split'])
        self.assertTrue(all(len(s) == 1 for s in by_speaker.values()), 'a speaker appears in more than one split')
        self.assertEqual({r['split'] for r in rows}, {'train', 'val', 'test'})

    def test_esc50_keeps_only_non_human_sounds_split_by_fold(self):
        meta = self.root / 'esc50' / 'ESC-50-master' / 'meta'
        meta.mkdir(parents=True)
        with open(meta / 'esc50.csv', 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['filename', 'fold', 'target', 'category'])
            w.writerow(['a.wav', 1, 0, 'dog'])
            w.writerow(['b.wav', 5, 1, 'vacuum_cleaner'])
            w.writerow(['c.wav', 2, 2, 'laughing'])  # a person: excluded from "noise"
            w.writerow(['d.wav', 4, 3, 'crying_baby'])  # a person: excluded
        rows = data.esc50()
        self.assertEqual({(r['label'], r['split']) for r in rows}, {('noise', 'train'), ('noise', 'test')})
        self.assertEqual(len(rows), 2)


@unittest.skipUnless((ART / 'tone_cnn.onnx').exists(), 'trained model not present')
class AnalyzerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.analyzer = ToneAnalyzer()

    def test_silence_returns_no_speech(self):
        r = self.analyzer.analyze(wav_bytes(np.zeros(16000 * 5, np.float32), 16000))
        self.assertEqual((r['speech_s'], r['dominant'], r['distress']), (0.0, None, False))

    def test_result_has_all_tones_that_add_up(self):
        r = self.analyzer.analyze(wav_bytes(tone(6, 180, 0.4), 16000))
        self.assertEqual(set(r['tones']), set(TONES))
        if r['speech_windows']:
            self.assertAlmostEqual(sum(r['tones'].values()), 1.0, places=2)
        else:
            self.assertEqual(sum(r['tones'].values()), 0)

    def test_model_file_describes_itself(self):
        meta = self.analyzer.meta
        self.assertEqual(meta['classes'], CLASSES)
        self.assertEqual(len(meta['mean']), 40)
        self.assertGreater(meta['metrics']['test_accuracy'], 0.8)  # the project's accuracy target

    def test_alert_rule_is_the_cautious_one_from_the_model_file(self):
        self.assertGreaterEqual(self.analyzer.angry_min_windows, 3)
        self.assertGreaterEqual(self.analyzer.angry_prob, 0.6)

    def test_same_audio_gives_the_same_answer(self):
        audio = wav_bytes(tone(6, 300, 0.3), 16000)
        self.assertEqual(self.analyzer.analyze(audio), self.analyzer.analyze(audio))


class ModelTests(unittest.TestCase):
    def test_forward_shape_and_size(self):
        try:
            import torch
        except ImportError:
            self.skipTest('PyTorch not installed')
        from voice.config import N_FRAMES, N_MFCC
        from voice.model import ToneCNN
        m = ToneCNN().eval()
        out = m(torch.zeros(2, 1, N_MFCC, N_FRAMES))
        self.assertEqual(tuple(out.shape), (2, len(CLASSES)))
        self.assertLess(sum(p.numel() for p in m.parameters()), 200_000)  # must stay phone/CPU friendly


if __name__ == '__main__':
    unittest.main()
