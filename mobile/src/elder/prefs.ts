import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Lang } from './i18n';

const KEY = 'mzazicare_elder_prefs';
export const SCALES = [1, 1.25, 1.5]; // normal, large, extra large

type Prefs = { lang: Lang; scaleIndex: number };

// Language and text size for the elderly screen, remembered on the phone.
export function useElderPrefs() {
  const [prefs, setPrefs] = useState<Prefs>({ lang: 'en', scaleIndex: 1 });

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setPrefs((p) => ({ ...p, ...JSON.parse(raw) })))
      .catch(() => {});
  }, []);

  function update(next: Prefs) {
    setPrefs(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }

  return {
    lang: prefs.lang,
    scale: SCALES[prefs.scaleIndex] ?? 1.25,
    scaleIndex: prefs.scaleIndex,
    setLang: (lang: Lang) => update({ ...prefs, lang }),
    cycleScale: () => update({ ...prefs, scaleIndex: (prefs.scaleIndex + 1) % SCALES.length }),
  };
}
