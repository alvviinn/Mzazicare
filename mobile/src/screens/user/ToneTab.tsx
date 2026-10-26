import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getLiveTone } from '../../api/client';
import { SectionTitle } from '../../components/HomeShell';
import { Icon, TONE_ICON } from '../../components/Icon';
import { TensionStrip, ToneChart } from '../../components/ToneChart';
import { Card } from '../../components/ui';
import { fmtTime, timeAgo } from '../../format';
import { colors, radius, spacing, toneColors } from '../../theme';
import { LiveTone } from '../../types';
import { ToneCard } from './Overview';

const REFRESH_MS = 5000; // the chart follows the conversation: new speech shows within a few seconds

const STATE: Record<LiveTone['state'], { text: string; color: string; bg: string }> = {
  live: { text: 'Live', color: colors.success, bg: colors.primarySoft },
  listening: { text: 'Listening', color: colors.warning, bg: colors.warningSoft },
  idle: { text: 'Not listening', color: colors.textMuted, bg: colors.background },
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

  if (!data) return <Text style={styles.muted}>{error || 'Loading…'}</Text>;
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
      <SectionTitle>Right now</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Icon
            name={now ? TONE_ICON[now.dominant] : 'microphone-outline'}
            size={46}
            color={now ? toneColors[now.dominant] : colors.border}
          />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.title}>{now ? `Sounds ${now.dominant}` : 'No speech heard lately'}</Text>
            <Text style={styles.small}>
              {data.last_heard ? `Last heard ${timeAgo(data.last_heard)}` : 'Nothing heard yet today'}
              {now ? ` · ${now.tension}% tense` : ''}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: st.bg }]}>
            <Text style={[styles.pillText, { color: st.color }]}>{st.text}</Text>
          </View>
        </View>
        <Text style={styles.hint}>
          {data.state === 'idle'
            ? 'The voice tone is only listened to while the caretaker is with your loved one. Recordings are never kept, only the tone.'
            : 'Updates every few seconds while they talk. Only the tone is kept, never the recording.'}
        </Text>
      </Card>

      <SectionTitle>Tone through the day</SectionTitle>
      <Card>
        {data.series.length === 0 ? (
          <Text style={styles.muted}>The chart fills in as the caretaker and your loved one talk during today's shift.</Text>
        ) : (
          <>
            <ToneChart points={data.series} bucketMinutes={data.bucket_minutes} />
            <Text style={styles.label}>Tension through the day</Text>
            <TensionStrip points={data.series} bucketMinutes={data.bucket_minutes} />
          </>
        )}
      </Card>

      {today && (
        <>
          <SectionTitle>Today in numbers</SectionTitle>
          <View style={styles.tiles}>
            <Tile value={`${today.speech_minutes}`} label="Minutes of speech heard" />
            <Tile value={`${today.positive_percent}%`} label="Happy or calm" />
          </View>
          <View style={[styles.tiles, { marginTop: spacing.sm, marginBottom: spacing.sm }]}>
            <Tile value={fmtTime(today.calmest.start)} label={`Calmest time (${today.calmest.tension}% tense)`} />
            <Tile value={fmtTime(today.tensest.start)} label={`Most tense time (${today.tensest.tension}% tense)`} />
          </View>
          <Card>
            <Text style={styles.line}>{comparison}</Text>
            <Text style={styles.line}>
              {today.raised_voice_clips === 0
                ? 'No raised voices picked up today.'
                : `Raised voices were picked up in ${today.raised_voice_clips} recording${today.raised_voice_clips === 1 ? '' : 's'}` +
                  (today.vocal_alerts
                    ? ` and ${today.vocal_alerts} alert${today.vocal_alerts === 1 ? ' was' : 's were'} raised for you to review.`
                    : '.')}
            </Text>
          </Card>

          <SectionTitle>Today's mix</SectionTitle>
          <ToneCard tones={today} period="today" />
        </>
      )}

      {data.earlier_days.length > 0 && (
        <>
          <SectionTitle>Previous days</SectionTitle>
          <Card>
            <View style={styles.days}>
              {data.earlier_days.map((d) => (
                <View key={d.date} style={styles.day}>
                  <View style={styles.dayTrack}>
                    <View
                      style={[
                        styles.dayFill,
                        {
                          height: `${Math.max(4, d.tension)}%`,
                          backgroundColor: d.tension <= 15 ? colors.success : d.tension <= 30 ? colors.warning : colors.danger,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.dayPct}>{d.tension}%</Text>
                  <Text style={styles.dayName}>{weekday(d.date)}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.hint}>How tense the voices sounded each day (stressed or angry). Lower is calmer.</Text>
          </Card>
        </>
      )}
    </>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  small: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  pill: { borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tileValue: { fontSize: 22, fontWeight: '700', color: colors.primary },
  tileLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  line: { fontSize: 14, color: colors.text, marginBottom: spacing.xs },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center' },
  dayTrack: {
    width: 18,
    height: 80,
    borderRadius: 6,
    backgroundColor: colors.background,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  dayFill: { width: '100%', borderRadius: 6 },
  dayPct: { fontSize: 11, color: colors.text, marginTop: 4 },
  dayName: { fontSize: 11, color: colors.textMuted },
});
