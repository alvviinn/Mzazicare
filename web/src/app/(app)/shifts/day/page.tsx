'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, CheckCircle2, Circle, ClipboardList, Coffee, LogIn, LogOut, MapPin, MapPinCheck, PlayCircle } from 'lucide-react';
import { ReactNode, Suspense } from 'react';
import { ShiftMap } from '@/components/ShiftMap';
import { Empty, Loading, PageHead, Pill, Tile, ToneBars } from '@/components/ui';
import { ToneChart } from '@/components/ToneChart';
import { getShift } from '@/lib/api';
import { usePolling } from '@/lib/auth';
import { fmtDuration, fmtShiftDayLong, fmtTime, STATUS_LABEL } from '@/lib/format';
import { TimelineEvent } from '@/lib/types';

const EVENT: Record<TimelineEvent['kind'], { text: string; mark: '' | 'out' | 'end'; Icon: LucideIcon }> = {
  started: { text: 'Shift opened', mark: '', Icon: PlayCircle },
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
  if (!id) return <p className="muted">This shift could not be found.</p>;
  return <ShiftDetail key={id} id={id} />;
}

function ShiftDetail({ id }: { id: number }) {
  const { data: shift, error } = usePolling((t) => getShift(t, id), 15000);

  if (!shift) return error ? <p className="error" role="alert">Couldn&apos;t load this shift. {error}</p> : <Loading label="Loading the shift…" />;
  const st = STATUS_LABEL[shift.status];

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
            {e.note && <span className="muted small"> · {e.note}</span>}
          </>
        ),
      };
    }),
    ...shift.chores
      .filter((c) => c.is_done && c.done_at)
      .map((c, i) => ({ at: c.done_at!, key: `c${i}`, mark: 'task', Icon: CheckCircle2, text: <>Task done: {c.description}</> })),
  ].sort((x, y) => x.at.localeCompare(y.at));

  return (
    <>
      <p style={{ margin: 0 }}>
        <Link href="/shifts">
          <ArrowLeft className="icon" aria-hidden /> All shifts
        </Link>
      </p>
      <PageHead
        title={fmtShiftDayLong(shift.date)}
        sub={`${shift.caretaker} with ${shift.elderly}`}
        right={<Pill tone={st.tone}>{st.text}</Pill>}
      />

      <div className="grid tiles" style={{ marginTop: 'var(--space-4)' }}>
        <Tile value={fmtDuration(shift.minutes)} label="Active time" />
        <Tile value={shift.breaks ? `${shift.breaks} (${fmtDuration(shift.break_minutes)})` : 'None'} label="Breaks" />
        <Tile value={shift.chores_total ? `${shift.chores_done}/${shift.chores_total}` : '–'} label="Chores done" />
        <Tile value={shift.arrived ? fmtTime(shift.arrived) : '–'} label="Arrived" />
      </div>

      <h2>
        <MapPin className="icon" aria-hidden /> Where the visit happened
      </h2>
      <div className="card">
        {shift.map && (shift.map.centre || shift.map.trail.length) ? (
          <>
            <ShiftMap
              centre={shift.map.centre}
              radius={shift.map.radius_m}
              trail={shift.map.trail}
              label={`Map of the visit: ${shift.map.radius_m} metre area around ${shift.elderly}'s phone and ${shift.map.trail.length} caretaker positions`}
            />
            <div className="map-legend">
              <span>
                <i style={{ background: 'var(--color-primary)' }} />
                {shift.map.radius_m} m area around {shift.elderly}&apos;s phone
              </span>
              <span>
                <i style={{ background: 'var(--color-warning)' }} />
                {shift.caretaker}&apos;s path ({shift.map.trail.length} positions, every 30 s or more)
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
          <h2>Timeline</h2>
          <div className="card">
            {entries.length === 0 ? (
              <Empty icon={ClipboardList} title="Nothing recorded yet">
                Check-in, each task and check-out appear here in order as the day goes on.
              </Empty>
            ) : (
              <ul className="timeline">
                {entries.map((e) => (
                  <li key={e.key}>
                    <e.Icon className={`mark ${e.mark}`} aria-hidden />
                    <span className="when">{fmtTime(e.at)}</span>
                    <span>{e.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h2>Active periods and breaks</h2>
          <div className="card divided">
            {shift.segments.length === 0 && (
              <span className="muted">No verified time yet. Time counts only while the caretaker is within range of the elderly person&apos;s phone.</span>
            )}
            {shift.segments.map((s, i) => (
              <div className="row" key={i}>
                <div className="grow">
                  <b>
                    {fmtTime(s.start)} – {s.end ? fmtTime(s.end) : 'now'}
                  </b>
                  <div className="muted small">With the elderly person</div>
                </div>
                <span>{fmtDuration(s.minutes)}</span>
              </div>
            ))}
            {shift.breaks_list.map((b, i) => (
              <div className="row" key={`b${i}`}>
                <div className="grow">
                  <b>
                    {fmtTime(b.start)} – {b.end ? fmtTime(b.end) : 'now'}
                  </b>
                  <div className="muted small">Break (not counted)</div>
                </div>
                <span>{fmtDuration(b.minutes)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2>Chores</h2>
      <div className="card divided">
        {shift.chores.length === 0 && (
          <Empty icon={ClipboardList} title="No tasks on the list for this day">
            Tasks you or the caretaker add appear here, with the time each was done.
          </Empty>
        )}
        {shift.chores.map((c, i) => (
          <div className="row" key={i}>
            {c.is_done ? (
              <CheckCircle2 className="icon" style={{ color: 'var(--color-success)' }} aria-label="Done" />
            ) : (
              <Circle className="icon" style={{ color: 'var(--color-border-strong)' }} aria-label="Not done" />
            )}
            <span className="grow" style={{ color: c.is_done ? undefined : 'var(--color-text-muted)' }}>
              {c.description}
            </span>
            {c.done_at && <span className="muted small">{fmtTime(c.done_at)}</span>}
          </div>
        ))}
      </div>

      {shift.tones && (
        <>
          <h2>Voice tone during this visit</h2>
          <div className="card">
            {!!shift.tone_timeline?.length && <ToneChart points={shift.tone_timeline} bucketMinutes={15} />}
          </div>
          <div className="card">
            <ToneBars tones={shift.tones} />
          </div>
        </>
      )}
    </>
  );
}
