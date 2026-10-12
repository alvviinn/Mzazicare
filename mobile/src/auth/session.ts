import * as SecureStore from 'expo-secure-store';
import { AuthResult, Role } from '../types';

const KEY = 'mzazicare_session';
export const SESSION_DAYS = 90; // users stay signed in for about 3 months

export type Session = { token: string; name: string; role: Role; expiresAt: number };

export async function saveSession(s: AuthResult): Promise<Session> {
  const session: Session = { ...s, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 };
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  return session;
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const s: Session = JSON.parse(raw);
    if (s.expiresAt < Date.now()) {
      await clearSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(KEY);
}
