'use client';

import Link from 'next/link';
import { ErrorNote, Loading, PageHead, Section, ShiftTable } from '@/components/ui';
import { getShifts } from '@/lib/api';
import { usePolling } from '@/lib/auth';
import { fmtDuration } from '@/lib/format';
import { ShiftSummary } from '@/lib/types';

const short = (min: number) => (min < 60 ? `${min}m` : `${Math.round((min / 60) * 10) / 10}h`);

/** The last 14 days as bars: how long the caretaker was active each day. A day with a shift opens it. */
function DayStrip({ shifts, days = 14 }: { shifts: ShiftSummary[]; days?: number }) {
  const byDate = new Map<string, { minutes: number; id: number }>();
  for (const s of shifts) {
    const cur = byDate.get(s.date);
    byDate.set(s.date, cur ? { minutes: cur.minutes + s.minutes, id: cur.id } : { minutes: s.minutes, id: s.id });
  }
  const now = new Date();
  const list = Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getTime() - (days - 1 - i) * 86400000);
    const p = (n: number) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    return { key, d, entry: byDate.get(key) };
  });
  const max = Math.max(60, ...list.map((x) => x.entry?.minutes ?? 0));

  return (
    <div className="card day-strip">
      {list.map(({ key, d, entry }, i) => {
        const label = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
        const inner = (
          <>
            <span className={entry ? 'caption-strong' : 'caption'}>{entry ? short(entry.minutes) : '–'}</span>
            <span className="day-track">{entry && <span style={{ height: `${Math.max(10, (100 * entry.minutes) / max)}%` }} />}</span>
            <span className={i === list.length - 1 ? 'caption-strong' : 'caption'}>{d.toLocaleDateString([], { weekday: 'narrow' })}</span>
          </>
        );
        return entry ? (
          <Link key={key} href={`/shifts/day?id=${entry.id}`} className={`day${i === list.length - 1 ? ' today' : ''}`} aria-label={`${label}: ${fmtDuration(entry.minutes)} active`} title={label}>
            {inner}
          </Link>
        ) : (
          <span key={key} className={`day${i === list.length - 1 ? ' today' : ''}`} aria-label={`${label}: no shift`} title={label} role="img">
            {inner}
          </span>
        );
      })}
    </div>
  );
}

// Every day's shift for the last 30 days. A shift is one day: breaks do not end it.
export default function ShiftsPage() {
  const { data: shifts, error } = usePolling((t) => getShifts(t, 30), 20000);
  if (!shifts) return error ? <ErrorNote message={`Couldn't load the shifts. ${error}`} /> : <Loading label="Loading shifts…" />;
  const total = shifts.reduce((n, s) => n + s.minutes, 0);
  const days = new Set(shifts.map((s) => s.date)).size;

  return (
    <>
      <PageHead kicker="Last 30 days" title="Shifts" />

      <section className="card ink hero" aria-label={`Last 30 days: ${fmtDuration(total)} active over ${days} days`}>
        <p className="on-ink-caption">Active time with your loved one</p>
        <div className="on-ink-display">{fmtDuration(total)}</div>
        <p className="on-ink-caption">
          {days} day{days === 1 ? '' : 's'} worked{days ? ` · about ${fmtDuration(Math.round(total / days))} a day` : ''}
        </p>
      </section>

      <Section title="Recent days" />
      <DayStrip shifts={shifts} />

      <Section title="All shifts" />
      <div className="card flush">
        <ShiftTable shifts={shifts} />
      </div>
      <p className="caption note">One shift per day. Stepping out is a break and the same shift continues when they return. Click a day for its map and timeline.</p>
    </>
  );
}
