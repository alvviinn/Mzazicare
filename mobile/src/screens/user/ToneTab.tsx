import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getLiveTone } from '../../api/client';
import { Icon, IconName, TONE_ICON } from '../../components/Icon';
import { TensionStrip, ToneCard, ToneChart } from '../../components/ToneChart';
import { Card, Empty, ErrorState, Loading, Ring, Section, StatusPill } from '../../components/ui';
import { fmtTime, timeAgo } from '../../format';
import { colors, fonts, iconSize, radius, spacing, text, toneColors, type } from '../../theme';
import { LiveTone } from '../../types';

const REFRESH_MS = 5000; // the chart follows the conversation: new speech shows within a few seconds

const STATE: Record<LiveTone['state'], { text: string; tone: 'sage' | 'butter' | 'quiet' }> = {
  live: { text: 'Live', tone: 'sage' },
  needs_consent: { text: 'Needs consent', tone: 'butter' },
  listening: { text: 'Listening', tone: 'butter' },
  idle: { text: 'Off', tone: 'quiet' },
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

  // The privacy promise stays, as one line read in full by screen readers.
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
        ? { icon: 'trending-up', label: `Tenser than usual · ${tense}% vs ${today.usual_tension}%`, color: colors.danger }
        : diff < -5
          ? { icon: 'trending-down', label: `Calmer than usual · ${tense}% vs ${today.usual_tension}%`, color: colors.sage }
          : { icon: 'trending-neutral', label: `As usual · ${tense}% tense`, color: colors.textMuted };
  }

  return (
    <>
      <Card tint={now ? 'sage' : 'surface'} raised>
        <View style={styles.heroTop}>
          <StatusPill label={st.text} tone={st.tone} live={data.state === 'live'} />
          <Text style={text.small}>{data.last_heard ? timeAgo(data.last_heard) : 'Nothing today'}</Text>
        </View>
        <View style={styles.hero}>
          <View style={styles.face}>
            <Icon name={now ? TONE_ICON[now.dominant] : 'microphone-outline'} size={56} color={now ? toneColors[now.dominant] : colors.borderStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.h1, { textTransform: 'capitalize' }]}>{now ? now.dominant : 'Quiet'}</Text>
            {now && <Text style={text.small}>{now.tension}% tense · last 5 min</Text>}
          </View>
        </View>
        {now && (now.by_source.caretaker || now.by_source.elderly) && (
          <View style={styles.sources}>
            {(['caretaker', 'elderly'] as const).map((who) => {
              const s = now.by_source[who];
              return s ? (
                <View key={who} style={styles.source}>
                  <Icon name={TONE_ICON[s.dominant]} size={20} color={toneColors[s.dominant]} />
                  <Text style={[text.smallStrong, { textTransform: 'capitalize' }]}>
                    {who === 'caretaker' ? 'Carer' : 'Elder'} · {s.dominant}
                  </Text>
                </View>
              ) : null;
            })}
          </View>
        )}
        <View style={styles.why}>
          <Icon name="shield-lock-outline" size={16} color={colors.textMuted} />
          <Text style={[text.small, { flex: 1 }]}>{why}</Text>
        </View>
      </Card>

      <Section title="Through the day" />
      {data.series.length === 0 ? (
        <Empty icon="chart-bar" title="No speech yet" body="Fills in during today's visit." />
      ) : (
        <Card>
          <ToneChart points={data.series} bucketMinutes={data.bucket_minutes} />
          <Text style={[text.smallStrong, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>Tension</Text>
          <TensionStrip points={data.series} bucketMinutes={data.bucket_minutes} />
        </Card>
      )}

      {today && (
        <>
          <Section title="Today" />
          <View style={styles.tiles}>
            <View style={[styles.tile, { backgroundColor: colors.sageSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.ms, flex: 1.4 }]}>
              <Ring value={today.positive_percent ?? 0} total={100} size={60} stroke={7} color={colors.sage} track={colors.surface}>
                <Text style={styles.ringText}>{today.positive_percent ?? 0}%</Text>
              </Ring>
              <Text style={[text.smallStrong, { flex: 1, color: colors.sage }]}>Happy or calm</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: colors.butter }]} accessible accessibilityLabel={`${today.speech_minutes} minutes of speech heard`}>
              <Text style={styles.tileNum}>{today.speech_minutes}</Text>
              <Text style={[text.small, { color: colors.butterInk }]}>min heard</Text>
            </View>
          </View>
          <View style={[styles.tiles, { marginTop: spacing.ms }]}>
            <Moment icon="weather-sunny" label="Calmest" time={fmtTime(today.calmest.start)} pct={today.calmest.tension} />
            <Moment icon="weather-lightning" label="Tensest" time={fmtTime(today.tensest.start)} pct={today.tensest.tension} />
          </View>

          <View style={styles.facts}>
            {compare && (
              <View style={styles.fact}>
                <Icon name={compare.icon} size={iconSize.inline} color={compare.color} />
                <Text style={[text.smallStrong, { flex: 1 }]}>{compare.label}</Text>
              </View>
            )}
            <View style={styles.fact}>
              <Icon
                name={today.raised_voice_clips ? 'volume-high' : 'volume-low'}
                size={iconSize.inline}
                color={today.raised_voice_clips ? colors.danger : colors.sage}
              />
              <Text style={[text.smallStrong, { flex: 1 }]}>
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
            <View style={styles.days} accessible accessibilityLabel={`How tense each day was: ${data.earlier_days.map((d) => `${weekday(d.date)} ${d.tension}%`).join(', ')}. Lower is calmer.`}>
              {data.earlier_days.map((d) => (
                <View key={d.date} style={styles.day}>
                  <Text style={text.caption}>{d.tension}%</Text>
                  <View style={styles.dayTrack}>
                    <View
                      style={[
                        styles.dayFill,
                        {
                          height: `${Math.max(4, d.tension)}%`,
                          backgroundColor: d.tension <= 15 ? colors.sage : d.tension <= 30 ? toneColors.stressed : colors.danger,
                        },
                      ]}
                    />
                  </View>
                  <Text style={text.caption}>{weekday(d.date)}</Text>
                </View>
              ))}
            </View>
            <Text style={[text.small, { marginTop: spacing.sm }]}>% tense · lower is calmer</Text>
          </Card>
        </>
      )}
    </>
  );
}

function Moment({ icon, label, time, pct }: { icon: IconName; label: string; time: string; pct: number }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface }]} accessible accessibilityLabel={`${label} time ${time}, ${pct}% tense`}>
      <Icon name={icon} size={iconSize.inline} color={colors.textMuted} />
      <Text style={styles.tileNum}>{time}</Text>
      <Text style={text.small}>
        {label} · {pct}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  face: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.ms, paddingVertical: 6 },
  why: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.ms },
  tile: { flex: 1, borderRadius: radius.lg, padding: spacing.md, minHeight: 96, justifyContent: 'space-between' },
  tileNum: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.text },
  ringText: { fontFamily: fonts.display, fontSize: type.small, color: colors.text },
  facts: { gap: spacing.sm, marginTop: spacing.ms },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 44 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: 4 },
  dayTrack: { width: 18, height: 84, borderRadius: 9, backgroundColor: colors.sunken, justifyContent: 'flex-end', overflow: 'hidden' },
  dayFill: { width: '100%', borderRadius: 9 },
});
