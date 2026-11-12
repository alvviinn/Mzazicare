import { useSyncExternalStore } from 'react';

// Whether the server can be reached. Every API call reports here: a network failure marks the app
// offline, any reply from the server marks it online. While offline, the server is checked every 15 s.
// (No extra native module is needed: this also catches "phone has data but the server is down".)

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const PROBE_MS = 15000;

let online = true;
let probe: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

export function setOnline(value: boolean) {
  if (value === online) return;
  online = value;
  if (!online && !probe) probe = setInterval(check, PROBE_MS);
  if (online && probe) {
    clearInterval(probe);
    probe = null;
  }
  listeners.forEach((l) => l());
}

export function isOnline() {
  return online;
}

async function check() {
  if (!API_URL) return;
  try {
    await fetch(`${API_URL}/api/`, { method: 'HEAD' }); // any answer at all means the server is reachable
    setOnline(true);
  } catch {
    /* still offline */
  }
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribe, isOnline, isOnline);
}

// The message for a network failure, so screens can tell "offline" apart from a real refusal.
export const NETWORK_ERROR = "Can't reach the server. Check your internet connection.";
