'use client';

import type { LucideIcon } from 'lucide-react';
import { AudioLines, ClipboardCheck, Clock, House, MessageSquare, Users } from 'lucide-react';
import { Loading } from '@/components/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { getDashboard } from '@/lib/api';
import { useAuth, usePolling } from '@/lib/auth';
import { DashContext } from '@/lib/dashboard';

// One icon set (lucide), one size and stroke throughout.
const NAV: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/', label: 'Overview', Icon: House },
  { href: '/shifts', label: 'Shifts', Icon: Clock },
  { href: '/tasks', label: 'Task history', Icon: ClipboardCheck },
  { href: '/tone', label: 'Voice tone', Icon: AudioLines },
  { href: '/chats', label: 'Chats', Icon: MessageSquare },
  { href: '/people', label: 'People', Icon: Users },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { token, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const { data: dash, error, reload } = usePolling(getDashboard, 10000);

  useEffect(() => {
    if (!loading && !token) router.replace('/login');
  }, [loading, token, router]);

  if (loading || !token || !profile)
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Loading label="Loading…" />
      </div>
    );

  const openAlerts = dash ? dash.alerts.filter((a) => a.status === 'open').length : 0;
  const unread = dash ? [...dash.caretakers, ...dash.elderly].reduce((n, p) => n + p.unread, 0) : 0;
  const badge = (href: string) => (href === '/' ? openAlerts : href === '/chats' ? unread : 0);

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">MzaziCare</div>
        <div className="nav">
        {NAV.map((n) => {
          const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
          const count = badge(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-link${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
              aria-label={count > 0 ? `${n.label}, ${count} new` : n.label}
            >
              <n.Icon className="icon" aria-hidden strokeWidth={1.8} />
              <span className="label">{n.label}</span>
              {count > 0 && <span className="badge">{count}</span>}
            </Link>
          );
        })}
        </div>
        <div className="spacer" />
        <div className="who">
          <b>{profile.name}</b>
          <span>{profile.email}</span>
          <br />
          <button
            aria-label="Sign out"
            className="linklike"
            onClick={() => {
              signOut();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="main">
        <DashContext.Provider value={{ dash, error, reload }}>{children}</DashContext.Provider>
      </main>
    </div>
  );
}
