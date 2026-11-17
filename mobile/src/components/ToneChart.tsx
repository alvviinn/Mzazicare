import { useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { fmtTime } from '../format';
import { colors, icon, radius, space, text, toneColors } from '../theme';
import { Dashboard, Tone, TonePoint } from '../types';
import { Icon, TONE_ICON } from './Icon';
import { Card, haptic, PillTone, StatusPill } from './ui';

// Each tone in its own colour (green happy, light green calm, grey neutral, amber stressed, red angry),
// stacked with angry at the bottom and happy on top. The exact shares are also written next to the chart.
const LABELS: Record<Tone, string> = { happy: 'Happy', calm: 'Calm', neutral: 'Neutral', stressed: 'Stressed', angry: 'Angry' };
const BANDS: { key: Tone; label: string; color: string; tones: Tone[] }[] = (['angry', 'stressed', 'neutral', 'calm', 'happy'] as Tone[]).map(
  (t) => ({ key: t, label: LABELS[t], color: toneColors[t], tones: [t] }),
);
const HEIGHT = 168; // bars plus the room for the ink mark under them
const MARK_ROOM = 12;
const LINE = 30; // stressed + angry above 30% needs a look
const band = (shares: Record<Tone, number>, b: (typeof BANDS)[number]) => b.tones.reduce((n, t) => n + (shares[t] ?? 0), 0);

// The five tone colours, happy first. With `shares`, each also carries its percentage (empty ones left out).
function Legend({ shares }: { shares?: Record<Tone, number> }) {
  return (
    <View style={styles.legend}>
      {[...BANDS]
        .reverse()
        .filter((b) => !shares || band(shares, b) > 0)
        .map((b) => (
          <View key={b.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: b.color }]} />
            <Text style={text.caption}>
              {b.label}
              {shares ? <Text style={text.captionStrong}>{` ${band(shares, b)}%`}</Text> : null}
            </Text>
          </View>
        ))}
    </View>
  );
}

// How the voices sounded through the day: one bar per time bucket, each tone in its own colour (angry at the bottom,
// happy on top). The red and amber at the bottom are the tension, so the dashed line marks 30%: a bar whose red and
// amber reach above it needs a look. Touch a bar, or slide along them, to read it; the picked bar gets an ink mark.
export function ToneChart({ points, bucketMinutes }: { points: TonePoint[]; bucketMinutes: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  if (!points.length) return null;

  const step = bucketMinutes * 60000;
  const first = new Date(points[0].start).getTime();
  const last = new Date(points[points.length - 1].start).getTime();
  const slots = Math.min(96, Math.round((last - first) / step) + 1);
  const byslot = new Map(points.map((p) => [Math.round((new Date(p.start).getTime() - first) / step), p]));
  const present = [...byslot.keys()].sort((a, b) => a - b);
  const cur = picked !== null && byslot.has(picked) ? picked : present[present.length - 1];
  const selected = byslot.get(cur)!;
  const dense = slots > 30;

  const pick = (e: GestureResponderEvent) => {
    if (!width) return;
    const slot = Math.max(0, Math.min(slots - 1, Math.floor((e.nativeEvent.locationX / width) * slots)));
    let best = present[0];
    for (const i of present) if (Math.abs(i - slot) < Math.abs(best - slot)) best = i;
    if (best !== cur) {
      haptic.tap();
      setPicked(best);
    }
  };

  return (
    <View>
      <View
        style={[styles.plot, { gap: dense ? 2 : 4 }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        // a touch picks the nearest bar and sliding moves it; a vertical swipe still scrolls the screen
        onStartShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderTerminationRequest={() => true}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Voice tone through the day"
        accessibilityValue={{ text: `${fmtTime(selected.start)}: mostly ${LABELS[selected.dominant].toLowerCase()}, ${selected.tension}% tense` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const k = present.indexOf(cur);
          if (e.nativeEvent.actionName === 'increment' && k < present.length - 1) setPicked(present[k + 1]);
          if (e.nativeEvent.actionName === 'decrement' && k > 0) setPicked(present[k - 1]);
        }}
      >
        {Array.from({ length: slots }, (_, i) => {
          const p = byslot.get(i);
          return (
            <View key={i} style={styles.slot} pointerEvents="none">
              {p ? (
                <View style={[styles.column, dense && styles.columnDense]}>
                  {/* angry first, so it sits at the bottom; a 1 or 2 % share still shows as a clean stripe */}
                  {BANDS.map((b) => {
                    const v = band(p.shares, b);
                    return v > 0 ? <View key={b.key} style={{ flexGrow: v, flexBasis: 0, minHeight: dense ? 2 : 3, backgroundColor: b.color }} /> : null;
                  })}
                </View>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <View style={[styles.mark, i === cur && { backgroundColor: colors.ink }]} />
            </View>
          );
        })}
        {/* the 30% line, measured from the bottom of the bars */}
        <View style={[styles.guide, { bottom: MARK_ROOM + ((HEIGHT - MARK_ROOM) * LINE) / 100 }]} pointerEvents="none">
          <View style={styles.guideLabel}>
            <Text style={text.captionStrong}>30% tense</Text>
          </View>
        </View>
      </View>
      {/* start, middle and end times: never truncated, however many bars there are */}
      <View style={styles.axis}>
        {(slots > 2 ? [0, Math.floor((slots - 1) / 2), slots - 1] : [0, slots - 1]).map((i, k) => (
          <Text key={k} style={text.caption}>
            {fmtTime(new Date(first + i * step).toISOString())}
          </Text>
        ))}
      </View>
      <Legend />

      <View style={styles.detail}>
        <Icon name={TONE_ICON[selected.dominant]} size={icon.l} />
        <View style={{ flex: 1 }}>
          <Text style={text.captionStrong}>
            {fmtTime(selected.start)} · {LABELS[selected.dominant]}
          </Text>
          <Text style={text.caption}>
            <Text style={text.captionStrong}>{selected.tension}% tense</Text>
            {' · '}
            {(['happy', 'calm', 'neutral', 'stressed', 'angry'] as Tone[])
              .filter((t) => selected.shares[t] > 0)
              .map((t) => `${LABELS[t]} ${selected.shares[t]}%`)
              .join(' · ')}
          </Text>
        </View>
        <Text style={text.caption}>{Math.max(1, Math.round(selected.speech_s / 60))} min</Text>
      </View>
      <Text style={[text.caption, { marginTop: space.s }]}>Red and amber at the bottom of a bar are tense speech. Above the dashed line (30%) needs a look.</Text>
    </View>
  );
}
const QUALITY: Record<string, { text: string; tone: PillTone }> = {
  good: { text: 'Good', tone: 'success' },
  fair: { text: 'Fair', tone: 'ink' },
  needs_attention: { text: 'Needs attention', tone: 'error' },
};

// The tone mix as one stacked bar with the dominant face, and every tone's share in the legend under it.
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
      <Legend shares={shares} />
    </Card>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', height: HEIGHT },
  slot: { flex: 1 },
  // rounded tops, nearly square feet (a thin bottom stripe stays a stripe); 2 px of white between tones
  column: { flex: 1, gap: 2, flexDirection: 'column-reverse', borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden' },
  columnDense: { gap: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  mark: { height: 4, marginTop: MARK_ROOM - 4, marginHorizontal: '15%', borderRadius: radius.pill },
  guide: { position: 'absolute', left: -4, right: -4, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, zIndex: 1 },
  guideLabel: { position: 'absolute', right: 4, bottom: 4, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: colors.surface },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.s },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.m, rowGap: space.s, marginTop: space.s },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  swatch: { width: 12, height: 12, borderRadius: 4 },
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
  stack: { flexDirection: 'row', height: 16, borderRadius: radius.pill, overflow: 'hidden', marginTop: space.m, gap: 2 },
});
