import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtDuration, fmtShiftDay, fmtTime } from '../format';
import { colors, radius, spacing } from '../theme';
import { ShiftStatus, ShiftSummary } from '../types';
import { Icon } from './Icon';

export const STATUS_LABEL: Record<ShiftStatus, { text: string; color: string; bg: string }> = {
  on_shift: { text: 'On shift', color: colors.success, bg: colors.primarySoft },
  paused: { text: 'On a break', color: colors.warning, bg: colors.warningSoft },
  away: { text: 'Away', color: colors.warning, bg: colors.warningSoft },
  waiting: { text: 'Not arrived', color: colors.textMuted, bg: colors.background },
  ended: { text: 'Finished', color: colors.textMuted, bg: colors.background },
};

type Props = { shift: ShiftSummary; showCaretaker?: boolean; first?: boolean; onPress: () => void };

// One day's shift in a list. Tap to see the arrivals, breaks and departures.
export function ShiftRow({ shift: s, showCaretaker, first, onPress }: Props) {
  const st = STATUS_LABEL[s.status];
  const times = s.arrived
    ? `${fmtTime(s.arrived)} – ${s.end ? fmtTime(s.end) : s.left ? `${fmtTime(s.left)} (out)` : 'now'}`
    : 'Not arrived yet';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.border, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.top}>
          <Text style={styles.title}>
            {fmtShiftDay(s.date)}
            {showCaretaker ? ` · ${s.caretaker}` : ''}
          </Text>
          <View style={[styles.pill, { backgroundColor: st.bg }]}>
            <Text style={[styles.pillText, { color: st.color }]}>{st.text}</Text>
          </View>
        </View>
        <Text style={styles.small}>{times}</Text>
        <Text style={styles.small}>
          Active {fmtDuration(s.minutes)}
          {s.breaks > 0 ? ` · ${s.breaks} break${s.breaks === 1 ? '' : 's'} (${fmtDuration(s.break_minutes)})` : ' · no breaks'}
          {s.chores_total > 0 ? ` · ${s.chores_done}/${s.chores_total} chores` : ''}
        </Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2 },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: spacing.sm },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  small: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  pill: { borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 2, marginLeft: spacing.sm },
  pillText: { fontSize: 11, fontWeight: '700' },
});
