'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Circle, CircleCheck, ClipboardCheck, Coffee, LogIn, LogOut, MapPin, MapPinCheck, Play } from 'lucide-react';
import { ReactNode, Suspense } from 'react';
import { ShiftMap } from '@/components/ShiftMap';
import { ToneChart } from '@/components/ToneChart';
import { Avatar, Empty, ErrorNote, Loading, Pill, Row, Section, ToneCard } from '@/components/ui';
import { getShift } from '@/lib/api';
import { usePolling } from '@/lib/auth';
import { fmtDuration, fmtShiftDayLong, fmtTime, STATUS_LABEL } from '@/lib/format';
import { TimelineEvent } from '@/lib/types';

// Timeline marks: cobalt for the visit itself, amber for a break (a status), green for a task done, muted for leaving.
const EVENT: Record<TimelineEvent['kind'], { text: string; mark: '' | 'out' | 'end'; Icon: LucideIcon }> = {
  started: { text: 'Shift opened', mark: '', Icon: Play },
  arrived: { text: 'Checked in (arrived)', mark: '', Icon: LogIn },
  stepped_out: { text: 'Stepped out (break starts)', mark: 'out', Icon: Coffee },
  returned: { text: 'Came back', mark: '', Icon: MapPinCheck },
  left: { text: 'Checked out (left)', mark: 'end', Icon: LogOut },
};

type Entry = { at: string; key: string; mark: string; Icon: LucideIcon; text: ReactNode };

// One day's shift: /shifts/day?id=<shift id> (a query string, so the dashboard can be served as static files).
export default function ShiftDetailPage() {
  return (
    <Suspense fallback={<Loading label="Loading the shift…" />}>
      <ShiftFromQuery />
    </Suspense>
  );
}

function ShiftFromQuery() {
  const id = Number(useSearchParams().get('id'));
  if (!id) return <Empty icon={MapPin} title="This shift could not be found" />;
  return <ShiftDetail key={id} id={id} />;
}

function HeroStat({ Icon, value, label }: { Icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="hero-stat">
      <Icon className="icon" aria-hidden />
      <div>
        <div className="on-ink-strong">{value}</div>
        <div className="on-ink-caption">{label}</div>
      </div>
    </div>
  );
}

function ShiftDetail({ id }: { id: number }) {
  const { data: shift, error } = usePolling((t) => getShift(t, id), 15000);

  if (!shift) return error ? <ErrorNote message={`Couldn't load this shift. ${error}`} /> : <Loading label="Loading the shift…" />;
  const st = STATUS_LABEL[shift.status];
  const stillOut = !!shift.left && !shift.end;

  // One timeline: check-in, breaks, each task done, check-out.
  const entries: Entry[] = [
    ...shift.timeline.map((e, i) => {
      const ev = EVENT[e.kind];
      return {
        at: e.at,
        key: `t${i}`,
        mark: ev.mark,
        Icon: ev.Icon,
        text: (
          <>
            {ev.text}
            {e.kind === 'returned' && e.break_minutes !== undefined && ` after ${fmtDuration(e.break_minutes)}`}
            {e.note && <span className="caption"> · {e.note}</span>}
          </>
        ),
      };
    }),
    ...shift.chores
      .filter((c) => c.is_done && c.done_at)
      .map((c, i) => ({ at: c.done_at!, key: `c${i}`, mark: 'task', Icon: CircleCheck, text: <>Task done: {c.description}</> })),
  ].sort((x, y) => x.at.localeCompare(y.at));

  return (
    <>
      <Link href="/shifts" className="back-link">
        <ArrowLeft className="icon" aria-hidden /> All shifts
      </Link>
      <header className="page-head">
        <div>
          <p className="caption">Shift</p>
          <h1>{fmtShiftDayLong(shift.date)}</h1>
        </div>
      </header>

      {/* the one ink hero: who, how long, and the day's numbers */}
      <section className="card ink hero" aria-label={`${shift.caretaker} with ${shift.elderly}`}>
        <div className="today-top">
          <span className="pair">
            <Avatar name={shift.caretaker} size={48} solid />
            <Avatar name={shift.elderly} size={48} />
          </span>
          <div className="grow">
            <div className="on-ink-strong">{shift.caretaker}</div>
            <div className="on-ink-caption">with {shift.elderly}</div>
          </div>
          <Pill tone={st.tone}>{st.text}</Pill>
        </div>
        <div className="today-figure">
          <div className="on-ink-display">{fmtDuration(shift.minutes)}</div>
          <div className="on-ink-caption">
            {['active', shift.arrived ? `${fmtTime(shift.arrived)} – ${shift.end ? fmtTime(shift.end) : stillOut ? 'out' : 'now'}` : 'not arrived'].join(' · ')}
          </div>
        </div>
        <div className="hero-stats">
          <HeroStat Icon={Coffee} value={fmtDuration(shift.break_minutes)} label={`${shift.breaks} break${shift.breaks === 1 ? '' : 's'}`} />
          <HeroStat Icon={shift.source === 'auto' ? MapPinCheck : Play} value={shift.source === 'auto' ? 'By itself' : 'By hand'} label="How it started" />
          {shift.chores_total > 0 && <HeroStat Icon={ClipboardCheck} value={`${shift.chores_done}/${shift.chores_total}`} label="Tasks done" />}
        </div>
      </section>

      <Section title="Where the visit happened" />
      <div className="card">
        {shift.map && (shift.map.centre || shift.map.trail.length) ? (
          <>
            <ShiftMap
              centre={shift.map.centre}
              radius={shift.map.radius_m}
              trail={shift.map.trail}
              label={`Map of the visit: ${shift.map.radius_m} metre area around ${shift.elderly}'s phone and ${shift.map.trail.length} caretaker positions`}
            />
            <div className="legend">
              <span>
                <i style={{ background: 'var(--primary)' }} />
                {shift.map.radius_m} m around {shift.elderly}&apos;s phone
              </span>
              <span>
                <i style={{ background: 'var(--ink)' }} />
                {shift.caretaker}&apos;s path ({shift.map.trail.length} positions)
              </span>
            </div>
          </>
        ) : (
          <Empty icon={MapPin} title="No positions recorded for this shift">
            Positions are kept only while a shift is open. Shifts from before this feature, or when GPS was off, have no map.
          </Empty>
        )}
      </div>

      <div className="grid two">
        <div>
          <Section title="Timeline" />
          <div className="card">
            {entries.length === 0 ? (
              <Empty icon={ClipboardCheck} title="Nothing recorded yet">
                Check-in, each task and check-out appear here in order as the day goes on.
              </Empty>
            ) : (
              <ol className="timeline">
                {entries.map((e) => (
                  <li key={e.key}>
                    <span className={`mark ${e.mark}`}>
                      <e.Icon className="icon" aria-hidden />
                    </span>
                    <span className="when">{fmtTime(e.at)}</span>
                    <span className="what">{e.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div>
          <Section title="Time with them, and breaks" />
          <div className="card list">
            {shift.segments.length === 0 && shift.breaks_list.length === 0 && (
              <Empty icon={MapPinCheck} title="No verified time yet">
                Time counts only while the caretaker is within range of your loved one&apos;s phone.
              </Empty>
            )}
            {shift.segments.map((s, i) => (
              <Row
                key={i}
                leading={<MapPinCheck className="icon" style={{ color: 'var(--primary)' }} aria-hidden />}
                title={`${fmtTime(s.start)} – ${s.end ? fmtTime(s.end) : 'now'}`}
                subtitle="With your loved one"
                trailing={<span className="strong">{fmtDuration(s.minutes)}</span>}
              />
            ))}
            {shift.breaks_list.map((b, i) => (
              <Row
                key={`b${i}`}
                leading={<Coffee className="icon" style={{ color: 'var(--warning)' }} aria-hidden />}
                title={`${fmtTime(b.start)} – ${b.end ? fmtTime(b.end) : 'now'}`}
                subtitle="Break (not counted)"
                trailing={<span>{fmtDuration(b.minutes)}</span>}
              />
            ))}
          </div>
        </div>
      </div>

      <Section title="Tasks" />
      <div className="card list">
        {shift.chores.length === 0 && (
          <Empty icon={ClipboardCheck} title="No tasks on the list for this day">
            Tasks you or the caretaker add appear here, with the time each was done.
          </Empty>
        )}
        {shift.chores.map((c, i) => (
          <Row
            key={i}
            leading={
              c.is_done ? (
                <CircleCheck className="icon-m" style={{ color: 'var(--success)' }} aria-label="Done" />
              ) : (
                <Circle className="icon-m" style={{ color: 'var(--ink-muted)' }} aria-label="Not done" />
              )
            }
            title={c.description}
            subtitle={c.done_at ? `Done ${fmtTime(c.done_at)}` : 'Not done'}
          />
        ))}
      </div>

      {shift.tones && (
        <div className="grid two">
          <div>
            <Section title="Voice tone through the visit" />
            <div className="card">
              {shift.tone_timeline?.length ? (
                <ToneChart points={shift.tone_timeline} bucketMinutes={15} />
              ) : (
                <Empty icon={ClipboardCheck} title="No speech heard on this shift" />
              )}
            </div>
          </div>
          <div>
            <Section title="The visit's mix" />
            <div className="card">
              <ToneCard tones={shift.tones} period="this visit" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
