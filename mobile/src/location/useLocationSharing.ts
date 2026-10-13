import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { sendLocation } from '../api/client';

export type SharingStatus = 'starting' | 'sharing' | 'denied' | 'error';

// Sends this phone's position to the server every few seconds while the app is open.
// The server compares the caretaker's and the elder's phones to verify visits (15 m geofence).
// NOTE: this is foreground-only. Keeping it running with the screen off needs a development build
// with background location, which is a later step.
export function useLocationSharing(token: string, intervalMs = 15000) {
  const [status, setStatus] = useState<SharingStatus>('starting');
  const [lastSent, setLastSent] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function send() {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        await sendLocation(token, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          mocked: !!pos.mocked, // Android flags fixes from fake-GPS apps
        });
        if (!cancelled) {
          setStatus('sharing');
          setLastSent(new Date());
        }
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
      send();
      timer = setInterval(send, intervalMs);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [token, intervalMs]);

  return { status, lastSent };
}
