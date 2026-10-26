import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtTime } from '../format';
import { colors, radius, spacing, toneColors } from '../theme';
import { Tone, TonePoint } from '../types';

const ORDER: Tone[] = ['angry', 'stressed', 'neutral', 'calm', 'happy']; // tense at the bottom, happy on top
const HEIGHT = 120;
const LABELS: Record<Tone, string> = { happy: 'Happy', calm: 'Calm', neutral: 'Neutral', stressed: 'Stressed', angry: 'Angry' };

// How the voices sounded through the day: one column per time bucket, split by tone. Tap a column for its numbers.
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
  const tick = Math.max(1, Math.ceil(slots / 4));

  return (
    <View>
      <View style={styles.plot}>
        {Array.from({ length: slots }, (_, i) => {
          const p = byslot.get(i);
          const on = p === selected;
          return (
            <Pressable key={i} style={styles.slot} onPress={() => p && setPicked(i)} hitSlop={{ top: 4, bottom: 4 }}>
              <View style={[styles.column, on && styles.columnOn]}>
                {p
                  ? ORDER.map((t) =>
                      p.shares[t] > 0 ? (
                        <View key={t} style={{ height: (HEIGHT * p.shares[t]) / 100, backgroundColor: toneColors[t] }} />
                      ) : null,
                    )
                  : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {Array.from({ length: slots }, (_, i) => (
          <View key={i} style={styles.slot}>
            {i % tick === 0 && (
              <Text numberOfLines={1} style={styles.tick}>
                {fmtTime(new Date(first + i * step).toISOString())}
              </Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        {[...ORDER].reverse().map((t) => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: toneColors[t] }]} />
            <Text style={styles.legendText}>{LABELS[t]}</Text>
          </View>
        ))}
      </View>

      {selected && (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>
            {fmtTime(selected.start)} · mostly {LABELS[selected.dominant].toLowerCase()}
          </Text>
          <Text style={styles.detailText}>
            {ORDER.slice()
              .reverse()
              .filter((t) => selected.shares[t] > 0)
              .map((t) => `${LABELS[t]} ${selected.shares[t]}%`)
              .join(' · ')}
          </Text>
          <Text style={styles.detailText}>{Math.max(1, Math.round(selected.speech_s / 60))} min of speech</Text>
        </View>
      )}
    </View>
  );
}

// A small bar per bucket: how tense the voices were (stressed + angry). Easier to read than the colours for "is it getting worse?".
export function TensionStrip({ points, bucketMinutes }: { points: TonePoint[]; bucketMinutes: number }) {
  if (!points.length) return null;
  const step = bucketMinutes * 60000;
  const first = new Date(points[0].start).getTime();
  const last = new Date(points[points.length - 1].start).getTime();
  const slots = Math.min(96, Math.round((last - first) / step) + 1);
  const byslot = new Map(points.map((p) => [Math.round((new Date(p.start).getTime() - first) / step), p]));
  const H = 56;
  return (
    <View>
      <View style={[styles.plot, { height: H, backgroundColor: colors.background, borderRadius: radius.md }]}>
        <View style={[styles.guide, { bottom: (H * 30) / 100 }]} />
        {Array.from({ length: slots }, (_, i) => {
          const p = byslot.get(i);
          const t = p ? p.tension : 0;
          return (
            <View key={i} style={[styles.slot, { justifyContent: 'flex-end' }]}>
              {p && (
                <View
                  style={{
                    height: Math.max(3, (H * t) / 100),
                    marginHorizontal: 1,
                    borderRadius: 2,
                    backgroundColor: t <= 15 ? colors.success : t <= 30 ? colors.warning : colors.danger,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.detailText}>Share of stressed or angry speech. Above the line (30%) needs a look.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', height: HEIGHT, alignItems: 'flex-end' },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  column: { marginHorizontal: 1, borderRadius: 3, overflow: 'hidden', backgroundColor: 'transparent', opacity: 0.85 },
  columnOn: { opacity: 1 },
  guide: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.warning, opacity: 0.6 },
  axis: { flexDirection: 'row', marginTop: 4 },
  tick: { fontSize: 10, color: colors.textMuted, width: 60 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
  legendText: { fontSize: 12, color: colors.textMuted },
  detail: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.background },
  detailTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  detailText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
