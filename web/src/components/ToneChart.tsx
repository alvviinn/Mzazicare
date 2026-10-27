'use client';

import { useState } from 'react';
import { fmtTime, TONE_COLOR, TONE_LABEL, TONE_STACK } from '@/lib/format';
import { TonePoint } from '@/lib/types';

const W = 760;
const H = 150;
const AXIS = 18;

/** Lay the points out on an even time axis, one slot per bucket, so quiet stretches show as gaps. */
function layout(points: TonePoint[], bucketMinutes: number) {
  const step = bucketMinutes * 60000;
  const first = new Date(points[0].start).getTime();
  const last = new Date(points[points.length - 1].start).getTime();
  const slots = Math.min(96, Math.round((last - first) / step) + 1);
  const bySlot = new Map(points.map((p) => [Math.round((new Date(p.start).getTime() - first) / step), p]));
  return { first, step, slots, bySlot, slotW: W / slots };
}

/** How the voices sounded through the day: one column per time bucket, split by tone. Click a column for its numbers. */
export function ToneChart({ points, bucketMinutes }: { points: TonePoint[]; bucketMinutes: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  if (!points.length) return null;
  const { first, step, slots, bySlot, slotW } = layout(points, bucketMinutes);
  const selected = picked !== null ? bySlot.get(picked) : points[points.length - 1];
  const tick = Math.max(1, Math.ceil(slots / 8));

  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H + AXIS}`} role="img" aria-label="Voice tone through the day">
        {[0, 25, 50, 75, 100].map((g) => (
          <line key={g} x1={0} x2={W} y1={H - (H * g) / 100} y2={H - (H * g) / 100} stroke="#e6e9e5" strokeWidth={1} />
        ))}
        {Array.from({ length: slots }, (_, i) => {
          const p = bySlot.get(i);
          if (!p) return null;
          let y = H;
          return (
            <g key={i} className="col" onClick={() => setPicked(i)}>
              {TONE_STACK.map((t) => {
                const h = (H * p.shares[t]) / 100;
                y -= h;
                return h > 0 ? (
                  <rect
                    key={t}
                    x={i * slotW + 1}
                    y={y}
                    width={Math.max(2, slotW - 2)}
                    height={h}
                    rx={2}
                    fill={TONE_COLOR[t]}
                    opacity={p === selected ? 1 : 0.85}
                  />
                ) : null;
              })}
              <title>{`${fmtTime(p.start)}: ${TONE_LABEL[p.dominant]}, ${p.tension}% tense`}</title>
            </g>
          );
        })}
        {Array.from({ length: slots }, (_, i) =>
          i % tick === 0 ? (
            <text key={i} x={i * slotW} y={H + 13}>
              {fmtTime(new Date(first + i * step).toISOString())}
            </text>
          ) : null,
        )}
      </svg>
      <div className="legend">
        {[...TONE_STACK].reverse().map((t) => (
          <span key={t}>
            <i style={{ background: TONE_COLOR[t] }} />
            {TONE_LABEL[t]}
          </span>
        ))}
      </div>
      {selected && (
        <div className="picked">
          <b>
            {fmtTime(selected.start)} · mostly {TONE_LABEL[selected.dominant].toLowerCase()}
          </b>
          <div className="muted small">
            {[...TONE_STACK]
              .reverse()
              .filter((t) => selected.shares[t] > 0)
              .map((t) => `${TONE_LABEL[t]} ${selected.shares[t]}%`)
              .join(' · ')}
            {' · '}
            {Math.max(1, Math.round(selected.speech_s / 60))} min of speech
          </div>
        </div>
      )}
    </div>
  );
}

/** One bar per bucket for stressed + angry speech: easier to read than the colours for "is it getting worse?". */
export function TensionStrip({ points, bucketMinutes }: { points: TonePoint[]; bucketMinutes: number }) {
  if (!points.length) return null;
  const { slots, bySlot, slotW } = layout(points, bucketMinutes);
  const h = 70;
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label="Tension through the day">
        <rect x={0} y={0} width={W} height={h} rx={8} fill="#f8f6f1" />
        <line x1={0} x2={W} y1={h - (h * 30) / 100} y2={h - (h * 30) / 100} stroke="#a8700f" strokeDasharray="4 4" opacity={0.7} />
        {Array.from({ length: slots }, (_, i) => {
          const p = bySlot.get(i);
          if (!p) return null;
          const bar = Math.max(3, (h * p.tension) / 100);
          const color = p.tension <= 15 ? '#2e7d5b' : p.tension <= 30 ? '#a8700f' : '#b3372f';
          return (
            <rect key={i} x={i * slotW + 1} y={h - bar} width={Math.max(2, slotW - 2)} height={bar} rx={2} fill={color}>
              <title>{`${fmtTime(p.start)}: ${p.tension}% tense`}</title>
            </rect>
          );
        })}
      </svg>
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        Share of stressed or angry speech. Above the dashed line (30%) needs a look.
      </p>
    </div>
  );
}
