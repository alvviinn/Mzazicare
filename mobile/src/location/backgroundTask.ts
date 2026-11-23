import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { sendLocation, SESSION_EXPIRED } from '../api/client';
import { stopVoice, voiceTick } from '../audio/voiceService';
import { loadSession } from '../auth/session';
import { setResumeReminder } from '../../modules/mic-keeper';

// Keeps sending this phone's position while MzaziCare is in the background or the screen is off,
// so a visit is verified (and the shift timer runs) without anyone keeping the app open.
// Android runs it as a foreground service, which shows a small "sharing location" notification;
// that also means only the normal "while using the app" permission is needed, not "Allow all the time".
// This file must be imported at start-up (index.ts): when Android wakes the task, no screen is mounted.

export const LOCATION_TASK = 'mzazicare-location';
export const FIX_EVERY_MS = 15000; // the server ignores fixes older than 2 minutes, so this leaves room for a few misses
const MIN_GAP_MS = 10000; // Android may deliver batches or extra fixes; never post more often than this

export type FixResult = 'sent' | 'failed';
const listeners = new Set<(r: FixResult) => void>();
let lastPostAt = 0;

// The open screen listens so its "Location on" pill reflects what the background task is doing.
export function onFix(fn: (r: FixResult) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const report = (r: FixResult) => listeners.forEach((fn) => fn(r));

export async function postFix(token: string, loc: Location.LocationObject) {
  lastPostAt = Date.now();
  try {
    await sendLocation(token, {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      mocked: !!loc.mocked, // Android flags fixes from fake-GPS apps
    });
    report('sent');
  } catch (e) {
    report('failed');
    throw e;
  }
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  if (Date.now() - lastPostAt < MIN_GAP_MS) return;
  // The newest fix; if a batch arrives, prefer the most accurate of the last 30 seconds.
  const newest = data.locations[data.locations.length - 1];
  const recent = data.locations.filter((l) => newest.timestamp - l.timestamp <= 30000);
  const best = recent.reduce((a, b) => ((b.coords.accuracy ?? 999) < (a.coords.accuracy ?? 999) ? b : a), newest);

  const session = await loadSession();
  if (!session || (session.role !== 'caretaker' && session.role !== 'elderly')) {
    await stopBackgroundSharing(); // signed out (or not a role that shares): stop the notification and the GPS
    await stopVoice();
    return;
  }
  voiceTick(session.token); // voice monitoring has no working timers in the background: each fix drives it
  try {
    await postFix(session.token, best);
  } catch (e) {
    if (e instanceof Error && e.message === SESSION_EXPIRED) await stopBackgroundSharing();
    // No internet: just wait for the next fix.
  }
});

// Starts the service (or leaves it running). Must be called while the app is on screen.
export async function startBackgroundSharing(
  notice: { title: string; body: string },
  resume: { title: string; body: string },
) {
  setResumeReminder(true, resume.title, resume.body); // after a restart or update: "tap to turn it back on"
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: FIX_EVERY_MS,
    distanceInterval: 0, // keep reporting while sitting still: that is most of a visit
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: notice.title,
      notificationBody: notice.body,
      notificationColor: '#1E5AA8',
      killServiceOnDestroy: false, // keep going when the app is swiped away from recent apps
    },
  });
}

export async function stopBackgroundSharing() {
  setResumeReminder(false);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // Not running, or not supported here (Expo Go, web).
  }
}
