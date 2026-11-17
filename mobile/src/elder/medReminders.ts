import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { Medicine } from '../types';

// Medicine reminders that ring at the dose time even when MzaziCare is closed: the phone schedules them itself.
// Scheduled a week ahead and re-synced every time the elder's home loads, so a dose taken early today, or a
// medicine the family removed or moved, does not ring. Without opening the app for a week, reminders run out.

const PREFIX = 'med-';
const DAYS_AHEAD = 7;
const CHANNEL = 'medicine';

const TEXT = {
  en: { title: 'Time for your medicine', open: 'Open MzaziCare to mark it as taken.' },
  sw: { title: 'Wakati wa dawa yako', open: 'Fungua MzaziCare uweke alama kuwa umeinywa.' },
};

let channelReady = false;
let last = ''; // what was synced last, to skip work when nothing changed
let busy = false;

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function syncMedicineReminders(medicines: Medicine[], lang: 'en' | 'sw') {
  if (Platform.OS !== 'android' || busy) return;
  const now = new Date();
  const key = JSON.stringify([day(now), lang, medicines.map((m) => [m.id, m.name, m.dose, m.time, m.taken])]);
  if (key === last) return;
  busy = true;
  try {
    if (!channelReady) {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Medicine reminders',
        description: 'At the time of each medicine',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 400, 250, 400],
      });
      channelReady = true;
    }

    // The reminders we want: each medicine at its time, for the next week, skipping today's if taken or past.
    const wanted = new Map<string, { m: Medicine; at: Date }>();
    for (const m of medicines) {
      const [h, min] = m.time.split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(min)) continue;
      for (let i = 0; i < DAYS_AHEAD; i++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, min);
        if (at <= now || (i === 0 && m.taken)) continue;
        wanted.set(`${PREFIX}${m.id}-${day(at)}-${m.time}-${lang}`, { m, at });
      }
    }

    const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.identifier.startsWith(PREFIX));
    const have = new Set(scheduled.map((n) => n.identifier));
    for (const n of scheduled) if (!wanted.has(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    for (const [identifier, { m, at }] of wanted) {
      if (have.has(identifier)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: TEXT[lang].title,
          body: `${m.name}${m.dose ? ` · ${m.dose}` : ''}. ${TEXT[lang].open}`,
          data: { type: 'medicine', id: m.id },
        },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
    last = key;
  } catch {
    /* notifications unavailable (e.g. Expo Go): the home screen still shows the medicines */
  } finally {
    busy = false;
  }
}

// On sign-out: this phone should not keep reminding about someone else's medicine.
export async function cancelMedicineReminders() {
  last = '';
  if (Platform.OS !== 'android') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) if (n.identifier.startsWith(PREFIX)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  } catch {
    /* nothing scheduled */
  }
}
