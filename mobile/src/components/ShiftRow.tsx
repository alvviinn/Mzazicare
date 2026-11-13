import { useRef } from 'react';
import { Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { fmtDuration, fmtShiftDay, fmtTime } from '../format';
import { colors, icon, radius, space, TAP, text } from '../theme';
import { ShiftStatus, ShiftSummary } from '../types';
import { Icon } from './Icon';
import { haptic, PillTone, StatusPill } from './ui';

export const STATUS_LABEL: Record<ShiftStatus, { text: string; tone: PillTone }> = {
  on_shift: { text: 'On shift', tone: 'success' },
  paused: { text: 'On a break', tone: 'ink' },
  away: { text: 'Away', tone: 'ink' },
  waiting: { text: 'Not arrived', tone: 'muted' },
  ended: { text: 'Finished', tone: 'muted' },
};

const parseDay = (date: string) => new Date(`${date}T12:00:00`);

type Props = { shift: ShiftSummary; showCaretaker?: boolean; first?: boolean; onPress: () => void };

// One day's shift: a date block, the times, and the active time as the figure on the right.
export function ShiftRow({ shift: s, showCaretaker, first, onPress }: Props) {
  const st = STATUS_LABEL[s.status];
  const d = parseDay(s.date);
  const live = s.status === 'on_shift' || s.status === 'paused' || s.status === 'away';
  const times = s.arrived ? `${fmtTime(s.arrived)} – ${s.end ? fmtTime(s.end) : s.left ? fmtTime(s.left) : 'now'}` : st.text;
  const sub = [showCaretaker ? s.caretaker.split(' ')[0] : null, times, s.breaks > 0 ? `${s.breaks} break${s.breaks === 1 ? '' : 's'}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.line, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={`${fmtShiftDay(s.date)}${showCaretaker ? `, ${s.caretaker}` : ''}. ${st.text}. ${times}. Active ${fmtDuration(s.minutes)}${s.chores_total ? `. ${s.chores_done} of ${s.chores_total} tasks` : ''}`}
      accessibilityHint="Opens the shift timeline"
    >
      <View style={[styles.date, { backgroundColor: live ? colors.primaryTint : colors.secondaryTint }]}>
        <Text style={text.heading}>{d.getDate()}</Text>
        <Text style={text.captionInk}>{d.toLocaleDateString([], { weekday: 'short' })}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={text.bodyStrong} numberOfLines={1}>
          {fmtShiftDay(s.date)}
        </Text>
        <Text style={text.caption} numberOfLines={1}>
          {sub}
        </Text>
        {live && (
          <View style={{ marginTop: space.s }}>
            <StatusPill label={st.text} tone={st.tone} />
          </View>
        )}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={text.bodyStrong}>{fmtDuration(s.minutes)}</Text>
        {s.chores_total > 0 && (
          <View style={styles.chores}>
            <Icon name="chores" size={icon.xs} color={colors.inkMuted} />
            <Text style={text.caption}>
              {s.chores_done}/{s.chores_total}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// A horizontal strip of recent days: one cobalt bar per day, the hours printed above it. Tap a day to open it.
export function DayStrip({ shifts, days = 14, onOpen }: { shifts: ShiftSummary[]; days?: number; onOpen: (id: number) => void }) {
  const scroll = useRef<ScrollViewInstance>(null);
  const byDate = new Map<string, { minutes: number; id: number }>();
  for (const s of shifts) {
    const cur = byDate.get(s.date);
    byDate.set(s.date, cur ? { minutes: cur.minutes + s.minutes, id: cur.id } : { minutes: s.minutes, id: s.id });
  }
  const today = new Date();
  const list = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getTime() - (days - 1 - i) * 86400000);
    const p = (n: number) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    return { key, d, entry: byDate.get(key) };
  });
  const max = Math.max(60, ...list.map((x) => x.entry?.minutes ?? 0));

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
    >
      {list.map(({ key, d, entry }, i) => {
        const isToday = i === list.length - 1;
        const h = entry ? Math.max(space.s, (72 * entry.minutes) / max) : 0;
        const label = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
        return (
          <Pressable
            key={key}
            disabled={!entry}
            onPress={() => {
              if (!entry) return;
              haptic.tap();
              onOpen(entry.id);
            }}
            style={[styles.day, isToday && { backgroundColor: colors.surface }]}
            accessibilityRole={entry ? 'button' : undefined}
            accessibilityLabel={entry ? `${label}: ${fmtDuration(entry.minutes)} active` : `${label}: no shift`}
          >
            <Text style={entry ? text.captionStrong : text.caption} numberOfLines={1}>
              {entry ? short(entry.minutes) : '–'}
            </Text>
            <View style={styles.track}>{entry && <View style={[styles.fill, { height: h }]} />}</View>
            <Text style={[text.caption, isToday && { color: colors.ink }]}>{d.toLocaleDateString([], { weekday: 'narrow' })}</Text>
            <Text style={isToday ? text.captionStrong : text.caption}>{d.getDate()}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// "3h", "45m" for tight spaces.
function short(min: number) {
  if (min < 60) return `${min}m`;
  const h = min / 60;
  return `${h >= 10 ? Math.round(h) : Math.round(h * 10) / 10}h`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TAP + space.l, paddingVertical: space.s },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  date: { width: 56, height: 56, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center' },
  chores: { flexDirection: 'row', alignItems: 'center', gap: space.s },

  strip: { gap: space.s, paddingVertical: space.s },
  day: { width: 48, alignItems: 'center', gap: space.s, paddingVertical: space.s, borderRadius: radius.small },
  track: { width: 16, height: 72, borderRadius: radius.pill, backgroundColor: colors.line, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
});
