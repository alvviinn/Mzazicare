'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHead, Pill, Tile, ToneBars } from '@/components/ui';
import { ToneChart } from '@/components/ToneChart';
import { getShift } from '@/lib/api';
import { usePolling } from '@/lib/auth';
import { fmtDuration, fmtShiftDayLong, fmtTime, STATUS_LABEL } from '@/lib/format';
import { TimelineEvent } from '@/lib/types';

const EVENT: Record<TimelineEvent['kind'], { text: string; dot: '' | 'out' | 'end' }> = {
  started: { text: 'Shift opened', dot: '' },
  arrived: { text: 'Arrived', dot: '' },
  stepped_out: { text: 'Stepped out (break starts)', dot: 'out' },
  returned: { text: 'Came back', dot: '' },
  left: { text: 'Left', dot: 'end' },
};

export default function ShiftDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: shift, error } = usePolling((t) => getShift(t, id), 15000);

  if (!shift) return <p className="muted">{error || 'Loading…'}</p>;
  const st = STATUS_LABEL[shift.status];

  return (
    <>
      <p style={{ margin: 0 }}>
        <Link href="/shifts">← All shifts</Link>
      </p>
      <PageHead
        title={fmtShiftDayLong(shift.date)}
        sub={`${shift.caretaker} with ${shift.elderly}`}
        right={<Pill tone={st.tone}>{st.text}</Pill>}
      />

      <div className="grid tiles" style={{ marginTop: 18 }}>
        <Tile value={fmtDuration(shift.minutes)} label="Active time" />
        <Tile value={shift.breaks ? `${shift.breaks} (${fmtDuration(shift.break_minutes)})` : 'None'} label="Breaks" />
        <Tile value={shift.chores_total ? `${shift.chores_done}/${shift.chores_total}` : '–'} label="Chores done" />
        <Tile value={shift.arrived ? fmtTime(shift.arrived) : '–'} label="Arrived" />
      </div>

      <div className="grid two">
        <div>
          <h2>Timeline</h2>
          <div className="card">
            {shift.timeline.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Nothing recorded yet.</p>
            ) : (
              <ul className="timeline">
                {shift.timeline.map((e, i) => {
                  const ev = EVENT[e.kind];
                  return (
                    <li key={i}>
                      <span className={`dot ${ev.dot}`} />
                      <span className="when">{fmtTime(e.at)}</span>
                      <span>
                        {ev.text}
                        {e.kind === 'returned' && e.break_minutes !== undefined && ` after ${fmtDuration(e.break_minutes)}`}
                        {e.note && <span className="muted small"> · {e.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h2>Active periods and breaks</h2>
          <div className="card divided">
            {shift.segments.length === 0 && <span className="muted">No verified time yet.</span>}
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
        {shift.chores.length === 0 && <span className="muted">No chores logged for this day.</span>}
        {shift.chores.map((c, i) => (
          <div className="row" key={i}>
            <span style={{ color: c.is_done ? 'var(--success)' : 'var(--muted)' }}>{c.is_done ? '✓' : '○'}</span>
            <span className="grow" style={{ color: c.is_done ? undefined : 'var(--muted)' }}>
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
