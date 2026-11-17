'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, LogIn, MailCheck } from 'lucide-react';
import { Brand } from '@/components/Brand';
import { ErrorNote } from '@/components/ui';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { resendCode } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CodeChallenge } from '@/lib/types';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const RESEND_AFTER_S = 30;

export default function LoginPage() {
  const { token, loading, signIn, confirmCode, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CodeChallenge | null>(null); // waiting for the emailed code

  useEffect(() => {
    if (!loading && token) router.replace('/');
  }, [loading, token, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError('');
    try {
      const challenge = await signIn(email.trim().toLowerCase(), password);
      if (challenge) setPending(challenge);
      else router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function google(idToken: string) {
    setError('');
    try {
      await signInWithGoogle(idToken);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  }

  if (pending) {
    return (
      <AuthFrame>
        <CodeForm
          start={pending}
          onConfirm={async (challenge, code) => {
            await confirmCode(challenge, code);
            router.replace('/');
          }}
          onCancel={() => setPending(null)}
        />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={submit} noValidate>
        <h1>Sign in</h1>
        <p className="muted">Follow your loved one&apos;s care from anywhere.</p>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorNote message={error} />
        <button type="submit" className="btn primary block" disabled={busy} aria-busy={busy}>
          <LogIn className="icon" aria-hidden />
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {GOOGLE_CLIENT_ID && <GoogleButton onToken={google} />}
        <p className="caption auth-foot">
          No account yet? Create one in the MzaziCare phone app{GOOGLE_CLIENT_ID ? ' (or continue with Google)' : ''}, then sign in here. Caretakers and elders use the phone app.
        </p>
      </form>
    </AuthFrame>
  );
}

// The second step for accounts created after two-step sign-in was added: the code that was emailed.
function CodeForm({
  start,
  onConfirm,
  onCancel,
}: {
  start: CodeChallenge;
  onConfirm: (challenge: string, code: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [challenge, setChallenge] = useState(start);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER_S);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) return setError('Enter the 6-digit code from the email.');
    setBusy(true);
    setError('');
    try {
      await onConfirm(challenge.challenge, digits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    setNote('');
    try {
      setChallenge(await resendCode(challenge.challenge));
      setCode('');
      setNote('A new code is on its way. The old one no longer works.');
      setWait(RESEND_AFTER_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a new code.');
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <span className="auth-icon">
        <MailCheck className="icon-m" aria-hidden />
      </span>
      <h1>Check your email</h1>
      <p className="muted">
        We sent a 6-digit code to <b>{challenge.sent_to}</b>. It works for {Math.round(challenge.expires_in / 60)} minutes.
      </p>
      <label htmlFor="code">Code</label>
      <input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123456"
        className="code-input"
      />
      <ErrorNote message={error} />
      {note && (
        <p className="ok-note" role="status">
          <MailCheck className="icon" aria-hidden />
          {note}
        </p>
      )}
      <button type="submit" className="btn primary block" disabled={busy} aria-busy={busy}>
        {busy ? 'Checking…' : 'Continue'}
      </button>
      <div className="auth-links">
        <button type="button" className="linklike" onClick={onCancel}>
          <ArrowLeft className="icon" aria-hidden />
          Back
        </button>
        <button type="button" className="linklike" onClick={resend} disabled={wait > 0}>
          {wait > 0 ? `Send a new code in ${wait} s` : 'Send a new code'}
        </button>
      </div>
    </form>
  );
}

// The frame for sign in and the emailed code, as in the app: the brand on the ink hero panel, the form beside it
// (above it on a narrow screen).
function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="auth">
      <section className="auth-band" aria-label="MzaziCare">
        <Brand />
        <p className="auth-tagline">Care for Mzazi, from anywhere.</p>
        <p className="on-ink-caption auth-sub">Who is with them, for how long, how they sound and whether they took their medicine.</p>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}

type GoogleId = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

// Google's own "Sign in with Google" button (Google Identity Services). It hands back an ID token,
// which the backend checks before signing the family member in.
function GoogleButton({ onToken }: { onToken: (idToken: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;

  useEffect(() => {
    const render = () => {
      const g = (window as unknown as { google?: GoogleId }).google;
      if (!g || !box.current) return;
      g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => callback.current(r.credential) });
      g.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', text: 'continue_with', width: 320 });
    };
    const existing = document.getElementById('google-gsi') as HTMLScriptElement | null;
    if (existing) {
      if ((window as unknown as { google?: GoogleId }).google) render();
      else existing.addEventListener('load', render);
      return () => existing.removeEventListener('load', render);
    }
    const s = document.createElement('script');
    s.id = 'google-gsi';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.addEventListener('load', render);
    document.head.appendChild(s);
    return () => s.removeEventListener('load', render);
  }, []);

  return (
    <>
      <div className="or">or</div>
      <div ref={box} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
    </>
  );
}
