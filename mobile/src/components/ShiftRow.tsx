import { useRef } from 'react';
import { Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { fmtDuration, fmtShiftDay, fmtTime } from '../format';
import { colors, fonts, radius, spacing, TAP, text, type } from '../theme';
import { ShiftStatus, ShiftSummary } from '../types';
import { Icon } from './Icon';
import { haptic, StatusPill } from './ui';

export const STATUS_LABEL: Record<ShiftStatus, { text: string; tone: 'sage' | 'butter' | 'quiet'; color: string; bg: string }> = {
  on_shift: { text: 'On shift', tone: 'sage', color: colors.sage, bg: colors.sageSoft },
  paused: { text: 'On a break', tone: 'butter', color: colors.butterInk, bg: colors.butter },
  away: { text: 'Away', tone: 'butter', color: colors.butterInk, bg: colors.butter },
  waiting: { text: 'Not arrived', tone: 'quiet', color: colors.textMuted, bg: colors.sunken },
  ended: { text: 'Finished', tone: 'quiet', color: colors.textMuted, bg: colors.sunken },
};

const parseDay = (date: string) => new Date(`${date}T12:00:00`);

type Props = { shift: ShiftSummary; showCaretaker?: boolean; first?: boolean; onPress: () => void };

// One day's shift: a date block, the times, and the active time as the big figure.
export function ShiftRow({ shift: s, showCaretaker, first, onPress }: Props) {
  const st = STATUS_LABEL[s.status];
  const d = parseDay(s.date);
  const live = s.status === 'on_shift' || s.status === 'paused' || s.status === 'away';
  const times = s.arrived ? `${fmtTime(s.arrived)} – ${s.end ? fmtTime(s.end) : s.left ? fmtTime(s.left) : 'now'}` : st.text;
  const sub = [showCaretaker ? s.caretaker : null, times, s.breaks > 0 ? `${s.breaks} break${s.breaks === 1 ? '' : 's'}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.line, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={`${fmtShiftDay(s.date)}${showCaretaker ? `, ${s.caretaker}` : ''}. ${st.text}. ${times}. Active ${fmtDuration(s.minutes)}${s.chores_total ? `. ${s.chores_done} of ${s.chores_total} chores` : ''}`}
      accessibilityHint="Opens the shift timeline"
    >
      <View style={[styles.date, live && { backgroundColor: colors.sageSoft }]}>
        <Text style={[styles.dateNum, live && { color: colors.sage }]}>{d.getDate()}</Text>
        <Text style={styles.dateDay}>{d.toLocaleDateString([], { weekday: 'short' })}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={text.bodyStrong} numberOfLines={1}>
          {fmtShiftDay(s.date)}
        </Text>
        <Text style={text.small} numberOfLines={1}>
          {sub}
        </Text>
        {live && (
          <View style={{ marginTop: 4 }}>
            <StatusPill label={st.text} tone={st.tone} live={s.status === 'on_shift'} />
          </View>
        )}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.mins}>{fmtDuration(s.minutes)}</Text>
        {s.chores_total > 0 && (
          <View style={styles.chores}>
            <Icon name="check-circle-outline" size={14} color={colors.textMuted} />
            <Text style={text.caption}>
              {s.chores_done}/{s.chores_total}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// A horizontal strip of recent days: one bar per day, height = active time. Tap a day to open it.
export function DayStrip({ shifts, days = 14, onOpen }: { shifts: ShiftSummary[]; days?: number; onOpen: (id: number) => void }) {
  const scroll = useRef<ScrollViewInstance>(null);
  const byDate = new Map<string, { minutes: number; id: number; live: boolean }>();
  for (const s of shifts) {
    const cur = byDate.get(s.date);
    const live = s.status === 'on_shift';
    byDate.set(s.date, cur ? { minutes: cur.minutes + s.minutes, id: cur.id, live: cur.live || live } : { minutes: s.minutes, id: s.id, live });
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
        const h = entry ? Math.max(8, (72 * entry.minutes) / max) : 0;
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
            style={[styles.day, isToday && styles.dayToday]}
            accessibilityRole={entry ? 'button' : undefined}
            accessibilityLabel={entry ? `${label}: ${fmtDuration(entry.minutes)} active` : `${label}: no shift`}
          >
            <Text style={[styles.dayVal, !entry && { color: colors.textDisabled }]} numberOfLines={1}>
              {entry ? short(entry.minutes) : '–'}
            </Text>
            <View style={styles.track}>
              {entry && <View style={[styles.fill, { height: h, backgroundColor: entry.live ? colors.sage : colors.primary }]} />}
            </View>
            <Text style={[styles.dayName, isToday && { color: colors.text }]}>{d.toLocaleDateString([], { weekday: 'narrow' })}</Text>
            <Text style={[styles.dayNum, isToday && { color: colors.text }]}>{d.getDate()}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, minHeight: TAP + 20, paddingVertical: spacing.ms },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  date: { width: 52, height: 56, borderRadius: radius.md, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' },
  dateNum: { fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: colors.text },
  dateDay: { ...text.caption },
  mins: { fontFamily: fonts.display, fontSize: type.body + 1, color: colors.text },
  chores: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },

  strip: { gap: spacing.xs, paddingVertical: spacing.xs },
  day: { width: 44, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
  dayToday: { backgroundColor: colors.surface },
  dayVal: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.text, marginBottom: 4 },
  track: { width: 14, height: 72, borderRadius: 7, backgroundColor: colors.sunken, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', borderRadius: 7 },
  dayName: { ...text.caption, marginTop: 6 },
  dayNum: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.textMuted },
});
