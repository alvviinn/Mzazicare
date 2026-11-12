import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getShift } from '../api/client';
import { Icon, IconName } from '../components/Icon';
import { STATUS_LABEL } from '../components/ShiftRow';
import { ToneCard, ToneChart } from '../components/ToneChart';
import { Avatar, Card, ErrorState, Loading, Ring, Row, ScreenHeader, Section, Segmented, StatusPill } from '../components/ui';
import { fmtDuration, fmtShiftDayLong, fmtTime } from '../format';
import { colors, fonts, iconSize, radius, spacing, text, type } from '../theme';
import { ShiftDetail, TimelineEvent } from '../types';

type Props = { token: string; shiftId: number; onBack: () => void };

const EVENT: Record<TimelineEvent['kind'], { icon: IconName; color: string; bg: string; title: string }> = {
  started: { icon: 'play', color: colors.primaryInk, bg: colors.primarySoft, title: 'Shift opened' },
  arrived: { icon: 'login', color: colors.sage, bg: colors.sageSoft, title: 'Arrived' },
  stepped_out: { icon: 'coffee-outline', color: colors.butterInk, bg: colors.butter, title: 'Break' },
  returned: { icon: 'map-marker-check-outline', color: colors.sage, bg: colors.sageSoft, title: 'Back' },
  left: { icon: 'logout', color: colors.textMuted, bg: colors.sunken, title: 'Finished' },
};

type View3 = 'timeline' | 'breaks' | 'active';

// One day's shift in detail. Used by both the caretaker (their own shifts) and the family.
export default function ShiftDetailScreen({ token, shiftId, onBack }: Props) {
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View3>('timeline');

  const load = useCallback(async () => {
    try {
      setShift(await getShift(token, shiftId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '');
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
      <ScreenHeader title={shift ? fmtShiftDayLong(shift.date) : 'Shift'} onBack={onBack} />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {!shift ? (
          error ? <ErrorState message={`Couldn't load this shift. ${error}`} onRetry={load} /> : <Loading label="Loading the shift" />
        ) : (
          <>
            <Card tint={shift.phase === 'active' ? 'sage' : stillOut ? 'butter' : 'surface'} raised>
              <View style={styles.who}>
                <View style={styles.pair}>
                  <Avatar name={shift.caretaker} size={40} ring={colors.surface} />
                  <View style={{ marginLeft: -12 }}>
                    <Avatar name={shift.elderly} size={40} ring={colors.surface} />
                  </View>
                </View>
                <Text style={[text.bodyStrong, { flex: 1 }]} numberOfLines={2}>
                  {shift.caretaker.split(' ')[0]} · {shift.elderly.split(' ')[0]}
                </Text>
                {st && <StatusPill label={st.text} tone={st.tone} live={shift.status === 'on_shift'} />}
              </View>

              <View
                style={{ marginTop: spacing.md }}
                accessible
                accessibilityLabel={`Active ${fmtDuration(shift.minutes)}. Only time within 15 metres of the elderly person counts.`}
              >
                <Text style={text.number}>{fmtDuration(shift.minutes)}</Text>
                <Text style={text.small}>
                  {[
                    'active',
                    shift.arrived ? `${fmtTime(shift.arrived)} – ${shift.end ? fmtTime(shift.end) : stillOut ? 'out' : 'now'}` : 'not arrived',
                    stillOut && ongoing ? `out ${fmtDuration(ongoing.minutes)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>

              <View style={styles.stats}>
                <Stat icon="coffee-outline" value={fmtDuration(shift.break_minutes)} label={`${shift.breaks} break${shift.breaks === 1 ? '' : 's'}`} />
                <Stat
                  icon={shift.source === 'auto' ? 'map-marker-radius-outline' : 'gesture-tap'}
                  value={shift.source === 'auto' ? 'Auto' : 'Manual'}
                  label="Start"
                />
                {shift.chores_total > 0 && (
                  <Stat icon="checkbox-marked-circle-outline" value={`${shift.chores_done}/${shift.chores_total}`} label="Chores" />
                )}
              </View>
            </Card>

            <View style={{ marginTop: spacing.lg }}>
              <Segmented<View3>
                options={[
                  { key: 'timeline', label: 'Timeline' },
                  { key: 'breaks', label: `Breaks ${shift.breaks_list.length || ''}`.trim() },
                  { key: 'active', label: 'Active' },
                ]}
                value={view}
                onChange={setView}
              />
            </View>

            {view === 'timeline' && (
              <Card>
                {shift.timeline.length === 0 ? (
                  <Text style={text.small}>Nothing yet today.</Text>
                ) : (
                  shift.timeline.map((e, i) => {
                    const v = EVENT[e.kind];
                    const isLast = i === shift.timeline.length - 1;
                    const title = e.kind === 'left' && e.note === 'End of the day' ? 'Last seen' : v.title;
                    const sub = [
                      e.kind === 'returned' && e.break_minutes !== undefined ? `after ${fmtDuration(e.break_minutes)}` : null,
                      e.note && e.note !== 'End of the day' ? e.note : null,
                      isLast && stillOut && ongoing ? `still out · ${fmtDuration(ongoing.minutes)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <View key={`${e.kind}-${e.at}`} style={styles.event} accessible accessibilityLabel={`${fmtTime(e.at)}: ${title}. ${sub}`}>
                        <Text style={styles.time}>{fmtTime(e.at)}</Text>
                        <View style={styles.rail}>
                          <View style={[styles.dot, { backgroundColor: v.bg }]}>
                            <Icon name={v.icon} size={16} color={v.color} />
                          </View>
                          {!isLast && <View style={styles.line} />}
                        </View>
                        <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.lg, paddingTop: 6 }}>
                          <Text style={text.bodyStrong}>{title}</Text>
                          {!!sub && <Text style={text.small}>{sub}</Text>}
                        </View>
                      </View>
                    );
                  })
                )}
              </Card>
            )}

            {view === 'breaks' && (
              <Card padded={false} style={{ paddingHorizontal: spacing.md }}>
                {shift.breaks_list.length === 0 ? (
                  <Row first leading={<Icon name="coffee-off-outline" size={iconSize.inline} color={colors.textMuted} />} title="No breaks" />
                ) : (
                  shift.breaks_list.map((b, i) => (
                    <Row
                      key={b.start}
                      first={i === 0}
                      leading={<Icon name="coffee-outline" size={iconSize.inline} color={colors.butterInk} />}
                      title={`${fmtTime(b.start)} – ${b.end ? fmtTime(b.end) : 'now'}`}
                      trailing={<Text style={styles.value}>{fmtDuration(b.minutes)}</Text>}
                    />
                  ))
                )}
              </Card>
            )}

            {view === 'active' && (
              <Card padded={false} style={{ paddingHorizontal: spacing.md }}>
                {shift.segments.length === 0 ? (
                  <Row first leading={<Icon name="map-marker-question-outline" size={iconSize.inline} color={colors.textMuted} />} title="Not in range yet" />
                ) : (
                  shift.segments.map((s, i) => (
                    <Row
                      key={s.start}
                      first={i === 0}
                      leading={<Icon name="map-marker-check-outline" size={iconSize.inline} color={colors.sage} />}
                      title={`${fmtTime(s.start)} – ${s.end ? fmtTime(s.end) : 'now'}`}
                      trailing={<Text style={styles.value}>{fmtDuration(s.minutes)}</Text>}
                    />
                  ))
                )}
              </Card>
            )}

            <Section title="Chores" />
            <Card tint={shift.chores.length && shift.chores_done === shift.chores_total ? 'sage' : 'surface'}>
              {shift.chores.length === 0 ? (
                <Text style={text.small}>None this day.</Text>
              ) : (
                <>
                  <View style={styles.choreHead}>
                    <Ring value={shift.chores_done} total={shift.chores_total} size={52} stroke={6} track={colors.sunken}>
                      <Text style={styles.ringText}>
                        {shift.chores_done}/{shift.chores_total}
                      </Text>
                    </Ring>
                    <Text style={text.h2}>{shift.chores_done === shift.chores_total ? 'All done' : `${shift.chores_total - shift.chores_done} left`}</Text>
                  </View>
                  {shift.chores.map((c, i) => (
                    <View key={`${c.description}-${i}`} style={styles.chore}>
                      <Icon name={c.is_done ? 'check-circle' : 'circle-outline'} size={22} color={c.is_done ? colors.sage : colors.borderStrong} />
                      <Text style={[text.body, { flex: 1 }, !c.is_done && { color: colors.textMuted }]}>{c.description}</Text>
                      {c.done_at && <Text style={text.small}>{fmtTime(c.done_at)}</Text>}
                    </View>
                  ))}
                </>
              )}
            </Card>

            {shift.tones && (
              <>
                <Section title="Voice tone" />
                {!!shift.tone_timeline?.length && (
                  <Card style={{ marginBottom: spacing.ms }}>
                    <ToneChart points={shift.tone_timeline} bucketMinutes={15} />
                  </Card>
                )}
                <ToneCard tones={shift.tones} period="this visit" />
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pair: { flexDirection: 'row' },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.ms, gap: 2 },
  statValue: { fontFamily: fonts.display, fontSize: type.body + 1, color: colors.text },
  event: { flexDirection: 'row' },
  time: { width: 64, fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.textMuted, paddingTop: 9 },
  rail: { alignItems: 'center', width: 36, marginRight: spacing.ms },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  value: { fontFamily: fonts.display, fontSize: type.body, color: colors.text },
  choreHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, marginBottom: spacing.sm },
  ringText: { fontFamily: fonts.display, fontSize: type.caption + 1, color: colors.text },
  chore: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, paddingVertical: spacing.sm },
});
