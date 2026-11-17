'use client';

// The component kit, the web twin of the app's (mobile/src/components/ui.tsx). Every value comes from tokens.css.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Angry, Annoyed, AudioWaveform, CalendarDays, Check, ChevronRight, CircleAlert, Laugh, Meh, Smile, X } from 'lucide-react';
import { ReactNode, useEffect, useRef } from 'react';
import { BANDS, bandShare, fmtDuration, fmtShiftDay, fmtTime, PillTone, QUALITY_LABEL, STATUS_LABEL } from '@/lib/format';
import { Dashboard, ShiftSummary, Tone } from '@/lib/types';

export const TONE_ICON: Record<Tone, LucideIcon> = { happy: Laugh, calm: Smile, neutral: Meh, stressed: Annoyed, angry: Angry };

/** A status in words with a dot, never colour alone. The dot carries the status colour; the words are ink. */
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`pill ${tone}`}>
      <i aria-hidden />
      {children}
    </span>
  );
}

/** Initial in a circle: ink on the cornflower tint; `solid` (on the hero) is ink on cornflower. */
export function Avatar({ name, size = 40, solid }: { name: string; size?: number; solid?: boolean }) {
  return (
    <span className={`avatar${solid ? ' solid' : ''}`} style={{ width: size, height: size, fontSize: size >= 56 ? 'var(--size-heading)' : undefined }} aria-hidden>
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </span>
  );
}

/** Page title: a small line above (the date, or what the page covers), the display title, an action on the right. */
export function PageHead({ title, kicker, right }: { title: string; kicker?: string; right?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {kicker && <p className="caption">{kicker}</p>}
        <h1>{title}</h1>
      </div>
      {right}
    </header>
  );
}

/** Section heading with an optional link or button on the right ("See all"). */
export function Section({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="section">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

/** Ink words with a red icon (red small text fails on the tints). */
export function ErrorNote({ message }: { message: string }) {
  return message ? (
    <p className="error-note" role="alert">
      <CircleAlert className="icon" aria-hidden />
      <span>{message}</span>
    </p>
  ) : null;
}

/** Spinner with context, so a slow connection doesn't look frozen. */
export function Loading({ label }: { label: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden />
      {label}
    </div>
  );
}

/** An empty list: what will appear here and why there is nothing yet. */
export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon className="icon" aria-hidden />
      </span>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

/** A list row: something on the left, a title and a caption, something on the right. */
export function Row({ leading, title, subtitle, trailing }: { leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="list-row">
      {leading}
      <div className="grow">
        <div className="strong">{title}</div>
        {subtitle && <div className="caption">{subtitle}</div>}
      </div>
      {trailing}
    </div>
  );
}

/** A progress ring with the figure or an icon in the middle. Cobalt arc on light cards; `onInk`: cornflower on cobalt. */
export function Ring({ value, total, size = 64, onInk, children }: { value: number; total: number; size?: number; onInk?: boolean; children?: ReactNode }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <span className={`ring${onInk ? ' on-ink' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        {share > 0 && (
          <circle
            className="ring-arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * share} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className="ring-mid">{children}</span>
    </span>
  );
}

/** Live progress through a day, like an order tracker: done steps ticked, the current one ringed. */
export function Stepper({ steps, current, onInk }: { steps: string[]; current: number; onInk?: boolean }) {
  return (
    <ol className={`stepper${onInk ? ' on-ink' : ''}`} aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'now' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="step-dot">{i < current && <Check className="icon-xs" aria-hidden strokeWidth={3} />}</span>
          <span className="step-label">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** Two or three choices in one pill: the chosen one is white on the line colour. */
export function Segmented<K extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.key)} type="button" className={o.key === value ? 'on' : ''} aria-pressed={o.key === value} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The web's bottom sheet: a native modal dialog. A sheet from the bottom on phones, a centred panel on wider screens.
 *  Esc, the close button or a click on the backdrop closes it. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // the backdrop
      }}
    >
      {open && (
        <div className="dialog-body">
          <div className="dialog-head">
            <h2 id="dialog-title">{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X className="icon" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** The five tone colours, happy first. With `shares`, each one also carries its percentage (and empty ones are left out). */
export function ToneLegend({ shares }: { shares?: Partial<Record<Tone, number>> }) {
  return (
    <div className="legend">
      {[...BANDS]
        .reverse()
        .filter((b) => !shares || bandShare(shares, b) > 0)
        .map((b) => (
          <span key={b.key}>
            <i style={{ background: b.color }} />
            {b.label}
            {shares && <b>{bandShare(shares, b)}%</b>}
          </span>
        ))}
    </div>
  );
}

/** The tone mix as one stacked bar with the dominant face, and every tone's share in the legend under it. */
export function ToneCard({ tones, period = 'this week' }: { tones: Dashboard['tones']; period?: string }) {
  if (!tones.items.length || !tones.dominant) {
    return (
      <div className="tone-head">
        <span className="tone-face">
          <AudioWaveform className="icon" aria-hidden />
        </span>
        <div className="grow">
          <div className="strong">No voices heard yet</div>
          <div className="caption">Tone results appear once the caretaker and your loved one have talked during a shift, and both have agreed to it.</div>
        </div>
      </div>
    );
  }
  const top = tones.items[0];
  const Face = TONE_ICON[top.tone];
  const q = tones.quality ? QUALITY_LABEL[tones.quality] : null;
  const shares = Object.fromEntries(tones.items.map((t) => [t.tone, t.percent])) as Partial<Record<Tone, number>>;
  return (
    <>
      <div className="tone-head">
        <span className="tone-face">
          <Face className="icon-l" aria-hidden />
        </span>
        <div className="grow">
          <h3>Mostly {top.label.toLowerCase()}</h3>
          <div className="caption">
            {top.percent}% · {period}
          </div>
        </div>
        {q && <Pill tone={q.tone}>{q.text}</Pill>}
      </div>
      <div className="stack" role="img" aria-label={tones.items.map((t) => `${t.label} ${t.percent}%`).join(', ')}>
        {[...BANDS].reverse().map((b) => {
          const v = bandShare(shares, b);
          return v > 0 ? <span key={b.key} style={{ flex: v, background: b.color }} /> : null;
        })}
      </div>
      <ToneLegend shares={shares} />
    </>
  );
}

/** A list of day-shifts. Each row opens that day's timeline. */
export function ShiftTable({ shifts, showCaretaker = true }: { shifts: ShiftSummary[]; showCaretaker?: boolean }) {
  const router = useRouter();
  if (!shifts.length)
    return (
      <Empty icon={CalendarDays} title="No shifts in this period">
        A shift appears here each day your caretaker arrives at the home, with their arrival, breaks and time worked.
      </Empty>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Day</th>
            {showCaretaker && <th className="hide-s">Caretaker</th>}
            <th className="hide-xs">Times</th>
            <th>Active</th>
            <th className="hide-s">Breaks</th>
            <th className="hide-s">Tasks</th>
            <th>Status</th>
            <th aria-hidden />
          </tr>
        </thead>
        <tbody>
          {shifts.map((s) => {
            const st = STATUS_LABEL[s.status];
            const times = s.arrived
              ? `${fmtTime(s.arrived)} – ${s.end ? fmtTime(s.end) : s.left ? `${fmtTime(s.left)} (out)` : 'now'}`
              : 'Not arrived yet';
            return (
              <tr key={s.id} className="click" onClick={() => router.push(`/shifts/day?id=${s.id}`)}>
                <td>
                  <Link href={`/shifts/day?id=${s.id}`} onClick={(e) => e.stopPropagation()}>
                    {fmtShiftDay(s.date)}
                  </Link>
                </td>
                {showCaretaker && <td className="hide-s">{s.caretaker}</td>}
                <td className="hide-xs">{times}</td>
                <td className="strong">{fmtDuration(s.minutes)}</td>
                <td className="hide-s">{s.breaks ? `${s.breaks} (${fmtDuration(s.break_minutes)})` : '–'}</td>
                <td className="hide-s">{s.chores_total ? `${s.chores_done}/${s.chores_total}` : '–'}</td>
                <td>
                  <Pill tone={st.tone}>{st.text}</Pill>
                </td>
                <td className="chev">
                  <ChevronRight className="icon" aria-hidden />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
