import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getLiveTone } from '../../api/client';
import { Icon, IconName, TONE_ICON } from '../../components/Icon';
import { TensionStrip, ToneCard, ToneChart } from '../../components/ToneChart';
import { Card, Empty, ErrorState, Loading, PillTone, Ring, Section, StatusPill } from '../../components/ui';
import { fmtTime, timeAgo } from '../../format';
import { colors, icon, on, radius, space, TAP, text, textOnInk } from '../../theme';
import { LiveTone } from '../../types';

const REFRESH_MS = 5000; // the chart follows the conversation: new speech shows within a few seconds

const STATE: Record<LiveTone['state'], { text: string; tone: PillTone }> = {
  live: { text: 'Live', tone: 'success' },
  needs_consent: { text: 'Needs consent', tone: 'ink' },
  listening: { text: 'Listening', tone: 'ink' },
  idle: { text: 'Off', tone: 'muted' },
};

const weekday = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short' });

// What the voices sound like right now, how today has gone, and how it compares with earlier days.
export default function ToneTab({ token }: { token: string }) {
  const [data, setData] = useState<LiveTone | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await getLiveTone(token));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the voice tone.');
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return error ? <ErrorState message={`Couldn't load the voice tone. ${error}`} onRetry={load} /> : <Loading label="Loading the voice tone" />;
  const st = STATE[data.state];
  const now = data.current;
  const today = data.today;

  // The privacy promise stays, as one line.
  const why =
    data.state === 'needs_consent'
      ? `Waiting for ${data.waiting_for.join(' and ')}`
      : data.state === 'idle'
        ? 'Only during visits · no recordings kept'
        : 'Tone only · no recordings kept';

  let compare: { icon: IconName; label: string; color: string } | null = null;
  if (today && today.usual_tension !== null) {
    const tense = today.negative_percent ?? 0;
    const diff = tense - today.usual_tension;
    compare =
      diff > 5
        ? { icon: 'up', label: `Tenser than usual · ${tense}% vs ${today.usual_tension}%`, color: colors.warning }
        : diff < -5
          ? { icon: 'down', label: `Calmer than usual · ${tense}% vs ${today.usual_tension}%`, color: colors.success }
          : { icon: 'flat', label: `As usual · ${tense}% tense`, color: colors.inkMuted };
  }

  return (
    <>
      <Card tint="ink">
        <View style={styles.heroTop}>
          <StatusPill label={st.text} tone={st.tone} />
          <Text style={textOnInk.caption}>{data.last_heard ? timeAgo(data.last_heard) : 'Nothing today'}</Text>
        </View>
        <View style={styles.hero}>
          <View style={styles.face}>
            <Icon name={now ? TONE_ICON[now.dominant] : 'mic'} size={icon.l} color={now ? colors.ink : colors.inkMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[textOnInk.display, { textTransform: 'capitalize' }]}>{now ? now.dominant : 'Quiet'}</Text>
            {now && <Text style={textOnInk.caption}>{now.tension}% tense · last 5 min</Text>}
          </View>
        </View>
        {now && (now.by_source.caretaker || now.by_source.elderly) && (
          <View style={styles.sources}>
            {(['caretaker', 'elderly'] as const).map((who) => {
              const s = now.by_source[who];
              return s ? (
                <View key={who} style={styles.source}>
                  <Icon name={TONE_ICON[s.dominant]} />
                  <Text style={[text.captionStrong, { textTransform: 'capitalize' }]}>
                    {who === 'caretaker' ? 'Caretaker' : 'Elder'} · {s.dominant}
                  </Text>
                </View>
              ) : null;
            })}
          </View>
        )}
        <View style={styles.why}>
          <Icon name="shield" size={icon.xs} color={on.ink} />
          <Text style={[textOnInk.caption, { flex: 1 }]}>{why}</Text>
        </View>
      </Card>

      <Section title="Through the day" />
      {data.series.length === 0 ? (
        <Empty icon="chart" title="No speech yet" body="Fills in during today's visit." />
      ) : (
        <Card>
          <ToneChart points={data.series} bucketMinutes={data.bucket_minutes} />
          <Text style={[text.captionStrong, styles.stripTitle]}>Tension</Text>
          <TensionStrip points={data.series} bucketMinutes={data.bucket_minutes} />
        </Card>
      )}

      {today && (
        <>
          <Section title="Today" />
          <View style={styles.tiles}>
            <View style={[styles.tile, styles.tileWide, { backgroundColor: colors.secondaryTint }]}>
              <Ring value={today.positive_percent ?? 0} total={100} size={64}>
                <Text style={text.captionStrong}>{today.positive_percent ?? 0}%</Text>
              </Ring>
              <Text style={[text.captionStrong, { flex: 1 }]}>Happy or calm</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: colors.primaryTint }]} accessible accessibilityLabel={`${today.speech_minutes} minutes of speech heard`}>
              <Text style={text.display}>{today.speech_minutes}</Text>
              <Text style={text.captionInk}>min heard</Text>
            </View>
          </View>
          <View style={[styles.tiles, { marginTop: space.s }]}>
            <Moment glyph="sun" label="Calmest" time={fmtTime(today.calmest.start)} pct={today.calmest.tension} />
            <Moment glyph="storm" label="Tensest" time={fmtTime(today.tensest.start)} pct={today.tensest.tension} />
          </View>

          <View style={styles.facts}>
            {compare && (
              <View style={styles.fact}>
                <Icon name={compare.icon} color={compare.color} />
                <Text style={[text.captionStrong, { flex: 1 }]}>{compare.label}</Text>
              </View>
            )}
            <View style={styles.fact}>
              <Icon name={today.raised_voice_clips ? 'warning' : 'checkCircle'} color={today.raised_voice_clips ? colors.warning : colors.success} />
              <Text style={[text.captionStrong, { flex: 1 }]}>
                {today.raised_voice_clips === 0
                  ? 'No raised voices'
                  : `Raised voices · ${today.raised_voice_clips}${today.vocal_alerts ? ` · ${today.vocal_alerts} alert${today.vocal_alerts === 1 ? '' : 's'}` : ''}`}
              </Text>
            </View>
          </View>

          <Section title="Today's mix" />
          <ToneCard tones={today} period="today" />
        </>
      )}

      {data.earlier_days.length > 0 && (
        <>
          <Section title="Earlier days" />
          <Card>
            <View
              style={styles.days}
              accessible
              accessibilityLabel={`How tense each day was: ${data.earlier_days.map((d) => `${weekday(d.date)} ${d.tension}%`).join(', ')}. Lower is calmer.`}
            >
              {data.earlier_days.map((d) => (
                <View key={d.date} style={styles.day}>
                  <Text style={text.captionStrong}>{d.tension}%</Text>
                  <View style={styles.dayTrack}>
                    <View style={[styles.dayFill, { height: `${Math.max(4, d.tension)}%`, backgroundColor: d.tension > 30 ? colors.secondary : colors.primary }]} />
                  </View>
                  <Text style={text.caption}>{weekday(d.date)}</Text>
                </View>
              ))}
            </View>
            <Text style={[text.caption, { marginTop: space.s }]}>% tense · lower is calmer</Text>
          </Card>
        </>
      )}
    </>
  );
}

function Moment({ glyph, label, time, pct }: { glyph: IconName; label: string; time: string; pct: number }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface }]} accessible accessibilityLabel={`${label} time ${time}, ${pct}% tense`}>
      <Icon name={glyph} color={colors.inkMuted} />
      <Text style={text.heading}>{time}</Text>
      <Text style={text.caption}>
        {label} · {pct}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginTop: space.m },
  face: { width: 80, height: 80, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.m },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.m, minHeight: 40 },
  why: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.m },
  stripTitle: { marginTop: space.l, marginBottom: space.s },
  tiles: { flexDirection: 'row', gap: space.s },
  tile: { flex: 1, borderRadius: radius.card, padding: space.m, minHeight: 104, justifyContent: 'space-between' },
  tileWide: { flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: space.m },
  facts: { gap: space.s, marginTop: space.s },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.m, minHeight: TAP },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: space.s },
  dayTrack: { width: 16, height: 88, borderRadius: radius.pill, backgroundColor: colors.line, justifyContent: 'flex-end', overflow: 'hidden' },
  dayFill: { width: '100%', borderRadius: radius.pill },
});
