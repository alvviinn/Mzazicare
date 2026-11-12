import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtTime } from '../format';
import { colors, fonts, radius, spacing, text, toneColors, type } from '../theme';
import { Dashboard, Tone, TonePoint } from '../types';
import { Icon, TONE_ICON } from './Icon';
import { Card, haptic, StatusPill } from './ui';

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

  return (
    <View>
      <View style={styles.plot}>
        {Array.from({ length: slots }, (_, i) => {
          const p = byslot.get(i);
          const on = p === selected;
          return (
            <Pressable
              key={i}
              style={styles.slot}
              onPress={() => {
                if (!p) return;
                haptic.tap();
                setPicked(i);
              }}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole={p ? 'button' : undefined}
              accessibilityLabel={p ? `${fmtTime(p.start)}: mostly ${LABELS[p.dominant]}` : undefined}
            >
              <View style={[styles.column, { opacity: on ? 1 : 0.55 }]}>
                {p
                  ? ORDER.map((t) =>
                      p.shares[t] > 0 ? <View key={t} style={{ height: (HEIGHT * p.shares[t]) / 100, backgroundColor: toneColors[t] }} /> : null,
                    )
                  : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {/* start, middle and end times: never truncated, however many columns there are */}
      <View style={styles.axis}>
        {(slots > 2 ? [0, Math.floor((slots - 1) / 2), slots - 1] : [0, slots - 1]).map((i, k) => (
          <Text key={k} style={styles.tick}>
            {fmtTime(new Date(first + i * step).toISOString())}
          </Text>
        ))}
      </View>

      <View style={styles.legend}>
        {[...ORDER].reverse().map((t) => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: toneColors[t] }]} />
            <Text style={text.caption}>{LABELS[t]}</Text>
          </View>
        ))}
      </View>

      {selected && (
        <View style={styles.detail}>
          <Icon name={TONE_ICON[selected.dominant]} size={28} color={toneColors[selected.dominant]} />
          <View style={{ flex: 1 }}>
            <Text style={text.smallStrong}>
              {fmtTime(selected.start)} · {LABELS[selected.dominant]}
            </Text>
            <Text style={text.small}>
              {ORDER.slice()
                .reverse()
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

// A small bar per bucket: how tense the voices were (stressed + angry).
export function TensionStrip({ points, bucketMinutes }: { points: TonePoint[]; bucketMinutes: number }) {
  if (!points.length) return null;
  const step = bucketMinutes * 60000;
  const first = new Date(points[0].start).getTime();
  const last = new Date(points[points.length - 1].start).getTime();
  const slots = Math.min(96, Math.round((last - first) / step) + 1);
  const byslot = new Map(points.map((p) => [Math.round((new Date(p.start).getTime() - first) / step), p]));
  const H = 56;
  return (
    <View accessible accessibilityLabel="Share of stressed or angry speech through the day. Above the line, 30 percent, needs a look.">
      <View style={[styles.plot, styles.strip, { height: H }]}>
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
                    backgroundColor: t <= 15 ? colors.sage : t <= 30 ? toneColors.stressed : colors.danger,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
      <Text style={[text.caption, { marginTop: 4 }]}>Line = 30% tense</Text>
    </View>
  );
}

const QUALITY: Record<string, { text: string; tone: 'sage' | 'butter' | 'danger' }> = {
  good: { text: 'Good', tone: 'sage' },
  fair: { text: 'Fair', tone: 'butter' },
  needs_attention: { text: 'Needs attention', tone: 'danger' },
};

// The tone mix as a single stacked bar with the dominant face on top.
export function ToneCard({ tones, period = 'this week' }: { tones: Dashboard['tones']; period?: string }) {
  if (!tones.items.length || !tones.dominant) {
    return (
      <Card>
        <View style={styles.toneHead}>
          <View style={styles.toneFace}>
            <Icon name="waveform" size={26} color={colors.textMuted} />
          </View>
          <Text style={[text.small, { flex: 1 }]}>No voices heard yet</Text>
        </View>
      </Card>
    );
  }
  const top = tones.items[0];
  const q = tones.quality ? QUALITY[tones.quality] : null;
  return (
    <Card>
      <View style={styles.toneHead}>
        <View style={styles.toneFace}>
          <Icon name={TONE_ICON[top.tone]} size={34} color={toneColors[top.tone]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={text.h2}>Mostly {top.label.toLowerCase()}</Text>
          <Text style={text.small}>
            {top.percent}% · {period}
          </Text>
        </View>
        {q && <StatusPill label={q.text} tone={q.tone} />}
      </View>
      <View style={styles.stack} accessible accessibilityLabel={tones.items.map((t) => `${t.label} ${t.percent}%`).join(', ')}>
        {tones.items
          .filter((t) => t.percent > 0)
          .map((t) => (
            <View key={t.tone} style={{ flex: t.percent, backgroundColor: toneColors[t.tone] }} />
          ))}
      </View>
      <View style={styles.legend}>
        {tones.items.map((t) => (
          <View key={t.tone} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: toneColors[t.tone] }]} />
            <Text style={text.caption}>
              {t.label} {t.percent}%
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', height: HEIGHT, alignItems: 'flex-end' },
  strip: { backgroundColor: colors.sunken, borderRadius: radius.sm },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  column: { marginHorizontal: 1, borderRadius: 4, overflow: 'hidden' },
  guide: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: toneColors.stressed },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  tick: { fontFamily: fonts.body, fontSize: type.caption, color: colors.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 4, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    marginTop: spacing.md,
    padding: spacing.ms,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
  },
  toneHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  toneFace: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: spacing.md, gap: 2 },
});
