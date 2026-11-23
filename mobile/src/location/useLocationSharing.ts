import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { FIX_EVERY_MS, onFix, postFix, startBackgroundSharing } from './backgroundTask';

// 'foreground': sharing works, but only while the app is open (background service could not start).
export type SharingStatus = 'starting' | 'sharing' | 'foreground' | 'denied' | 'error';

const NOTICE = {
  en: { title: 'MzaziCare is sharing location', body: 'This confirms care visits. It stops when you sign out.' },
  sw: { title: 'MzaziCare inashiriki mahali', body: 'Hii inathibitisha ziara za matunzo. Inazimwa ukitoka kwenye akaunti.' },
};

// After a phone restart or an app update Android will not restart the sharing by itself (see ResumeReceiver.kt).
const RESUME = {
  en: { title: 'Open MzaziCare to turn it back on', body: 'Your phone restarted, so MzaziCare stopped. Tap here so care visits keep being recorded.' },
  sw: { title: 'Fungua MzaziCare ili iwake tena', body: 'Simu yako ilizimwa na kuwashwa, kwa hivyo MzaziCare ilisimama. Gusa hapa ili ziara za matunzo ziendelee kurekodiwa.' },
};

// Shares this phone's position with the server, which compares the caretaker's and the elder's phones
// to verify visits (15 m geofence) and start and stop the shift by itself.
// The sharing keeps running in the background (backgroundTask.ts) after this screen closes;
// it stops only when the user signs out.
export function useLocationSharing(token: string, lang: 'en' | 'sw' = 'en') {
  const [status, setStatus] = useState<SharingStatus>('starting');
  const [lastSent, setLastSent] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let background = false;

    const stopListening = onFix((r) => {
      if (cancelled) return;
      if (r === 'sent') {
        setStatus(background ? 'sharing' : 'foreground');
        setLastSent(new Date());
      } else setStatus((s) => (s === 'denied' ? s : 'error'));
    });

    async function sendNow() {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        await postFix(token, pos);
      } catch {
        if (!cancelled) setStatus((s) => (s === 'denied' ? s : 'error'));
      }
    }

    (async () => {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      try {
        await startBackgroundSharing(NOTICE[lang], RESUME[lang]);
        background = true;
      } catch {
        // E.g. Expo Go, or the phone refused the service: fall back to sending while the app is open.
        timer = setInterval(sendNow, FIX_EVERY_MS);
      }
      if (!cancelled) sendNow(); // a first fix straight away, so the shift screen updates at once
    })();

    return () => {
      cancelled = true;
      stopListening();
      if (timer) clearInterval(timer);
    };
  }, [token, lang]);

  return { status, lastSent };
}
