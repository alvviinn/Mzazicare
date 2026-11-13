import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getShift } from '../api/client';
import { Icon, IconName } from '../components/Icon';
import { STATUS_LABEL } from '../components/ShiftRow';
import { ToneCard, ToneChart } from '../components/ToneChart';
import { Avatar, Card, ErrorState, Loading, Ring, Row, ScreenHeader, Section, Segmented, StatusPill } from '../components/ui';
import { fmtDuration, fmtShiftDayLong, fmtTime } from '../format';
import { colors, icon, on, radius, space, text, textOnInk } from '../theme';
import { ShiftDetail, TimelineEvent } from '../types';

type Props = { token: string; shiftId: number; onBack: () => void };

// Event dots alternate the two tints; the icon says what happened.
const EVENT: Record<TimelineEvent['kind'], { icon: IconName; bg: string; title: string }> = {
  started: { icon: 'play', bg: colors.primaryTint, title: 'Shift opened' },
  arrived: { icon: 'login', bg: colors.secondaryTint, title: 'Arrived' },
  stepped_out: { icon: 'break', bg: colors.primaryTint, title: 'Break' },
  returned: { icon: 'pinCheck', bg: colors.secondaryTint, title: 'Back' },
  left: { icon: 'logout', bg: colors.line, title: 'Finished' },
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
            <Card tint="ink">
              <View style={styles.who}>
                <View style={styles.pair}>
                  <Avatar name={shift.caretaker} size={40} solid />
                  <View style={styles.overlap}>
                    <Avatar name={shift.elderly} size={40} />
                  </View>
                </View>
                <Text style={[textOnInk.bodyStrong, { flex: 1 }]} numberOfLines={2}>
                  {shift.caretaker.split(' ')[0]} · {shift.elderly.split(' ')[0]}
                </Text>
                {st && <StatusPill label={st.text} tone={st.tone} />}
              </View>

              <View
                style={{ marginTop: space.m }}
                accessible
                accessibilityLabel={`Active ${fmtDuration(shift.minutes)}. Only time within 15 metres of the elderly person counts.`}
              >
                <Text style={textOnInk.display}>{fmtDuration(shift.minutes)}</Text>
                <Text style={textOnInk.caption}>
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
                <Stat icon="break" value={fmtDuration(shift.break_minutes)} label={`${shift.breaks} break${shift.breaks === 1 ? '' : 's'}`} />
                <Stat icon={shift.source === 'auto' ? 'pinCheck' : 'play'} value={shift.source === 'auto' ? 'Auto' : 'Manual'} label="Start" />
                {shift.chores_total > 0 && <Stat icon="chores" value={`${shift.chores_done}/${shift.chores_total}`} label="Tasks" />}
              </View>
            </Card>

            <View style={{ marginTop: space.l }}>
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
                  <Text style={text.caption}>Nothing yet today.</Text>
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
                        <Text style={[text.captionStrong, styles.time]}>{fmtTime(e.at)}</Text>
                        <View style={styles.rail}>
                          <View style={[styles.dot, { backgroundColor: v.bg }]}>
                            <Icon name={v.icon} size={icon.xs} />
                          </View>
                          {!isLast && <View style={styles.line} />}
                        </View>
                        <View style={[styles.eventBody, !isLast && { paddingBottom: space.l }]}>
                          <Text style={text.bodyStrong}>{title}</Text>
                          {!!sub && <Text style={text.caption}>{sub}</Text>}
                        </View>
                      </View>
                    );
                  })
                )}
              </Card>
            )}

            {view === 'breaks' && (
              <Card padded={false} style={styles.list}>
                {shift.breaks_list.length === 0 ? (
                  <Row first leading={<Icon name="break" color={colors.inkMuted} />} title="No breaks" />
                ) : (
                  shift.breaks_list.map((b, i) => (
                    <Row
                      key={b.start}
                      first={i === 0}
                      leading={<Icon name="break" />}
                      title={`${fmtTime(b.start)} – ${b.end ? fmtTime(b.end) : 'now'}`}
                      trailing={<Text style={text.bodyStrong}>{fmtDuration(b.minutes)}</Text>}
                    />
                  ))
                )}
              </Card>
            )}

            {view === 'active' && (
              <Card padded={false} style={styles.list}>
                {shift.segments.length === 0 ? (
                  <Row first leading={<Icon name="pin" color={colors.inkMuted} />} title="Not in range yet" />
                ) : (
                  shift.segments.map((s, i) => (
                    <Row
                      key={s.start}
                      first={i === 0}
                      leading={<Icon name="pinCheck" color={colors.success} />}
                      title={`${fmtTime(s.start)} – ${s.end ? fmtTime(s.end) : 'now'}`}
                      trailing={<Text style={text.bodyStrong}>{fmtDuration(s.minutes)}</Text>}
                    />
                  ))
                )}
              </Card>
            )}

            <Section title="Tasks" />
            <Card tint="secondary">
              {shift.chores.length === 0 ? (
                <Text style={text.caption}>None this day.</Text>
              ) : (
                <>
                  <View style={styles.choreHead}>
                    <Ring value={shift.chores_done} total={shift.chores_total} size={56}>
                      <Text style={text.captionStrong}>
                        {shift.chores_done}/{shift.chores_total}
                      </Text>
                    </Ring>
                    <Text style={text.heading}>{shift.chores_done === shift.chores_total ? 'All done' : `${shift.chores_total - shift.chores_done} left`}</Text>
                  </View>
                  {shift.chores.map((c, i) => (
                    <View key={`${c.description}-${i}`} style={styles.chore}>
                      <View style={[styles.tick, c.is_done && { backgroundColor: colors.success, borderColor: colors.success }]}>
                        {c.is_done && <Icon name="check" size={icon.xs} color={on.success} />}
                      </View>
                      <Text style={[text.body, { flex: 1 }, !c.is_done && { color: colors.inkMuted }]}>{c.description}</Text>
                      {c.done_at && <Text style={text.caption}>{fmtTime(c.done_at)}</Text>}
                    </View>
                  ))}
                </>
              )}
            </Card>

            {shift.tones && (
              <>
                <Section title="Voice tone" />
                {!!shift.tone_timeline?.length && (
                  <Card style={{ marginBottom: space.s }}>
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

function Stat({ icon: glyph, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={glyph} color={colors.inkMuted} />
      <Text style={text.bodyStrong} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: space.m, paddingBottom: space.xxl },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  pair: { flexDirection: 'row' },
  overlap: { marginLeft: -space.m },
  stats: { flexDirection: 'row', gap: space.s, marginTop: space.l },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.small, padding: space.s },
  list: { paddingHorizontal: space.m },
  event: { flexDirection: 'row' },
  time: { width: 64, paddingTop: space.s, color: colors.inkMuted },
  rail: { alignItems: 'center', width: 32, marginRight: space.m },
  dot: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.line },
  eventBody: { flex: 1 },
  choreHead: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginBottom: space.s },
  chore: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s },
  tick: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.inkMuted, alignItems: 'center', justifyContent: 'center' },
});
