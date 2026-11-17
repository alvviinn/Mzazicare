'use client';

import { KeyboardEvent, PointerEvent, useState } from 'react';
import { BANDS, bandShare, fmtTime, TONE_LABEL, TONE_ORDER } from '@/lib/format';
import { TonePoint } from '@/lib/types';
import { TONE_ICON, ToneLegend } from './ui';

const LINE = 30; // the "needs a look" line: stressed + angry above 30%

/** Lay the points out on an even time axis, one slot per bucket, so quiet stretches show as gaps. */
function layout(points: TonePoint[], bucketMinutes: number) {
  const step = bucketMinutes * 60000;
  const first = new Date(points[0].start).getTime();
  const last = new Date(points[points.length - 1].start).getTime();
  const slots = Math.min(96, Math.round((last - first) / step) + 1);
  const bySlot = new Map(points.map((p) => [Math.round((new Date(p.start).getTime() - first) / step), p]));
  return { first, step, slots, bySlot };
}

/** How the voices sounded through the day: one bar per time bucket, each tone in its own colour (angry at the
 *  bottom, then stressed, neutral, calm, happy on top). The red and amber at the bottom are the tension, so the
 *  dashed line marks 30%: a bar whose red and amber reach above it needs a look.
 *  Hover, tap or use the arrow keys to read a bar; the picked one gets an ink mark under it. */
export function ToneChart({ points, bucketMinutes }: { points: TonePoint[]; bucketMinutes: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  if (!points.length) return null;
  const { first, step, slots, bySlot } = layout(points, bucketMinutes);
  const present = [...bySlot.keys()].sort((a, b) => a - b);
  const lastSlot = present[present.length - 1];
  const cur = picked !== null && bySlot.has(picked) ? picked : lastSlot;
  const selected = bySlot.get(cur)!;
  const Face = TONE_ICON[selected.dominant];
  const dense = slots > 40;

  // hovering with a mouse, or sliding a finger, reads the nearest bar that has data
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const slot = Math.max(0, Math.min(slots - 1, Math.floor(((e.clientX - r.left) / r.width) * slots)));
    let best = present[0];
    for (const i of present) if (Math.abs(i - slot) < Math.abs(best - slot)) best = i;
    setPicked(best);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = present.indexOf(cur);
    if (e.key === 'ArrowLeft' && k > 0) setPicked(present[k - 1]);
    else if (e.key === 'ArrowRight' && k < present.length - 1) setPicked(present[k + 1]);
    else if (e.key === 'Home') setPicked(present[0]);
    else if (e.key === 'End') setPicked(lastSlot);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <div
        className={`tone-bars${dense ? ' dense' : ''}`}
        role="img"
        tabIndex={0}
        aria-label={`Voice tone through the day, one bar per ${bucketMinutes} minutes. ${fmtTime(selected.start)}: mostly ${TONE_LABEL[selected.dominant].toLowerCase()}, ${selected.tension}% tense. Use the arrow keys to move between bars.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onKeyDown={onKey}
      >
        {Array.from({ length: slots }, (_, i) => {
          const p = bySlot.get(i);
          return (
            <span key={i} className={`tone-bar${i === cur ? ' on' : ''}`}>
              {p && (
                <span className="stackcol">
                  {BANDS.map((b) => {
                    const v = bandShare(p.shares, b);
                    return v > 0 ? <i key={b.key} style={{ flexGrow: v, background: b.color }} /> : null;
                  })}
                </span>
              )}
            </span>
          );
        })}
        {/* the 30% line, measured from the bottom of the bars */}
        <span className="tone-guide" style={{ bottom: `calc(var(--mark-room) + (100% - var(--mark-room)) * ${LINE / 100})` }} aria-hidden>
          <b>30% tense</b>
        </span>
      </div>
      <div className="axis">
        {(slots > 2 ? [0, Math.floor((slots - 1) / 2), slots - 1] : [0, slots - 1]).map((i, k) => (
          <span key={k} className="caption">
            {fmtTime(new Date(first + i * step).toISOString())}
          </span>
        ))}
      </div>
      <ToneLegend />
      <div className="picked" aria-live="polite">
        <Face className="icon-l" aria-hidden />
        <div className="grow">
          <div className="strong">
            {fmtTime(selected.start)} · {TONE_LABEL[selected.dominant]}
          </div>
          <div className="caption">
            <b className="strong">{selected.tension}% tense</b>
            {' · '}
            {TONE_ORDER.filter((t) => selected.shares[t] > 0)
              .map((t) => `${TONE_LABEL[t]} ${selected.shares[t]}%`)
              .join(' · ')}
          </div>
        </div>
        <span className="caption">{Math.max(1, Math.round(selected.speech_s / 60))} min</span>
      </div>
      <p className="caption" style={{ margin: 'var(--s) 0 0' }}>
        Red and amber at the bottom of a bar are stressed or angry speech. Above the dashed line (30%) needs a look.
      </p>
    </div>
  );
}
