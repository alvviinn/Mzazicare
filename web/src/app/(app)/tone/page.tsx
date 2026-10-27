'use client';

import { PageHead, Pill, Tile, ToneBars } from '@/components/ui';
import { TensionStrip, ToneChart } from '@/components/ToneChart';
import { getLiveTone } from '@/lib/api';
import { usePolling } from '@/lib/auth';
import { fmtTime, timeAgo, TONE_COLOR, weekday } from '@/lib/format';
import { LiveTone } from '@/lib/types';

const REFRESH_MS = 5000; // the chart follows the conversation: new speech shows within a few seconds

const STATE: Record<LiveTone['state'], { text: string; tone: 'good' | 'warn' | 'quiet' }> = {
  live: { text: 'Live', tone: 'good' },
  needs_consent: { text: 'Needs consent', tone: 'warn' },
  listening: { text: 'Listening', tone: 'warn' },
  idle: { text: 'Not listening', tone: 'quiet' },
};

// What the voices sound like right now, how today has gone, and how it compares with earlier days.
export default function TonePage() {
  const { data, error } = usePolling(getLiveTone, REFRESH_MS);
  if (!data) return <p className="muted">{error || 'Loading…'}</p>;

  const st = STATE[data.state];
  const now = data.current;
  const today = data.today;

  let comparison = 'No earlier days to compare with yet.';
  if (today && today.usual_tension !== null) {
    const tense = today.negative_percent ?? 0;
    const diff = tense - today.usual_tension;
    comparison =
      diff > 5
        ? `Tenser than usual: ${tense}% against ${today.usual_tension}% on recent days.`
        : diff < -5
          ? `Calmer than usual: ${tense}% tense against ${today.usual_tension}% on recent days.`
          : `About the same as recent days (${tense}% tense, usually ${today.usual_tension}%).`;
  }

  return (
    <>
      <PageHead
        title="Voice tone"
        sub="How the voices sound during visits. Only the tone is kept, never the recording."
        right={
          <Pill tone={st.tone}>
            {data.state === 'live' && <span className="live-dot" />}
            {st.text}
          </Pill>
        }
      />

      <h2>Right now</h2>
      <div className="card">
        <div className="row wrap">
          <div className="grow">
            <h3 style={{ textTransform: 'capitalize' }}>{now ? `Sounds ${now.dominant}` : 'No speech heard lately'}</h3>
            <span className="muted small">
              {data.last_heard ? `Last heard ${timeAgo(data.last_heard)}` : 'Nothing heard yet today'}
              {now ? ` · ${now.tension}% tense` : ''}
            </span>
          </div>
          {now &&
            (['caretaker', 'elderly'] as const).map((who) => {
              const s = now.by_source[who];
              return s ? (
                <span key={who} className="row" style={{ gap: 6 }}>
                  <i style={{ width: 10, height: 10, borderRadius: '50%', background: TONE_COLOR[s.dominant], display: 'inline-block' }} />
                  <span className="small" style={{ textTransform: 'capitalize' }}>
                    {who === 'caretaker' ? 'Caretaker' : 'Elderly'}: {s.dominant}
                  </span>
                </span>
              ) : null;
            })}
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          {data.state === 'needs_consent'
            ? `Waiting for ${data.waiting_for.join(' and ')} to agree to voice monitoring on their phone. Nothing is listened to until both have agreed.`
            : data.state === 'idle'
              ? 'The voice tone is only listened to while the caretaker is with your loved one, never at home.'
              : 'Both phones listen only during the visit. This page updates every few seconds.'}
        </p>
      </div>

      <h2>Tone through the day</h2>
      <div className="card">
        {data.series.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            The chart fills in as the caretaker and your loved one talk during today&apos;s shift.
          </p>
        ) : (
          <>
            <ToneChart points={data.series} bucketMinutes={data.bucket_minutes} />
            <h3 style={{ margin: '22px 0 8px', fontSize: 15 }}>Tension through the day</h3>
            <TensionStrip points={data.series} bucketMinutes={data.bucket_minutes} />
          </>
        )}
      </div>

      {today && (
        <>
          <h2>Today in numbers</h2>
          <div className="grid tiles">
            <Tile value={today.speech_minutes} label="Minutes of speech heard" />
            <Tile value={`${today.positive_percent}%`} label="Happy or calm" />
            <Tile value={fmtTime(today.calmest.start)} label={`Calmest time (${today.calmest.tension}% tense)`} />
            <Tile value={fmtTime(today.tensest.start)} label={`Most tense time (${today.tensest.tension}% tense)`} />
          </div>

          <div className="grid two" style={{ marginTop: 12 }}>
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Today&apos;s mix</h3>
              <ToneBars tones={today} />
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Compared with recent days</h3>
              <p style={{ marginTop: 0 }}>{comparison}</p>
              <p style={{ marginBottom: 0 }}>
                {today.raised_voice_clips === 0
                  ? 'No raised voices picked up today.'
                  : `Raised voices were picked up in ${today.raised_voice_clips} recording${today.raised_voice_clips === 1 ? '' : 's'}` +
                    (today.vocal_alerts
                      ? ` and ${today.vocal_alerts} alert${today.vocal_alerts === 1 ? ' was' : 's were'} raised for you to review.`
                      : '.')}
              </p>
            </div>
          </div>
        </>
      )}

      {data.earlier_days.length > 0 && (
        <>
          <h2>Previous days</h2>
          <div className="card">
            <div className="days">
              {data.earlier_days.map((d) => (
                <div className="day" key={d.date}>
                  <div className="track">
                    <div
                      style={{
                        height: `${Math.max(4, d.tension)}%`,
                        background: d.tension <= 15 ? 'var(--success)' : d.tension <= 30 ? 'var(--warning)' : 'var(--danger)',
                      }}
                    />
                  </div>
                  {d.tension}%<br />
                  {weekday(d.date)}
                </div>
              ))}
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>
              How tense the voices sounded each day (stressed or angry). Lower is calmer.
            </p>
          </div>
        </>
      )}
    </>
  );
}
