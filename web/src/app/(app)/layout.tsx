'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { getDashboard } from '@/lib/api';
import { useAuth, usePolling } from '@/lib/auth';
import { DashContext } from '@/lib/dashboard';

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV = [
  { href: '/', label: 'Overview', icon: icon('M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10') },
  { href: '/shifts', label: 'Shifts', icon: icon('M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z') },
  { href: '/tone', label: 'Voice tone', icon: icon('M4 12h2M8 8v8M12 4v16M16 8v8M20 12h-2') },
  { href: '/chats', label: 'Chats', icon: icon('M21 12a8 8 0 01-11.5 7.2L4 20l1-4.5A8 8 0 1121 12z') },
  { href: '/people', label: 'People', icon: icon('M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0') },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { token, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const { data: dash, error, reload } = usePolling(getDashboard, 10000);

  useEffect(() => {
    if (!loading && !token) router.replace('/login');
  }, [loading, token, router]);

  if (loading || !token || !profile) return <p className="muted" style={{ padding: 32 }}>Loading…</p>;

  const openAlerts = dash ? dash.alerts.filter((a) => a.status === 'open').length : 0;
  const unread = dash ? [...dash.caretakers, ...dash.elderly].reduce((n, p) => n + p.unread, 0) : 0;
  const badge = (href: string) => (href === '/' ? openAlerts : href === '/chats' ? unread : 0);

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">MzaziCare</div>
        {NAV.map((n) => {
          const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
          const count = badge(n.href);
          return (
            <Link key={n.href} href={n.href} className={`nav-link${active ? ' active' : ''}`}>
              {n.icon}
              {n.label}
              {count > 0 && <span className="badge">{count}</span>}
            </Link>
          );
        })}
        <div className="spacer" />
        <div className="who">
          <b>{profile.name}</b>
          <span>{profile.email}</span>
          <br />
          <button
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
