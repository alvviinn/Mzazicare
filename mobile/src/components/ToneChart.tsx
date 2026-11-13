import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtTime } from '../format';
import { colors, icon, radius, space, text } from '../theme';
import { Dashboard, Tone, TonePoint } from '../types';
import { Icon, TONE_ICON } from './Icon';
import { Card, haptic, PillTone, StatusPill } from './ui';

// Charts use only cobalt, cornflower and their tints, so the five tones are drawn as three bands.
// The exact share of each tone is always written next to the chart (legend and the tapped column).
type Band = 'positive' | 'neutral' | 'tense';
const BANDS: { key: Band; label: string; color: string; tones: Tone[] }[] = [
  { key: 'tense', label: 'Tense', color: colors.secondary, tones: ['angry', 'stressed'] },
  { key: 'neutral', label: 'Neutral', color: colors.secondaryTint, tones: ['neutral'] },
  { key: 'positive', label: 'Happy or calm', color: colors.primary, tones: ['calm', 'happy'] },
];
const LABELS: Record<Tone, string> = { happy: 'Happy', calm: 'Calm', neutral: 'Neutral', stressed: 'Stressed', angry: 'Angry' };
const HEIGHT = 120;
const band = (shares: Record<Tone, number>, b: (typeof BANDS)[number]) => b.tones.reduce((n, t) => n + (shares[t] ?? 0), 0);

function Legend() {
  return (
    <View style={styles.legend}>
      {[...BANDS].reverse().map((b) => (
        <View key={b.key} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: b.color }]} />
          <Text style={text.caption}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

// How the voices sounded through the day: one column per time bucket. Tap a column for its numbers.
export function ToneChart({ points, bucketMinutes }: { points: TonePoint[]; bucketMinutes: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  if (!points.length) return null;

  // one slot for every bucket between the first and last one, so quiet stretches show as gaps
  const step = bucketMinutes * 60000;
  const first = new Date(points[0].start).getTime();
  const last = new Date(points[points.length - 1].start).getTime();
  const slots = Math.min(96, Math.round((last - first) / step) + 1);
  const byslot = new Map(points.map((p) => [Math.round((new Date(p.start).getTime() - first) / step), p]));
  const selected = picked !== null ? byslot.get(picked) : points[points.length - 1];

  return (
    <View>
      <View style={styles.plot}>
        {Array.from({ length: slots }, (_, i) => {
          const p = byslot.get(i);
          const sel = p === selected;
          return (
            <Pressable
              key={i}
              style={styles.slot}
              onPress={() => {
                if (!p) return;
                haptic.tap();
                setPicked(i);
              }}
              hitSlop={{ top: space.s, bottom: space.s }}
              accessibilityRole={p ? 'button' : undefined}
              accessibilityLabel={p ? `${fmtTime(p.start)}: mostly ${LABELS[p.dominant]}` : undefined}
            >
              <View style={[styles.column, { opacity: sel ? 1 : 0.6 }]}>
                {p ? BANDS.map((b) => <View key={b.key} style={{ height: (HEIGHT * band(p.shares, b)) / 100, backgroundColor: b.color }} />) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {/* start, middle and end times: never truncated, however many columns there are */}
      <View style={styles.axis}>
        {(slots > 2 ? [0, Math.floor((slots - 1) / 2), slots - 1] : [0, slots - 1]).map((i, k) => (
          <Text key={k} style={text.caption}>
            {fmtTime(new Date(first + i * step).toISOString())}
          </Text>
        ))}
      </View>
      <Legend />

      {selected && (
        <View style={styles.detail}>
          <Icon name={TONE_ICON[selected.dominant]} size={icon.l} />
          <View style={{ flex: 1 }}>
            <Text style={text.captionStrong}>
              {fmtTime(selected.start)} · {LABELS[selected.dominant]}
            </Text>
            <Text style={text.caption}>
              {(['happy', 'calm', 'neutral', 'stressed', 'angry'] as Tone[])
                .filter((t) => selected.shares[t] > 0)
                .map((t) => `${LABELS[t]} ${selected.shares[t]}%`)
                .join(' · ')}
            </Text>
          </View>
          <Text style={text.caption}>{Math.max(1, Math.round(selected.speech_s / 60))} min</Text>
        </View>
      )}
    </View>
  );
}

// A small bar per bucket: how tense the voices were. Cornflower above the 30% line, cobalt below.
export function TensionStrip({ points, bucketMinutes }: { points: TonePoint[]; bucketMinutes: number }) {
  if (!points.length) return null;
  const step = bucketMinutes * 60000;
  const first = new Date(points[0].start).getTime();
  const last = new Date(points[points.length - 1].start).getTime();
  const slots = Math.min(96, Math.round((last - first) / step) + 1);
  const byslot = new Map(points.map((p) => [Math.round((new Date(p.start).getTime() - first) / step), p]));
  const H = 56;
  return (
    <View accessible accessibilityLabel="How tense the voices sounded through the day. Above the line, 30 percent, needs a look.">
      <View style={[styles.plot, styles.strip, { height: H }]}>
        <View style={[styles.guide, { bottom: (H * 30) / 100 }]} />
        {Array.from({ length: slots }, (_, i) => {
          const p = byslot.get(i);
          const t = p ? p.tension : 0;
          return (
            <View key={i} style={[styles.slot, { justifyContent: 'flex-end' }]}>
              {p && <View style={[styles.bar, { height: Math.max(3, (H * t) / 100), backgroundColor: t > 30 ? colors.secondary : colors.primary }]} />}
            </View>
          );
        })}
      </View>
      <Text style={[text.caption, { marginTop: space.s }]}>Line = 30% tense</Text>
    </View>
  );
}

const QUALITY: Record<string, { text: string; tone: PillTone }> = {
  good: { text: 'Good', tone: 'success' },
  fair: { text: 'Fair', tone: 'ink' },
  needs_attention: { text: 'Needs attention', tone: 'error' },
};

// The tone mix as one stacked bar (three bands) with the dominant face, and every tone's share in the legend.
export function ToneCard({ tones, period = 'this week' }: { tones: Dashboard['tones']; period?: string }) {
  if (!tones.items.length || !tones.dominant) {
    return (
      <Card>
        <View style={styles.toneHead}>
          <View style={styles.toneFace}>
            <Icon name="waveform" size={icon.m} color={colors.inkMuted} />
          </View>
          <Text style={[text.caption, { flex: 1 }]}>No voices heard yet</Text>
        </View>
      </Card>
    );
  }
  const top = tones.items[0];
  const q = tones.quality ? QUALITY[tones.quality] : null;
  const shares = Object.fromEntries(tones.items.map((t) => [t.tone, t.percent])) as Record<Tone, number>;
  return (
    <Card>
      <View style={styles.toneHead}>
        <View style={styles.toneFace}>
          <Icon name={TONE_ICON[top.tone]} size={icon.l} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={text.heading}>Mostly {top.label.toLowerCase()}</Text>
          <Text style={text.caption}>
            {top.percent}% · {period}
          </Text>
        </View>
        {q && <StatusPill label={q.text} tone={q.tone} />}
      </View>
      <View style={styles.stack} accessible accessibilityLabel={tones.items.map((t) => `${t.label} ${t.percent}%`).join(', ')}>
        {[...BANDS].reverse().map((b) => {
          const v = band(shares, b);
          return v > 0 ? <View key={b.key} style={{ flex: v, backgroundColor: b.color }} /> : null;
        })}
      </View>
      <Text style={[text.caption, { marginTop: space.s }]}>{tones.items.map((t) => `${t.label} ${t.percent}%`).join(' · ')}</Text>
      <Legend />
    </Card>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', height: HEIGHT, alignItems: 'flex-end' },
  strip: { backgroundColor: colors.background, borderRadius: radius.small, overflow: 'hidden' },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.surface },
  column: { borderRadius: radius.small, overflow: 'hidden' },
  bar: { borderRadius: radius.pill },
  guide: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.inkMuted },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.s },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.m, rowGap: space.s, marginTop: space.s },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  swatch: { width: 16, height: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginTop: space.m,
    padding: space.m,
    borderRadius: radius.small,
    backgroundColor: colors.background,
  },
  toneHead: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  toneFace: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.secondaryTint, alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', height: 16, borderRadius: radius.pill, overflow: 'hidden', marginTop: space.m },
});
