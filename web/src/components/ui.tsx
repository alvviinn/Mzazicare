import Link from 'next/link';
import { ReactNode } from 'react';
import { fmtDuration, fmtShiftDay, fmtTime, QUALITY_LABEL, STATUS_LABEL, TONE_COLOR, TONE_LABEL } from '@/lib/format';
import { Dashboard, ShiftSummary } from '@/lib/types';

export function Pill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'quiet'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Tile({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="tile">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return message ? <p className="error">{message}</p> : null;
}

/** Horizontal bars for the tone mix. */
export function ToneBars({ tones }: { tones: Dashboard['tones'] }) {
  const q = tones.quality ? QUALITY_LABEL[tones.quality] : null;
  if (!tones.items.length || !tones.dominant) {
    return <p className="muted">Tone results appear once your caretaker and your loved one have been heard talking during a shift.</p>;
  }
  return (
    <>
      <div className="row" style={{ marginBottom: 6 }}>
        <div className="grow">
          <h3>Mostly {TONE_LABEL[tones.dominant].toLowerCase()}</h3>
          <span className="muted small">
            {tones.positive_percent}% happy or calm · {tones.negative_percent}% stressed or angry
          </span>
        </div>
        {q && <Pill tone={q.tone}>{q.text}</Pill>}
      </div>
      {tones.items.map((t) => (
        <div className="bar" key={t.tone}>
          <span className="name">{t.label}</span>
          <div className="track">
            <div className="fill" style={{ width: `${t.percent}%`, background: TONE_COLOR[t.tone] }} />
          </div>
          <span className="pct">{t.percent}%</span>
        </div>
      ))}
    </>
  );
}

/** A list of day-shifts. Each row opens that day's timeline. */
export function ShiftTable({ shifts, showCaretaker = true }: { shifts: ShiftSummary[]; showCaretaker?: boolean }) {
  if (!shifts.length) return <p className="muted">No shifts yet. A day&apos;s shift appears when your caretaker arrives.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Day</th>
            {showCaretaker && <th>Caretaker</th>}
            <th>Times</th>
            <th>Active</th>
            <th>Breaks</th>
            <th>Chores</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {shifts.map((s) => {
            const st = STATUS_LABEL[s.status];
            const times = s.arrived
              ? `${fmtTime(s.arrived)} – ${s.end ? fmtTime(s.end) : s.left ? `${fmtTime(s.left)} (out)` : 'now'}`
              : 'Not arrived yet';
            return (
              <tr key={s.id} className="click">
                <td>
                  <Link href={`/shifts/${s.id}`}>{fmtShiftDay(s.date)}</Link>
                </td>
                {showCaretaker && <td>{s.caretaker}</td>}
                <td>{times}</td>
                <td>{fmtDuration(s.minutes)}</td>
                <td>{s.breaks ? `${s.breaks} (${fmtDuration(s.break_minutes)})` : '–'}</td>
                <td>{s.chores_total ? `${s.chores_done}/${s.chores_total}` : '–'}</td>
                <td>
                  <Pill tone={st.tone}>{st.text}</Pill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
