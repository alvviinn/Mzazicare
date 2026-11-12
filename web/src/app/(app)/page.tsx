'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProofPhoto } from '@/components/ProofPhoto';
import { Bell, CheckCircle2, ChevronRight, Circle, ClipboardList, HeartPulse, Pill as PillIcon } from 'lucide-react';
import { ShiftMap } from '@/components/ShiftMap';
import { Empty, ErrorNote, Loading, PageHead, Pill, ShiftTable, Tile, ToneBars } from '@/components/ui';
import { resolveAlert } from '@/lib/api';
import { useAuth, useToken } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { fmtDuration, fmtTime, timeAgo, timeOfDay } from '@/lib/format';
import { AlertItem, Dashboard } from '@/lib/types';

const SEVERITY: Record<number, { text: string; tone: 'bad' | 'warn' | 'quiet' }> = {
  3: { text: 'Emergency', tone: 'bad' },
  2: { text: 'High', tone: 'warn' },
  1: { text: 'Check', tone: 'quiet' },
};

function AlertCard({ alert, onDone }: { alert: AlertItem; onDone: () => void }) {
  const token = useToken();
  const [busy, setBusy] = useState<'confirmed' | 'dismissed' | null>(null);
  const [error, setError] = useState('');
  const sos = alert.kind === 'sos';
  const sev = SEVERITY[alert.severity] ?? SEVERITY[1];
  const pos = alert.position;

  async function act(status: 'confirmed' | 'dismissed') {
    setBusy(status);
    setError('');
    try {
      await resolveAlert(token, alert.id, status);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the alert. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className={`alert sev-${alert.severity}`} aria-labelledby={`alert-${alert.id}`}>
      <div className="alert-head">
        <Pill tone={sev.tone}>{sev.text}</Pill>
        <h3 id={`alert-${alert.id}`}>{alert.label}</h3>
        <time className="muted small" dateTime={alert.created_at} title={new Date(alert.created_at).toLocaleString()}>
          {fmtTime(alert.created_at)} · {timeAgo(alert.created_at)}
        </time>
      </div>
      {alert.patient && <p className="alert-meta">About {alert.patient}</p>}
      <p className="alert-body">
        {alert.message}
        {sos && ' Call them or message them now. Their chat is under Chats.'}
      </p>

      {(pos || alert.confidence !== null) && (
        <div className="evidence">
          <dl>
            {pos && (
              <>
                <dt>Position</dt>
                <dd>
                  {pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)}
                </dd>
                <dt>GPS accuracy</dt>
                <dd>{pos.accuracy !== null ? `±${Math.round(pos.accuracy)} m` : 'Not reported'}</dd>
              </>
            )}
            {alert.confidence !== null && (
              <>
                <dt>Model confidence</dt>
                <dd>
                  {Math.round(alert.confidence * 100)}% of the speech sounded angry
                  <div className="confidence" aria-hidden>
                    <div style={{ width: `${Math.round(alert.confidence * 100)}%` }} />
                  </div>
                </dd>
              </>
            )}
            {alert.shift_id && (
              <>
                <dt>Shift</dt>
                <dd>
                  <Link href={`/shifts/day?id=${alert.shift_id}`}>Open the shift timeline</Link>
                </dd>
              </>
            )}
          </dl>
          {pos && (
            <ShiftMap
              centre={null}
              point={pos}
              className="map"
              label={`Map of where the phone was when this alert was raised, accurate to ${pos.accuracy ? Math.round(pos.accuracy) : 'an unknown number of'} metres`}
            />
          )}
        </div>
      )}

      <div className="row wrap">
        <button onClick={() => act('confirmed')} disabled={busy !== null} aria-busy={busy === 'confirmed'}>
          {busy === 'confirmed' ? 'Saving…' : sos ? 'Handled' : alert.kind === 'unwell' ? 'Noted' : 'Confirm'}
        </button>
        <button className="secondary" onClick={() => act('dismissed')} disabled={busy !== null} aria-busy={busy === 'dismissed'}>
          {busy === 'dismissed' ? 'Saving…' : sos ? 'False alarm' : 'Dismiss'}
        </button>
        <ErrorNote message={error} />
      </div>
    </article>
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
        {s && (
          <Link href={`/shifts/day?id=${s.id}`}>
            See today&apos;s map and timeline <ChevronRight className="icon" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { profile } = useAuth();
  const { dash, error, reload } = useDashboard();

  if (!dash) return error ? <ErrorNote message={`Couldn't load your care overview. ${error}`} /> : <Loading label="Loading your care overview…" />;
  // most severe first, then newest
  const open = dash.alerts
    .filter((a) => a.status === 'open')
    .sort((x, y) => y.severity - x.severity || y.created_at.localeCompare(x.created_at));
  const past = dash.alerts.filter((a) => a.status !== 'open');
  const doneChores = dash.today.chores.filter((c) => c.is_done).length;

  return (
    <>
      <PageHead title={`${timeOfDay()}, ${profile?.name.split(' ')[0] ?? ''}`} sub="Today's care at a glance." />

      {dash.demo && (
        <div className="banner" style={{ marginTop: 'var(--space-4)' }}>
          Sample data. Real visits, chores and tones will appear once your caretaker starts shifts in the app.
        </div>
      )}

      {open.length > 0 && (
        <>
          <h2>
            <Bell className="icon" aria-hidden /> Alerts{' '}
            <span className="badge" style={{ marginLeft: 0 }} aria-label={`${open.length} open`}>
              {open.length}
            </span>
          </h2>
          {open.map((a) => (
            <AlertCard key={a.id} alert={a} onDone={reload} />
          ))}
        </>
      )}

      {!dash.matched ? (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <h3>Set up your care circle</h3>
          <p className="muted">
            Add a caretaker and the person they care for, and this page fills with their care updates.{' '}
            <Link href="/people">Add people</Link>
          </p>
        </div>
      ) : (
        <>
          <h2>Today</h2>
          <TodayCard dash={dash} />

          <div className="grid tiles" style={{ marginTop: 'var(--space-3)' }}>
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
                  <Link href="/tone">Open the live tone chart</Link>
                </p>
              </div>
            </div>
            <div>
              <h2>How they are today</h2>
              <div className="card divided">
                {dash.wellbeing.length === 0 && (
                  <Empty icon={HeartPulse} title="No check-ins yet">
                    The elderly person taps how they feel on their phone each day. Their answer shows here.
                  </Empty>
                )}
                {dash.wellbeing.map((w) => (
                  <div className="row" key={w.name}>
                    <span
                      className="avatar"
                      style={{
                        background: w.mood === 'unwell' ? 'var(--color-warning-soft)' : w.mood ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                        color: w.mood === 'unwell' ? 'var(--color-warning)' : w.mood ? 'var(--color-primary)' : 'var(--color-text-muted)',
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
                  <Empty icon={PillIcon} title="No medicine reminders yet">
                    Add reminders under <Link href="/people">People</Link>. Each shows here with whether it was taken today.
                  </Empty>
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
                  <Empty icon={ClipboardList} title="Nothing ticked off yet today">
                    Tasks appear here as the caretaker completes them, each with a photo as proof.
                  </Empty>
                ) : (
                  <>
                    <b>
                      {doneChores} of {dash.today.chores.length} done
                    </b>
                    {dash.today.chores.map((c, i) => (
                      <div className="row" key={i}>
                        {c.is_done ? (
                          <CheckCircle2 className="icon" style={{ color: 'var(--color-success)' }} aria-label="Done" />
                        ) : (
                          <Circle className="icon" style={{ color: 'var(--color-border-strong)' }} aria-label="Not done" />
                        )}
                        <span className="grow" style={{ color: c.is_done ? undefined : 'var(--color-text-muted)' }}>
                          {c.description}
                          {c.assigned_by && (
                            <span className="muted small">{c.assigned_by_me ? ' · set by you' : ` · set by ${c.assigned_by}`}</span>
                          )}
                        </span>
                        {c.done_at && <span className="muted small">{fmtTime(c.done_at)}</span>}
                        {c.completion_id !== null && (
                          <ProofPhoto completionId={c.completion_id} caption={`${c.description} · ${c.caretaker}`} size={40} />
                        )}
                      </div>
                    ))}
                  </>
                )}
                <Link href="/tasks">Task history and photos</Link>
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
