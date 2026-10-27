'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageHead, ShiftTable, Tile, ToneBars, ErrorNote } from '@/components/ui';
import { resolveAlert } from '@/lib/api';
import { useAuth, useToken } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { fmtDuration, fmtTime, timeAgo, timeOfDay } from '@/lib/format';
import { AlertItem, Dashboard } from '@/lib/types';

function AlertCard({ alert, onDone }: { alert: AlertItem; onDone: () => void }) {
  const token = useToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sos = alert.kind === 'sos';

  async function act(status: 'confirmed' | 'dismissed') {
    setBusy(true);
    setError('');
    try {
      await resolveAlert(token, alert.id, status);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the alert.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`alert${sos ? ' sos' : ''}`}>
      <h3>
        {alert.label} · <span className="muted small">{timeAgo(alert.created_at)}</span>
      </h3>
      <p style={{ margin: '6px 0 10px' }}>
        {alert.message}
        {sos && ' Call them or message them now. Their chat is under Chats.'}
      </p>
      <div className="row">
        <button onClick={() => act('confirmed')} disabled={busy}>
          {sos ? 'Handled' : alert.kind === 'unwell' ? 'Noted' : 'Confirm'}
        </button>
        <button className="secondary" onClick={() => act('dismissed')} disabled={busy}>
          {sos ? 'False alarm' : 'Dismiss'}
        </button>
        <ErrorNote message={error} />
      </div>
    </div>
  );
}

function TodayCard({ dash }: { dash: Dashboard }) {
  const { status, shifts } = dash.today;
  const s = shifts[0];
  let headline = 'No shift yet today';
  let detail = 'Nobody has arrived today.';
  if (status === 'on_shift' && s) {
    const breaks = s.breaks ? ` · ${s.breaks} break${s.breaks === 1 ? '' : 's'} so far` : '';
    headline = `${s.caretaker} is on shift`;
    detail = `With ${s.elderly} since ${fmtTime(s.start)} · active ${fmtDuration(s.minutes)}${breaks}`;
  } else if (status === 'paused' && s) {
    headline = `${s.caretaker} is on a break`;
    detail = `Stepped out${s.left ? ` at ${fmtTime(s.left)}` : ''}. Active time so far: ${fmtDuration(s.minutes)}. The same shift continues when they return.`;
  } else if (status === 'away' && s) {
    headline = `${s.caretaker} has left for now`;
    detail = `Last seen ${s.left ? fmtTime(s.left) : ''}. Active today: ${fmtDuration(s.minutes)}. If they return today it counts as the same shift.`;
  } else if (status === 'waiting' && s) {
    headline = `${s.caretaker}'s shift is open`;
    detail = 'They have not arrived yet.';
  } else if (status === 'completed' && s) {
    headline = `${s.caretaker} has finished for the day`;
    detail = `${fmtTime(s.start)} – ${s.end ? fmtTime(s.end) : ''} · active ${fmtDuration(s.minutes)}`;
  }
  const live = status === 'on_shift';
  return (
    <div className="card">
      <div className="row">
        <div className="grow">
          <h3>
            {live && <span className="live-dot" />}
            {headline}
          </h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {detail}
          </p>
        </div>
        {s && <Link href={`/shifts/${s.id}`}>See today&apos;s timeline →</Link>}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { profile } = useAuth();
  const { dash, error, reload } = useDashboard();

  if (!dash) return <p className="muted">{error || 'Loading your care overview…'}</p>;
  const open = dash.alerts.filter((a) => a.status === 'open');
  const past = dash.alerts.filter((a) => a.status !== 'open');
  const doneChores = dash.today.chores.filter((c) => c.is_done).length;

  return (
    <>
      <PageHead title={`${timeOfDay()}, ${profile?.name.split(' ')[0] ?? ''}`} sub="Here is how care is going today." />

      {dash.demo && (
        <div className="banner" style={{ marginTop: 14 }}>
          Sample data. Real visits, chores and tones will appear once your caretaker starts shifts in the app.
        </div>
      )}

      {open.length > 0 && (
        <>
          <h2>Needs your attention</h2>
          {open.map((a) => (
            <AlertCard key={a.id} alert={a} onDone={reload} />
          ))}
        </>
      )}

      {!dash.matched ? (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Set up your care circle</h3>
          <p className="muted">
            Add a caretaker and the person they care for, and this page fills with their care updates.{' '}
            <Link href="/people">Add people →</Link>
          </p>
        </div>
      ) : (
        <>
          <h2>Today</h2>
          <TodayCard dash={dash} />

          <div className="grid tiles" style={{ marginTop: 12 }}>
            <Tile value={fmtDuration(dash.stats.avg_visit_minutes)} label="Avg. active time per day" />
            <Tile value={String(dash.stats.visits_7d)} label="Days worked this week" />
            <Tile value={dash.stats.chore_rate_7d === null ? '–' : `${dash.stats.chore_rate_7d}%`} label="Chores done (7 days)" />
            <Tile value={`${dash.medicines.taken}/${dash.medicines.total}`} label="Medicines taken today" />
          </div>

          <div className="grid two">
            <div>
              <h2>Voice tone this week</h2>
              <div className="card">
                <ToneBars tones={dash.tones} />
                <p className="small" style={{ marginBottom: 0 }}>
                  <Link href="/tone">Open the live tone chart →</Link>
                </p>
              </div>
            </div>
            <div>
              <h2>How they are today</h2>
              <div className="card divided">
                {dash.wellbeing.length === 0 && <span className="muted">Nobody to show yet.</span>}
                {dash.wellbeing.map((w) => (
                  <div className="row" key={w.name}>
                    <span
                      className="avatar"
                      style={{
                        background: w.mood === 'unwell' ? 'var(--warning-soft)' : w.mood ? 'var(--primary-soft)' : 'var(--bg)',
                        color: w.mood === 'unwell' ? 'var(--warning)' : w.mood ? 'var(--primary)' : 'var(--muted)',
                      }}
                    >
                      {w.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="grow">
                      <b>{w.name}</b>
                      <div className="muted small">
                        {w.mood ? `Feeling ${w.label?.toLowerCase()} · checked in ${fmtTime(w.at!)}` : "Hasn't checked in yet today"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid two">
            <div>
              <h2>Medicines</h2>
              <div className="card divided">
                {dash.medicines.total === 0 && (
                  <span className="muted">
                    No medicine reminders yet. <Link href="/people">Add some →</Link>
                  </span>
                )}
                {dash.medicines.items.map((m) => (
                  <div className="row" key={m.id}>
                    <div className="grow">
                      <b>
                        {m.name}
                        {m.dose ? ` · ${m.dose}` : ''}
                      </b>
                      <div className="muted small">
                        {m.elderly} · {m.time}
                      </div>
                    </div>
                    <span className={`pill ${m.state === 'taken' ? 'good' : m.state === 'missed' ? 'bad' : m.state === 'due' ? 'warn' : 'quiet'}`}>
                      {m.state === 'taken' && m.taken_at
                        ? `Taken ${fmtTime(m.taken_at)}`
                        : m.state === 'missed'
                          ? 'Not taken'
                          : m.state === 'due'
                            ? 'Due now'
                            : 'Later'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2>Today&apos;s chores</h2>
              <div className="card divided">
                {dash.today.chores.length === 0 ? (
                  <span className="muted">No chores logged yet today.</span>
                ) : (
                  <>
                    <b>
                      {doneChores} of {dash.today.chores.length} done
                    </b>
                    {dash.today.chores.map((c, i) => (
                      <div className="row" key={i}>
                        <span style={{ color: c.is_done ? 'var(--success)' : 'var(--muted)' }}>{c.is_done ? '✓' : '○'}</span>
                        <span className="grow" style={{ color: c.is_done ? undefined : 'var(--muted)' }}>
                          {c.description}
                        </span>
                        {c.done_at && <span className="muted small">{fmtTime(c.done_at)}</span>}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          <h2>Recent shifts</h2>
          <div className="card">
            <ShiftTable shifts={dash.recent_shifts} />
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2>Past alerts</h2>
          <div className="card divided">
            {past.map((a) => (
              <div className="row" key={a.id}>
                <div className="grow">
                  <b>{a.label}</b>
                  <div className="muted small">{a.message}</div>
                </div>
                <span className="muted small">{a.status === 'confirmed' ? 'Confirmed' : 'Dismissed'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
