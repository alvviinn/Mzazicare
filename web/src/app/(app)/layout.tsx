'use client';

import type { LucideIcon } from 'lucide-react';
import { AudioWaveform, CalendarDays, ClipboardCheck, House, LogOut, MessageSquareText, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { Brand } from '@/components/Brand';
import { Avatar, Loading } from '@/components/ui';
import { getDashboard } from '@/lib/api';
import { useAuth, usePolling } from '@/lib/auth';
import { DashContext } from '@/lib/dashboard';

// The same icons and names as the app's tab bar. `short` is the label in the bottom tab bar on small screens.
const NAV: { href: string; label: string; short: string; Icon: LucideIcon }[] = [
  { href: '/', label: 'Home', short: 'Home', Icon: House },
  { href: '/shifts', label: 'Shifts', short: 'Shifts', Icon: CalendarDays },
  { href: '/tasks', label: 'Task history', short: 'Tasks', Icon: ClipboardCheck },
  { href: '/tone', label: 'Voice tone', short: 'Tone', Icon: AudioWaveform },
  { href: '/chats', label: 'Chats', short: 'Chats', Icon: MessageSquareText },
  { href: '/people', label: 'People', short: 'People', Icon: Users },
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
      <div style={{ padding: 'var(--xl)' }}>
        <Loading label="Loading…" />
      </div>
    );

  const openAlerts = dash ? dash.alerts.filter((a) => a.status === 'open').length : 0;
  const unread = dash ? [...dash.caretakers, ...dash.elderly].reduce((n, p) => n + p.unread, 0) : 0;
  const badge = (href: string) => (href === '/' ? openAlerts : href === '/chats' ? unread : 0);
  const out = () => {
    signOut();
    router.replace('/login');
  };

  const links = (where: 'side' | 'tabs') =>
    NAV.map((n) => {
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
          <span className="nav-icon">
            <n.Icon className="icon" aria-hidden />
            {count > 0 && where === 'tabs' && <span className="badge dot-badge">{count}</span>}
          </span>
          <span className="label">{where === 'tabs' ? n.short : n.label}</span>
          {count > 0 && where === 'side' && <span className="badge">{count}</span>}
        </Link>
      );
    });

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>

      {/* wide screens: a sidebar */}
      <nav className="sidebar" aria-label="Main">
        <Link href="/" className="brand-link" aria-label="MzaziCare home">
          <Brand />
        </Link>
        <div className="nav">{links('side')}</div>
        <div className="who">
          <Avatar name={profile.name} size={40} />
          <div className="grow">
            <div className="strong ellipsis">{profile.name}</div>
            <div className="caption ellipsis">{profile.email}</div>
          </div>
          <button type="button" className="icon-btn" onClick={out} aria-label="Sign out" title="Sign out">
            <LogOut className="icon" aria-hidden />
          </button>
        </div>
      </nav>

      {/* small screens: the app's top bar and bottom tab bar */}
      <header className="topbar">
        <Link href="/" className="brand-link" aria-label="MzaziCare home">
          <Brand />
        </Link>
        <button type="button" className="btn soft small" onClick={out}>
          <LogOut className="icon" aria-hidden />
          Sign out
        </button>
      </header>
      <nav className="tabbar" aria-label="Main">
        {links('tabs')}
      </nav>

      <main className="main" id="main">
        <DashContext.Provider value={{ dash, error, reload }}>{children}</DashContext.Provider>
      </main>
    </div>
  );
}
