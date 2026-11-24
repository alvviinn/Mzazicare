import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from '../../components/Icon';
import { BatteryNotice } from '../../components/BatteryNotice';
import { SharingBanner } from '../../components/SharingBanner';
import { Avatar, Card, Empty, ErrorState, Loading, PressScale, Ring, StatusPill, Stepper } from '../../components/ui';
import { fmtDuration, fmtTime } from '../../format';
import { SharingStatus } from '../../location/useLocationSharing';
import { t } from '../../strings';
import { colors, icon, on, radius, space, TAP, text, textOnInk } from '../../theme';
import { Contact, ShiftState } from '../../types';

const s = t.shift;

// No buttons: a shift starts by itself when the caretaker's phone is within range of the elder's, stepping away
// is a break, and the day closes by itself at midnight. The bar at the bottom only says so.
export function ShiftActionBar({ state }: { state: ShiftState | null }) {
  if (!state?.elderly) return null;
  const name = state.elderly.name.split(' ')[0];
  const before = state.phase === 'none' || state.phase === 'ended';
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <View style={styles.autoNote}>
        <Icon name="pin" color={colors.inkMuted} />
        <Text style={[text.caption, { flex: 1 }]}>
          {before ? s.autoStart(state.range.radius_m, name) : s.autoEnd(name)}
        </Text>
      </View>
    </View>
  );
}

type Props = {
  state: ShiftState | null;
  error: string;
  sharing: SharingStatus;
  contacts: Contact[]; // everyone else in the circle: family and the people cared for
  tasks: { done: number; total: number } | null;
  weekMinutes: number | null;
  onRetry: () => void;
  onChat: (peer: { name: string; email: string }) => void;
  onOpenShift: (id: number) => void;
  onAsk: () => void;
  onTasks: () => void;
  onHours: () => void;
  voiceCard: React.ReactNode;
};

export default function ShiftTab({
  state,
  error,
  sharing,
  contacts,
  tasks,
  weekMinutes,
  onRetry,
  onChat,
  onOpenShift,
  onAsk,
  onTasks,
  onHours,
  voiceCard,
}: Props) {
  // The search-style bar at the top: the fastest way into the first-aid guide.
  const askBar = (
    <PressScale onPress={onAsk} style={styles.ask} accessibilityRole="search" accessibilityLabel={s.askLabel}>
      <Icon name="firstAid" color={colors.primary} />
      <Text style={[text.muted, { flex: 1 }]}>{s.ask}</Text>
      <View style={styles.askGo}>
        <Icon name="go" color={on.secondary} />
      </View>
    </PressScale>
  );

  if (!state) return error ? <ErrorState message={`${s.loadError} ${error}`} onRetry={onRetry} /> : <Loading label={s.loading} />;

  if (!state.elderly) {
    return (
      <>
        {askBar}
        <Empty icon="carer" title={s.noElderTitle} body={s.noElderBody} tint="primary" />
      </>
    );
  }

  const name = state.elderly.name.split(' ')[0];
  const { range, phase, today } = state;
  const minutes = today ? today.minutes : state.shift_minutes;
  const live = phase === 'active';
  const paused = phase === 'break' || phase === 'away';

  const headline = {
    none: s.headline.none,
    waiting: s.headline.waiting,
    active: s.headline.active(name),
    break: s.headline.break,
    away: s.headline.away(name),
    ended: s.headline.ended,
  }[phase];
  const step = phase === 'none' || phase === 'waiting' ? 0 : phase === 'ended' ? 2 : 1;

  // Geofence: icon + words, never colour alone.
  let geo: { icon: IconName; color: string; label: string };
  if (range.state === 'in') geo = { icon: 'pinCheck', color: colors.secondary, label: s.inRange(range.distance_m) };
  else if (range.state === 'out') geo = { icon: 'pin', color: on.ink, label: s.outRange(range.distance_m) };
  else if (!range.elder_sharing) geo = { icon: 'pinOff', color: on.ink, label: s.noElderGps(name) };
  else geo = { icon: 'location', color: on.ink, label: s.locating };

  const meta = [
    today?.arrived ? s.arrived(fmtTime(today.arrived)) : null,
    today && today.breaks > 0 ? s.breaksShort(today.breaks) : null,
  ].filter(Boolean);

  const hero = (
    <Card tint="ink">
      <View style={styles.heroTop}>
        <StatusPill label={headline} tone={live ? 'success' : paused ? 'ink' : 'muted'} />
        <Avatar name={state.elderly.name} size={40} solid />
      </View>

      <View style={styles.heroMain} accessible accessibilityLabel={`${fmtDuration(minutes)} ${s.activeToday}. ${meta.join(', ')}`}>
        <Text style={textOnInk.display}>{fmtDuration(minutes)}</Text>
        <Text style={textOnInk.caption}>{[s.activeToday, ...meta].join(' · ')}</Text>
      </View>

      <Stepper steps={s.steps} current={step} onInk />

      <View style={styles.geo} accessible accessibilityLabel={s.geoLabel(geo.label, range.radius_m, name)}>
        <Icon name={geo.icon} color={geo.color} />
        <Text style={[textOnInk.captionStrong, { flex: 1 }]}>{geo.label}</Text>
        {today && <Text style={textOnInk.accent}>{s.timeline}</Text>}
        {today && <Icon name="chevron" color={colors.secondary} />}
      </View>
    </Card>
  );

  return (
    <>
      {state.emergency && (
        <View style={styles.emergency} accessibilityRole="alert">
          <Icon name="siren" size={icon.l} color={on.error} />
          <View style={{ flex: 1 }}>
            <Text style={[text.heading, { color: on.error }]}>{s.emergency}</Text>
            <Text style={[text.body, { color: on.error }]}>{s.emergencyBody(state.emergency.message)}</Text>
            {!!state.emergency.handled_by && (
              <Text style={[text.bodyStrong, { color: on.error }]}>{`${state.emergency.handled_by} is handling it.`}</Text>
            )}
          </View>
        </View>
      )}

      {askBar}

      {today ? (
        <PressScale
          onPress={() => onOpenShift(today.id)}
          accessibilityRole="button"
          accessibilityLabel={`${headline}. ${fmtDuration(minutes)} ${s.activeToday}`}
          accessibilityHint="Opens today's timeline"
        >
          {hero}
        </PressScale>
      ) : (
        hero
      )}

      {sharing !== 'sharing' && <SharingBanner status={sharing} />}
      <BatteryNotice />

      {/* Two tiles of different weight, alternating the two tints. */}
      <View style={styles.tiles}>
        <PressScale
          onPress={onTasks}
          style={[styles.tile, styles.tileWide, { backgroundColor: colors.secondaryTint }]}
          accessibilityRole="button"
          accessibilityLabel={tasks ? `${s.tasksTile}: ${tasks.done} of ${tasks.total} done` : s.tasksTile}
        >
          <Ring value={tasks?.done ?? 0} total={tasks?.total ?? 0} size={64}>
            <Text style={text.captionStrong}>{tasks ? `${tasks.done}/${tasks.total}` : '–'}</Text>
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={text.bodyStrong}>{s.tasksTile}</Text>
            <Text style={text.caption}>{!tasks ? '…' : tasks.total === 0 ? t.tasks.none : t.tasks.left(tasks.total - tasks.done)}</Text>
          </View>
        </PressScale>
        <PressScale
          onPress={onHours}
          style={[styles.tile, { backgroundColor: colors.primaryTint }]}
          accessibilityRole="button"
          accessibilityLabel={`${s.hoursTile}: ${fmtDuration(weekMinutes)}`}
        >
          <Icon name="calendar" />
          <Text style={text.display} numberOfLines={1} adjustsFontSizeToFit>
            {weekMinutes === null ? '–' : `${Math.round((weekMinutes / 60) * 10) / 10}h`}
          </Text>
          <Text style={text.captionInk}>{s.hoursTile}</Text>
        </PressScale>
      </View>

      {/* Message anyone in the circle: the family and the people you care for */}
      {contacts.map((c) => (
        <Pressable
          key={c.email}
          onPress={() => onChat({ name: c.name, email: c.email })}
          style={({ pressed }) => [styles.chat, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={`${s.messageFamily(c.name)}${c.unread ? `, ${c.unread} unread` : ''}`}
        >
          <Avatar name={c.name} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={text.bodyStrong}>{c.name}</Text>
            <Text style={text.caption}>{c.unread ? `${c.unread} new · ${t.roles[c.role]}` : t.roles[c.role]}</Text>
          </View>
          <View style={styles.chatBtn}>
            <Icon name="chat" color={on.secondary} />
          </View>
        </Pressable>
      ))}

      {voiceCard}
    </>
  );
}

const styles = StyleSheet.create({
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingLeft: space.m,
    paddingRight: space.s,
    marginBottom: space.m,
  },
  askGo: { width: TAP, height: TAP, borderRadius: radius.pill, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },

  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s },
  heroMain: { marginTop: space.m, marginBottom: space.l },
  geo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    marginTop: space.l,
    paddingTop: space.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.primary,
  },

  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    backgroundColor: colors.error,
    borderRadius: radius.card,
    padding: space.m,
    marginBottom: space.m,
  },

  tiles: { flexDirection: 'row', gap: space.s, marginTop: space.s },
  tile: { flex: 1, borderRadius: radius.card, padding: space.m, minHeight: 112, justifyContent: 'space-between' },
  tileWide: { flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: space.m },

  chat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space.s,
    paddingLeft: space.m,
    marginTop: space.s,
    minHeight: 72,
  },
  chatBtn: { width: TAP, height: TAP, borderRadius: radius.pill, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },

  bar: { paddingHorizontal: space.m, paddingTop: space.s, gap: space.s, backgroundColor: colors.background },
  autoNote: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TAP, paddingBottom: space.s },
});
