'use client';

import type { LucideIcon } from 'lucide-react';
import { AudioWaveform, ChartColumn, CircleCheck, CloudLightning, Mic, MoveRight, ShieldCheck, Sun, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react';
import { ToneChart } from '@/components/ToneChart';
import { Empty, ErrorNote, Loading, PageHead, Pill, Ring, Section, TONE_ICON, ToneCard } from '@/components/ui';
import { getLiveTone } from '@/lib/api';
import { usePolling } from '@/lib/auth';
import { fmtTime, PillTone, tensionColor, timeAgo, weekday } from '@/lib/format';
import { LiveTone } from '@/lib/types';

const REFRESH_MS = 5000; // the chart follows the conversation: new speech shows within a few seconds

const STATE: Record<LiveTone['state'], { text: string; tone: PillTone }> = {
  live: { text: 'Live', tone: 'success' },
  needs_consent: { text: 'Needs consent', tone: 'ink' },
  listening: { text: 'Listening', tone: 'ink' },
  idle: { text: 'Not listening', tone: 'muted' },
};

function Moment({ Icon, label, time, pct }: { Icon: LucideIcon; label: string; time: string; pct: number }) {
  return (
    <div className="tile surface" aria-label={`${label} time ${time}, ${pct}% tense`} role="group">
      <Icon className="icon" style={{ color: 'var(--ink-muted)' }} aria-hidden />
      <span>
        <span className="heading">{time}</span>
        <span className="caption">
          {label} · {pct}% tense
        </span>
      </span>
    </div>
  );
}

// What the voices sound like right now, how today has gone, and how it compares with earlier days.
export default function TonePage() {
  const { data, error } = usePolling(getLiveTone, REFRESH_MS);
  if (!data) return error ? <ErrorNote message={`Couldn't load the voice tone. ${error}`} /> : <Loading label="Loading the voice tone…" />;

  const st = STATE[data.state];
  const now = data.current;
  const today = data.today;
  const Face = now ? TONE_ICON[now.dominant] : Mic;

  // The privacy promise stays, as one line.
  const why =
    data.state === 'needs_consent'
      ? `Waiting for ${data.waiting_for.join(' and ')} to agree on their phone. Nothing is listened to until both have agreed.`
      : data.state === 'idle'
        ? 'Only listened to while the caretaker is with your loved one, never at home. No recordings are kept.'
        : 'Both phones listen only during the visit. Only the tone is kept, never the recording.';

  let compare: { Icon: LucideIcon; label: string; color: string } | null = null;
  if (today && today.usual_tension !== null) {
    const tense = today.negative_percent ?? 0;
    const diff = tense - today.usual_tension;
    compare =
      diff > 5
        ? { Icon: TrendingUp, label: `Tenser than usual: ${tense}% against ${today.usual_tension}% on recent days`, color: 'var(--warning)' }
        : diff < -5
          ? { Icon: TrendingDown, label: `Calmer than usual: ${tense}% tense against ${today.usual_tension}% on recent days`, color: 'var(--success)' }
          : { Icon: MoveRight, label: `About as usual: ${tense}% tense, usually ${today.usual_tension}%`, color: 'var(--ink-muted)' };
  }

  return (
    <>
      <PageHead kicker="During visits" title="Voice tone" />

      {/* the one ink hero: how it sounds right now */}
      <section className="card ink hero" aria-label="Right now">
        <div className="hero-top">
          <Pill tone={st.tone}>{st.text}</Pill>
          <span className="on-ink-caption">{data.last_heard ? `Last heard ${timeAgo(data.last_heard)}` : 'Nothing heard yet today'}</span>
        </div>
        <div className="tone-now">
          <span className="face">
            <Face className="icon-l" style={{ color: now ? 'var(--ink)' : 'var(--ink-muted)' }} aria-hidden />
          </span>
          <div className="grow">
            <div className="on-ink-display" style={{ textTransform: 'capitalize' }}>
              {now ? now.dominant : 'Quiet'}
            </div>
            <div className="on-ink-caption">{now ? `${now.tension}% tense · last 5 minutes` : 'No speech heard lately'}</div>
          </div>
        </div>
        {now && (now.by_source.caretaker || now.by_source.elderly) && (
          <div className="sources">
            {(['caretaker', 'elderly'] as const).map((who) => {
              const s = now.by_source[who];
              if (!s) return null;
              const Icon = TONE_ICON[s.dominant];
              return (
                <span key={who} className="source">
                  <Icon className="icon" aria-hidden />
                  <span style={{ textTransform: 'capitalize' }}>
                    {who === 'caretaker' ? 'Caretaker' : 'Elder'} · {s.dominant}
                  </span>
                </span>
              );
            })}
          </div>
        )}
        <p className="why">
          <ShieldCheck className="icon-xs" aria-hidden />
          <span>{why}</span>
        </p>
      </section>

      <Section title="Through the day" />
      <div className="card">
        {data.series.length === 0 ? (
          <Empty icon={ChartColumn} title="No speech yet">
            The chart fills in as the caretaker and your loved one talk during today&apos;s shift.
          </Empty>
        ) : (
          // one chart: the red and amber at its bottom are the tension, with the 30% line drawn on it
          <ToneChart points={data.series} bucketMinutes={data.bucket_minutes} />
        )}
      </div>

      {today && (
        <>
          <Section title="Today" />
          <div className="tone-tiles">
            <div className="tile wide secondary-tint" role="group" aria-label={`${today.positive_percent ?? 0}% happy or calm`}>
              <Ring value={today.positive_percent ?? 0} total={100}>
                <span className="caption-strong">{today.positive_percent ?? 0}%</span>
              </Ring>
              <span className="strong">Happy or calm</span>
            </div>
            <div className="tile primary-tint" role="group" aria-label={`${today.speech_minutes} minutes of speech heard`}>
              <AudioWaveform className="icon" aria-hidden />
              <span>
                <span className="display">{today.speech_minutes}</span>
                <span className="caption-ink">min of speech heard</span>
              </span>
            </div>
            <Moment Icon={Sun} label="Calmest" time={fmtTime(today.calmest.start)} pct={today.calmest.tension} />
            <Moment Icon={CloudLightning} label="Tensest" time={fmtTime(today.tensest.start)} pct={today.tensest.tension} />
          </div>

          <div className="facts">
            {compare && (
              <span className="fact">
                <compare.Icon className="icon" style={{ color: compare.color }} aria-hidden />
                {compare.label}
              </span>
            )}
            <span className="fact">
              {today.raised_voice_clips ? (
                <TriangleAlert className="icon" style={{ color: 'var(--warning)' }} aria-hidden />
              ) : (
                <CircleCheck className="icon" style={{ color: 'var(--success)' }} aria-hidden />
              )}
              {today.raised_voice_clips === 0
                ? 'No raised voices picked up today'
                : `Raised voices in ${today.raised_voice_clips} recording${today.raised_voice_clips === 1 ? '' : 's'}` +
                  (today.vocal_alerts ? ` · ${today.vocal_alerts} alert${today.vocal_alerts === 1 ? '' : 's'} for you to review` : '')}
            </span>
          </div>

          <Section title="Today's mix" />
          <div className="card">
            <ToneCard tones={today} period="today" />
          </div>
        </>
      )}

      {data.earlier_days.length > 0 && (
        <>
          <Section title="Earlier days" />
          <div className="card">
            <div className="days" role="img" aria-label={`How tense each day was: ${data.earlier_days.map((d) => `${weekday(d.date)} ${d.tension}%`).join(', ')}. Lower is calmer.`}>
              {data.earlier_days.map((d) => (
                <div className="day" key={d.date}>
                  <span className="caption-strong">{d.tension}%</span>
                  <span className="day-track">
                    <span style={{ height: `${Math.max(4, d.tension)}%`, background: tensionColor(d.tension) }} />
                  </span>
                  <span className="caption">{weekday(d.date)}</span>
                </div>
              ))}
            </div>
            <p className="caption" style={{ margin: 'var(--s) 0 0' }}>
              % of speech that sounded stressed or angry each day. Lower is calmer.
            </p>
          </div>
        </>
      )}
    </>
  );
}
