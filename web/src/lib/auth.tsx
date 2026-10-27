'use client';

import { useRouter } from 'next/navigation';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { getProfile, login as apiLogin, SESSION_EXPIRED } from './api';
import { Profile } from './types';

const KEY = 'mzazicare.token';

type Auth = {
  token: string | null;
  profile: Profile | null;
  loading: boolean; // true until we know whether a saved session is still valid
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

// The session lives in this browser's localStorage, like the phone app keeps it in secure storage.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
    setToken(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* storage blocked */
    }
    if (!saved) {
      setLoading(false);
      return;
    }
    getProfile(saved)
      .then((p) => {
        if (p.role !== 'user') throw new Error('not a family account');
        setToken(saved);
        setProfile(p);
      })
      .catch(() => signOut())
      .finally(() => setLoading(false));
  }, [signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    if (result.role !== 'user') {
      throw new Error(
        'This dashboard is for family accounts. Caretakers and elderly people use the MzaziCare phone app.',
      );
    }
    const p = await getProfile(result.token);
    try {
      localStorage.setItem(KEY, result.token);
    } catch {
      /* storage blocked: the session lasts until the tab closes */
    }
    setToken(result.token);
    setProfile(p);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    try {
      setProfile(await getProfile(token));
    } catch (e) {
      if (e instanceof Error && e.message === SESSION_EXPIRED) signOut();
    }
  }, [token, signOut]);

  return <Ctx.Provider value={{ token, profile, loading, signIn, signOut, refreshProfile }}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

/** The signed-in family's token. Pages under (app) are only rendered when there is one. */
export function useToken(): string {
  const { token } = useAuth();
  if (!token) throw new Error('No session');
  return token;
}

/** Loads something now and then every `ms` milliseconds; signs out if the session has expired. */
export function usePolling<T>(load: (token: string) => Promise<T>, ms: number) {
  const { token, signOut } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    if (!token) return;
    try {
      setData(await load(token));
      setError('');
    } catch (e) {
      if (e instanceof Error && e.message === SESSION_EXPIRED) {
        signOut();
        router.replace('/login');
      } else {
        setError(e instanceof Error ? e.message : 'Could not load this page.');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    run();
    const id = setInterval(run, ms);
    return () => clearInterval(id);
  }, [run, ms]);

  return { data, error, reload: run };
}
