'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Armchair,
  AudioWaveform,
  BadgeCheck,
  BellRing,
  Check,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock,
  ClockAlert,
  Frown,
  HeartHandshake,
  HeartPulse,
  MapPin,
  Meh,
  MessageSquareText,
  Pill as PillIcon,
  Siren,
  Smile,
  UserRoundPlus,
} from 'lucide-react';
import { useState } from 'react';
import { ProofPhoto } from '@/components/ProofPhoto';
import { ShiftMap } from '@/components/ShiftMap';
import { Avatar, Empty, ErrorNote, Loading, PageHead, Pill, Ring, Row, Section, ShiftTable, Stepper, TONE_ICON, ToneCard } from '@/components/ui';
import { resolveAlert } from '@/lib/api';
import { useAuth, useToken } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { firstName, fmtDuration, fmtTime, PillTone, timeAgo, timeOfDay, today } from '@/lib/format';
import { AlertItem, Dashboard, Mood, Profile } from '@/lib/types';

const SEVERITY: Record<number, { text: string; tone: PillTone }> = {
  3: { text: 'Emergency', tone: 'error' },
  2: { text: 'High', tone: 'ink' },
  1: { text: 'Check', tone: 'muted' },
};

// History line: when it happened, then who closed it and when, e.g. "10:42 · Handled by Cara at 10:45".
function alertOutcome(a: AlertItem): string {
  const sos = a.kind === 'sos';
  const what = a.status === 'confirmed' ? (sos ? 'Handled' : 'Confirmed') : sos ? 'False alarm' : 'Dismissed';
  const when = `${fmtTime(a.created_at)} (${timeAgo(a.created_at)})`;
  if (!a.handled_by) return `${when} · ${what}`;
  return `${when} · ${what} by ${firstName(a.handled_by)}${a.handled_at ? ` at ${fmtTime(a.handled_at)}` : ''}`;
}

const MOOD_ICON: Record<Mood, LucideIcon> = { good: Smile, okay: Meh, unwell: Frown };

const MED_STATE: Record<Dashboard['medicines']['items'][number]['state'], { Icon: LucideIcon; color: string; label: string; tone: PillTone }> = {
  taken: { Icon: CircleCheck, color: 'var(--success)', label: 'Taken', tone: 'success' },
  due: { Icon: ClockAlert, color: 'var(--ink)', label: 'Due now', tone: 'ink' },
  missed: { Icon: CircleAlert, color: 'var(--error)', label: 'Not taken', tone: 'error' },
  later: { Icon: Clock, color: 'var(--ink-muted)', label: 'Later', tone: 'muted' },
};

// Attention = warning tint with ink text and an amber (or red, for SOS) icon. The evidence comes before the decision.
function AlertCard({ alert, onDone }: { alert: AlertItem; onDone: () => void }) {
  const token = useToken();
  const [busy, setBusy] = useState<'confirmed' | 'dismissed' | null>(null);
  const [error, setError] = useState('');
  const sos = alert.kind === 'sos';
  const sev = SEVERITY[alert.severity] ?? SEVERITY[1];
  const pos = alert.position;
  const yes = sos ? 'Handled' : alert.kind === 'unwell' ? 'Noted' : 'Confirm';
  const no = sos ? 'False alarm' : 'Dismiss';

  async function act(status: 'confirmed' | 'dismissed') {
    setBusy(status);
    setError('');
    try {
      await resolveAlert(token, alert.id, status);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the alert. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card warning alert" aria-labelledby={`alert-${alert.id}`} role={sos ? 'alert' : undefined}>
      <div className="alert-head">
        {sos ? <Siren className="icon" style={{ color: 'var(--error)' }} aria-hidden /> : <BellRing className="icon" style={{ color: 'var(--warning)' }} aria-hidden />}
        <Pill tone={sev.tone}>{sev.text}</Pill>
        <time className="caption" dateTime={alert.created_at} title={new Date(alert.created_at).toLocaleString()}>
          {fmtTime(alert.created_at)} · {timeAgo(alert.created_at)}
        </time>
      </div>
      <h3 id={`alert-${alert.id}`}>{alert.label}</h3>
      <p className="body">
        {alert.message}
        {sos && ' Call them or message them now. Their chat is under Chats.'}
      </p>
      {alert.patient && <p className="caption-ink">About {alert.patient}</p>}

      {(pos || alert.confidence !== null || alert.shift_id) && (
        <div className="evidence">
          <div className="chips">
            {pos && (
              <span className="chip-static">
                <MapPin className="icon" aria-hidden />
                {pos.accuracy !== null ? `Accurate to ±${Math.round(pos.accuracy)} m` : 'Accuracy not reported'}
              </span>
            )}
            {alert.confidence !== null && (
              <span className="chip-static">
                <AudioWaveform className="icon" aria-hidden />
                {Math.round(alert.confidence * 100)}% of the speech sounded angry
              </span>
            )}
            {alert.shift_id && (
              <Link className="chip-static link" href={`/shifts/day?id=${alert.shift_id}`}>
                <Clock className="icon" aria-hidden />
                Open the shift timeline
              </Link>
            )}
          </div>
          {pos && (
            <ShiftMap
              centre={null}
              point={pos}
              className="map small"
              label={`Map of where the phone was when this alert was raised, accurate to ${pos.accuracy ? Math.round(pos.accuracy) : 'an unknown number of'} metres`}
            />
          )}
        </div>
      )}

      <ErrorNote message={error} />
      <div className="actions">
        <button type="button" className={`btn ${sos ? 'danger' : 'secondary'}`} onClick={() => act('confirmed')} disabled={busy !== null} aria-busy={busy === 'confirmed'}>
          {busy === 'confirmed' ? 'Saving…' : yes}
        </button>
        <button type="button" className="btn soft" onClick={() => act('dismissed')} disabled={busy !== null} aria-busy={busy === 'dismissed'}>
          {busy === 'dismissed' ? 'Saving…' : no}
        </button>
      </div>
    </article>
  );
}

// The live tracker, the one ink hero on this page: who is with your loved one, for how long, where in the day they
// are, and the way to reach them.
function TodayCard({ dash }: { dash: Dashboard }) {
  const { status, shifts } = dash.today;
  const s = shifts[0];
  const live = status === 'on_shift';
  const paused = status === 'paused' || status === 'away';
  const label = { on_shift: 'On shift', paused: 'On a break', away: 'Away', waiting: 'Not arrived', completed: 'Finished', none: 'No shift yet' }[status];
  const step = status === 'none' || status === 'waiting' ? 0 : status === 'completed' ? 2 : 1;
  const since = s
    ? status === 'completed'
      ? `${fmtTime(s.start)} – ${s.end ? fmtTime(s.end) : ''}`
      : paused && s.left
        ? `out since ${fmtTime(s.left)}`
        : s.arrived
          ? `since ${fmtTime(s.arrived)}`
          : ''
    : '';
  const carer = s ? (dash.caretakers.find((c) => c.name === s.caretaker) ?? dash.caretakers[0]) : dash.caretakers[0];
  const note =
    status === 'paused' && s
      ? 'The same shift continues when they come back.'
      : status === 'away' && s
        ? 'If they return today it counts as the same shift.'
        : status === 'waiting'
          ? 'Their shift is open; they have not arrived yet.'
          : null;

  return (
    <section className="card ink hero today" aria-labelledby="today-title">
      <div className="today-top">
        <Avatar name={s ? s.caretaker : (carer?.name ?? '?')} size={56} solid />
        <div className="grow">
          <h2 id="today-title" className="on-ink-heading">
            {s ? s.caretaker : 'Today'}
          </h2>
          <p className="on-ink-caption">{s ? `with ${s.elderly}${since ? ` · ${since}` : ''}` : 'Nobody has arrived yet today'}</p>
        </div>
        <Pill tone={live ? 'success' : paused ? 'ink' : 'muted'}>{label}</Pill>
      </div>

      {s && (
        <div className="today-figure">
          <div className="on-ink-display">{fmtDuration(s.minutes)}</div>
          <div className="on-ink-caption">{['active today', s.breaks ? `${s.breaks} break${s.breaks === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}</div>
        </div>
      )}
      {note && <p className="on-ink-caption" style={{ marginTop: 'var(--s)' }}>{note}</p>}

      <div style={{ marginTop: 'var(--l)' }}>
        <Stepper steps={['Arrive', 'On shift', 'Done']} current={step} onInk />
      </div>

      <div className="today-actions">
        {s && (
          <Link href={`/shifts/day?id=${s.id}`} className="accent-link">
            <Clock className="icon" aria-hidden />
            Map and timeline
            <ChevronRight className="icon" aria-hidden />
          </Link>
        )}
        {carer && (
          <Link href={`/chats?with=${encodeURIComponent(carer.email)}`} className="btn primary">
            <MessageSquareText className="icon" aria-hidden />
            Message {firstName(carer.name)}
          </Link>
        )}
      </div>
    </section>
  );
}

// Shown before the family has linked both a caretaker and an elderly person.
function Onboarding({ profile }: { profile: Profile }) {
  const step = (title: string, Icon: LucideIcon, list: Profile['caretakers']) => {
    const active = list.some((m) => m.status === 'active');
    const invited = list.some((m) => m.status === 'pending');
    return { title, Icon, state: active ? 'Linked' : invited ? 'Invited' : 'Not yet', done: active, invited };
  };
  const steps = [step('Caretaker', HeartHandshake, profile.caretakers), step('Elder', Armchair, profile.elderly)];
  return (
    <section className="card primary-tint onboarding">
      <h2 className="display">Set up your circle</h2>
      <p className="caption-ink">Add two people, a caretaker and the person they care for, and this page fills with their care.</p>
      <div className="setup">
        {steps.map((s) => (
          <div key={s.title} className="setup-step">
            <span className={`setup-icon${s.done ? ' done' : ''}`}>{s.done ? <Check className="icon" aria-hidden /> : <s.Icon className="icon" aria-hidden />}</span>
            <b>{s.title}</b>
            <Pill tone={s.done ? 'success' : s.invited ? 'secondary' : 'muted'}>{s.state}</Pill>
          </div>
        ))}
      </div>
      <Link href="/people" className="btn primary">
        <UserRoundPlus className="icon" aria-hidden />
        Add people
      </Link>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <div className="heading">{value}</div>
      <div className="caption">{label}</div>
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
  const chores = dash.today.chores;
  const doneChores = chores.filter((c) => c.is_done).length;
  const meds = dash.medicines;
  const mood = dash.wellbeing[0];
  const tone = dash.tones.dominant ? dash.tones.items[0] : null;
  const MoodIcon = mood?.mood ? MOOD_ICON[mood.mood] : Meh;
  const ToneIcon = tone ? TONE_ICON[tone.tone] : AudioWaveform;

  return (
    <>
      <PageHead kicker={today()} title={`${timeOfDay()}, ${profile ? firstName(profile.name) : ''}`} right={dash.demo ? <Pill tone="secondary">Sample data</Pill> : undefined} />

      {open.length > 0 && (
        <section aria-label={`Alerts, ${open.length} open`} className="stack-s">
          {open.map((a) => (
            <AlertCard key={a.id} alert={a} onDone={reload} />
          ))}
        </section>
      )}

      {!dash.matched && profile ? (
        <Onboarding profile={profile} />
      ) : (
        <>
          <div className="overview-top">
            <TodayCard dash={dash} />

            {/* Tiles: the wide one swaps sides and the tints alternate, so it never reads as a grid of equals. */}
            <div className="bento">
              <a href="#medicines" className="tile wide primary-tint" aria-label={meds.total ? `Medicines: ${meds.taken} of ${meds.total} taken` : 'Medicines: none set'}>
                <Ring value={meds.taken} total={meds.total}>
                  <PillIcon className="icon" aria-hidden />
                </Ring>
                <span>
                  <span className="display">{meds.total ? `${meds.taken}/${meds.total}` : '–'}</span>
                  <span className="caption-ink">Medicines today</span>
                </span>
              </a>
              <a href="#mood" className="tile secondary-tint" aria-label={mood?.mood ? `${mood.name} feels ${mood.label}` : 'Mood: no check-in yet'}>
                <MoodIcon className="icon-l" style={{ color: mood?.mood === 'unwell' ? 'var(--error)' : 'var(--ink)' }} aria-hidden />
                <span>
                  <span className="strong">{mood?.mood ? mood.label : 'No check-in'}</span>
                  <span className="caption">Mood</span>
                </span>
              </a>
              <Link href="/tone" className="tile secondary-tint" aria-label={tone ? `Voice tone: mostly ${tone.label}, ${tone.percent}%` : 'Voice tone: nothing heard yet'}>
                <ToneIcon className="icon-l" aria-hidden />
                <span>
                  <span className="strong">{tone ? tone.label : 'Quiet'}</span>
                  <span className="caption">Tone · week</span>
                </span>
              </Link>
              <a href="#tasks" className="tile wide primary-tint" aria-label={`Tasks today: ${doneChores} of ${chores.length} done`}>
                <Ring value={doneChores} total={chores.length}>
                  <ClipboardCheck className="icon" aria-hidden />
                </Ring>
                <span>
                  <span className="display">{chores.length ? `${doneChores}/${chores.length}` : '0'}</span>
                  <span className="caption-ink">Tasks today</span>
                </span>
              </a>
            </div>
          </div>

          <Section title="This week" />
          <div className="card week">
            <Stat value={fmtDuration(dash.stats.avg_visit_minutes)} label="Average active time a day" />
            <Stat value={String(dash.stats.visits_7d)} label="Days worked" />
            <Stat value={dash.stats.chore_rate_7d === null ? '–' : `${dash.stats.chore_rate_7d}%`} label="Tasks done" />
          </div>

          <div className="grid two">
            <div id="medicines">
              <Section title="Medicines" action={<Link href="/people#medicines" className="section-link">Manage</Link>} />
              <div className="card list">
                {meds.total === 0 ? (
                  <Empty icon={PillIcon} title="No reminders yet">
                    Add reminders under <Link href="/people#medicines">People</Link>. Each shows here with whether it was taken today.
                  </Empty>
                ) : (
                  meds.items.map((m) => {
                    const v = MED_STATE[m.state];
                    return (
                      <Row
                        key={m.id}
                        leading={<v.Icon className="icon-m" style={{ color: v.color }} aria-hidden />}
                        title={m.dose ? `${m.name} · ${m.dose}` : m.name}
                        subtitle={`${m.elderly} · ${m.time}`}
                        trailing={<Pill tone={v.tone}>{m.state === 'taken' && m.taken_at ? `Taken ${fmtTime(m.taken_at)}` : v.label}</Pill>}
                      />
                    );
                  })
                )}
              </div>
            </div>

            <div id="tasks">
              <Section title="Tasks today" action={<Link href="/tasks" className="section-link">History and photos</Link>} />
              <div className="card list">
                {chores.length === 0 ? (
                  <Empty icon={ClipboardCheck} title="Nothing ticked off yet today">
                    Tasks appear here as the caretaker completes them, each with a photo as proof.
                  </Empty>
                ) : (
                  chores.map((c) => (
                    <Row
                      key={c.id}
                      leading={
                        c.is_done ? (
                          <CircleCheck className="icon-m" style={{ color: 'var(--success)' }} aria-label="Done" />
                        ) : (
                          <Circle className="icon-m" style={{ color: 'var(--ink-muted)' }} aria-label="Not done" />
                        )
                      }
                      title={c.description}
                      subtitle={[c.done_at ? `Done ${fmtTime(c.done_at)}` : 'Not done yet', c.assigned_by_me ? 'set by you' : c.assigned_by ? `set by ${c.assigned_by}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                      trailing={c.completion_id !== null ? <ProofPhoto completionId={c.completion_id} caption={`${c.description} · ${c.caretaker}`} size={48} /> : undefined}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid two">
            <div>
              <Section title="Voice tone" action={<Link href="/tone" className="section-link">Live tone</Link>} />
              <div className="card">
                <ToneCard tones={dash.tones} />
              </div>
            </div>
            <div id="mood">
              <Section title="How they feel" />
              <div className="card list">
                {dash.wellbeing.length === 0 ? (
                  <Empty icon={HeartPulse} title="No check-ins yet">
                    Your loved one taps how they feel on their phone each day. Their answer shows here.
                  </Empty>
                ) : (
                  dash.wellbeing.map((w) => {
                    const Icon = w.mood ? MOOD_ICON[w.mood] : Meh;
                    return (
                      <Row
                        key={w.name}
                        leading={<Icon className="icon-l" style={{ color: w.mood === 'unwell' ? 'var(--error)' : w.mood ? 'var(--ink)' : 'var(--ink-muted)' }} aria-hidden />}
                        title={w.name}
                        subtitle={w.mood ? `Feeling ${w.label?.toLowerCase()} · checked in ${fmtTime(w.at!)}` : "Hasn't checked in yet today"}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <Section title="Recent shifts" action={<Link href="/shifts" className="section-link">See all</Link>} />
          <div className="card flush">
            <ShiftTable shifts={dash.recent_shifts} />
          </div>
        </>
      )}

      {past.length > 0 && (
        <details className="past">
          <summary>
            <BadgeCheck className="icon" aria-hidden />
            Past alerts · {past.length}
            <ChevronRight className="icon chev" aria-hidden />
          </summary>
          <div className="card list">
            {past.map((a) => (
              <Row
                key={a.id}
                leading={a.status === 'confirmed' ? <BadgeCheck className="icon" style={{ color: 'var(--ink-muted)' }} aria-hidden /> : <CircleX className="icon" style={{ color: 'var(--ink-muted)' }} aria-hidden />}
                title={a.label}
                subtitle={`${alertOutcome(a)} · ${a.message}`}
              />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
