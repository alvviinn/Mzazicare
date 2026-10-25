import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getShift } from '../api/client';
import { Icon, IconName } from '../components/Icon';
import { STATUS_LABEL } from '../components/ShiftRow';
import { Card } from '../components/ui';
import { fmtDuration, fmtShiftDayLong, fmtTime } from '../format';
import { colors, radius, spacing } from '../theme';
import { ShiftDetail, TimelineEvent } from '../types';
import { ToneCard } from './user/Overview';

type Props = { token: string; shiftId: number; onBack: () => void };

const EVENT: Record<TimelineEvent['kind'], { icon: IconName; color: string; title: string }> = {
  started: { icon: 'play-circle-outline', color: colors.primary, title: 'Shift opened' },
  arrived: { icon: 'login', color: colors.success, title: 'Arrived' },
  stepped_out: { icon: 'coffee-outline', color: colors.warning, title: 'Stepped out (break started)' },
  returned: { icon: 'map-marker-check-outline', color: colors.success, title: 'Came back' },
  left: { icon: 'logout', color: colors.textMuted, title: 'Finished' },
};

// One day's shift in detail: when they arrived, every break, when they left, active time and chores.
// Used by both the caretaker (their own shifts) and the family.
export default function ShiftDetailScreen({ token, shiftId, onBack }: Props) {
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setShift(await getShift(token, shiftId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this shift.');
    }
  }, [token, shiftId]);

  // A shift that is still open changes as the day goes on, so keep it fresh.
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const st = shift ? STATUS_LABEL[shift.status] : null;
  const last = shift?.timeline[shift.timeline.length - 1];
  const stillOut = !!shift && (shift.phase === 'break' || shift.phase === 'away') && last?.kind === 'stepped_out';
  const ongoing = shift?.breaks_list.find((b) => b.end === null);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Icon name="chevron-left" size={26} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {shift ? fmtShiftDayLong(shift.date) : 'Shift'}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {!shift ? (
          <Text style={styles.muted}>{error || 'Loading…'}</Text>
        ) : (
          <>
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.who}>
                  {shift.caretaker} with {shift.elderly}
                </Text>
                {st && (
                  <View style={[styles.pill, { backgroundColor: st.bg }]}>
                    <Text style={[styles.pillText, { color: st.color }]}>{st.text}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sentence}>
                {shift.phase === 'active' && 'On shift right now.'}
                {shift.phase === 'waiting' && 'The shift is open, but they have not arrived yet.'}
                {stillOut && `Out since ${fmtTime(last!.at)}${ongoing ? ` (${fmtDuration(ongoing.minutes)} so far)` : ''}. The same shift continues if they come back today.`}
                {shift.phase === 'ended' && shift.left && `Finished at ${fmtTime(shift.left)}.`}
              </Text>
              <Text style={styles.small}>
                {shift.source === 'auto' ? 'Started automatically by the 15 m geofence' : 'Opened with the Start button'}
              </Text>

              <View style={styles.tiles}>
                <Tile value={fmtDuration(shift.minutes)} label="Active time" />
                <Tile value={fmtDuration(shift.break_minutes)} label="Breaks" />
                <Tile value={String(shift.breaks)} label={shift.breaks === 1 ? 'Break taken' : 'Breaks taken'} />
              </View>
              <Text style={styles.note}>Only time within 15 m of the elderly person counts as active. Breaks are not counted.</Text>
            </Card>

            <Text style={styles.section}>Timeline</Text>
            <Card>
              {shift.timeline.length === 0 ? (
                <Text style={styles.muted}>Nothing has happened yet today.</Text>
              ) : (
                shift.timeline.map((e, i) => {
                  const v = EVENT[e.kind];
                  const isLast = i === shift.timeline.length - 1;
                  return (
                    <View key={`${e.kind}-${e.at}`} style={styles.event}>
                      <View style={styles.rail}>
                        <View style={[styles.dot, { backgroundColor: v.color + '22' }]}>
                          <Icon name={v.icon} size={18} color={v.color} />
                        </View>
                        {!isLast && <View style={styles.line} />}
                      </View>
                      <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.md }}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.eventTitle}>{e.kind === 'left' && e.note === 'End of the day' ? 'Last seen' : v.title}</Text>
                          <Text style={styles.time}>{fmtTime(e.at)}</Text>
                        </View>
                        {e.kind === 'returned' && e.break_minutes !== undefined && (
                          <Text style={styles.small}>After a break of {fmtDuration(e.break_minutes)}</Text>
                        )}
                        {e.note && <Text style={styles.small}>{e.note}</Text>}
                        {isLast && stillOut && ongoing && <Text style={styles.small}>Still out: {fmtDuration(ongoing.minutes)} so far</Text>}
                      </View>
                    </View>
                  );
                })
              )}
            </Card>

            {shift.breaks_list.length > 0 && (
              <>
                <Text style={styles.section}>Breaks</Text>
                <Card>
                  {shift.breaks_list.map((b, i) => (
                    <View key={b.start} style={[styles.listRow, i > 0 && styles.border]}>
                      <Icon name="coffee-outline" size={20} color={colors.warning} />
                      <Text style={styles.listText}>
                        {fmtTime(b.start)} – {b.end ? fmtTime(b.end) : 'still out'}
                      </Text>
                      <Text style={styles.listValue}>{fmtDuration(b.minutes)}</Text>
                    </View>
                  ))}
                </Card>
              </>
            )}

            {shift.segments.length > 0 && (
              <>
                <Text style={styles.section}>Active periods</Text>
                <Card>
                  {shift.segments.map((s, i) => (
                    <View key={s.start} style={[styles.listRow, i > 0 && styles.border]}>
                      <Icon name="map-marker-check-outline" size={20} color={colors.success} />
                      <Text style={styles.listText}>
                        {fmtTime(s.start)} – {s.end ? fmtTime(s.end) : 'now'}
                      </Text>
                      <Text style={styles.listValue}>{fmtDuration(s.minutes)}</Text>
                    </View>
                  ))}
                </Card>
              </>
            )}

            <Text style={styles.section}>Chores</Text>
            <Card>
              {shift.chores.length === 0 ? (
                <Text style={styles.muted}>No chores were on the list for this day.</Text>
              ) : (
                <>
                  <Text style={styles.progress}>
                    {shift.chores_done} of {shift.chores_total} done
                  </Text>
                  {shift.chores.map((c, i) => (
                    <View key={`${c.description}-${i}`} style={styles.listRow}>
                      <Icon
                        name={c.is_done ? 'check-circle' : 'circle-outline'}
                        size={22}
                        color={c.is_done ? colors.success : colors.border}
                      />
                      <Text style={[styles.listText, !c.is_done && { color: colors.textMuted }]}>{c.description}</Text>
                      {c.done_at && <Text style={styles.time}>{fmtTime(c.done_at)}</Text>}
                    </View>
                  ))}
                </>
              )}
            </Card>

            {shift.tones && (
              <>
                <Text style={styles.section}>Voice tone during this visit</Text>
                <ToneCard tones={shift.tones} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
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
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  muted: { color: colors.textMuted, fontSize: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm },
  pill: { borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },
  sentence: { fontSize: 15, color: colors.text, marginTop: spacing.sm },
  small: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  note: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tile: { flex: 1, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md },
  tileValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  tileLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  event: { flexDirection: 'row' },
  rail: { alignItems: 'center', width: 40, marginRight: spacing.sm },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  time: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  listText: { flex: 1, fontSize: 15, color: colors.text, marginLeft: spacing.sm },
  listValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  progress: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
});
