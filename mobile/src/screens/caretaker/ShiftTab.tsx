import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { startShift, stopShift } from '../../api/client';
import { Icon } from '../../components/Icon';
import { SharingBanner } from '../../components/SharingBanner';
import { Avatar, Button, Card, Empty, ErrorState, haptic, Loading, PressScale, Ring, StatusPill, Stepper } from '../../components/ui';
import { fmtDuration, fmtTime } from '../../format';
import { SharingStatus } from '../../location/useLocationSharing';
import { useOnline } from '../../net';
import { t } from '../../strings';
import { colors, fonts, iconSize, radius, spacing, TAP, text, type } from '../../theme';
import { ShiftState } from '../../types';

const s = t.shift;

// Start / end, with loading, success and error feedback. Used by the fixed button at the bottom.
export function useShiftAction(token: string, onChanged: () => Promise<void>, notify: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
      haptic.success();
      notify(done);
    } catch (e) {
      haptic.warn();
      setError(e instanceof Error ? e.message : t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    start: () => run(() => startShift(token), s.started),
    end: () =>
      Alert.alert(s.endTitle, s.endBody, [
        { text: s.endKeep, style: 'cancel' },
        { text: s.endConfirm, style: 'destructive', onPress: () => run(() => stopShift(token), s.ended) },
      ]),
  };
}

// The one main action, full width at the bottom within thumb reach.
export function ShiftActionBar({ state, action }: { state: ShiftState | null; action: ReturnType<typeof useShiftAction> }) {
  const online = useOnline();
  if (!state?.elderly) return null;
  const canStart = state.phase === 'none' || state.phase === 'ended';
  return (
    <View style={styles.bar}>
      {!!action.error && (
        <Text style={styles.barError} accessibilityLiveRegion="polite">
          {action.error}
        </Text>
      )}
      {canStart ? (
        <Button
          title={!online ? s.offlineAction : state.phase === 'ended' ? s.continue : s.start}
          icon={online ? 'play' : 'cloud-off-outline'}
          onPress={action.start}
          loading={action.busy}
          disabled={!online}
          accessibilityHint={s.startHint}
        />
      ) : (
        <Button
          title={!online ? s.offlineAction : s.end}
          icon={online ? 'stop' : 'cloud-off-outline'}
          variant="ink"
          onPress={action.end}
          loading={action.busy}
          disabled={!online}
        />
      )}
    </View>
  );
}

type Props = {
  state: ShiftState | null;
  error: string;
  sharing: SharingStatus;
  sponsorName: string | null;
  tasks: { done: number; total: number } | null;
  weekMinutes: number | null;
  onRetry: () => void;
  onChat: () => void;
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
  sponsorName,
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
  // The Uber-style "where to?" bar: the fastest way into the first-aid guide.
  const askBar = (
    <PressScale onPress={onAsk} style={styles.ask} accessibilityRole="search" accessibilityLabel={s.askLabel}>
      <Icon name="medical-bag" size={iconSize.inline} color={colors.primaryInk} />
      <Text style={[text.body, { flex: 1, color: colors.textMuted }]}>{s.ask}</Text>
      <View style={styles.askGo}>
        <Icon name="arrow-right" size={18} color={colors.onPrimary} />
      </View>
    </PressScale>
  );

  if (!state) return error ? <ErrorState message={`${s.loadError} ${error}`} onRetry={onRetry} /> : <Loading label={s.loading} />;

  if (!state.elderly) {
    return (
      <>
        {askBar}
        <Empty icon="account-heart-outline" title={s.noElderTitle} body={s.noElderBody} tint="peach" />
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
  let geo: { icon: 'map-marker-check' | 'map-marker-distance' | 'map-marker-off-outline' | 'crosshairs-gps'; color: string; label: string };
  if (range.state === 'in') geo = { icon: 'map-marker-check', color: colors.sage, label: s.inRange(range.distance_m) };
  else if (range.state === 'out') geo = { icon: 'map-marker-distance', color: colors.butterInk, label: s.outRange(range.distance_m) };
  else if (!range.elder_sharing) geo = { icon: 'map-marker-off-outline', color: colors.butterInk, label: s.noElderGps(name) };
  else geo = { icon: 'crosshairs-gps', color: colors.textMuted, label: s.locating };

  const meta = [
    today?.arrived ? s.arrived(fmtTime(today.arrived)) : null,
    today && today.breaks > 0 ? s.breaksShort(today.breaks) : null,
  ].filter(Boolean);

  const hero = (
    <Card tint={live ? 'sage' : paused ? 'butter' : 'surface'} raised>
      <View style={styles.heroTop}>
        <StatusPill label={headline} tone={live ? 'sage' : paused ? 'butter' : 'quiet'} live={live} />
        <Avatar name={state.elderly.name} size={40} ring={colors.surface} />
      </View>

      {phase === 'none' ? (
        <Text style={[text.h1, styles.heroMain]}>{s.start}</Text>
      ) : (
        <View
          style={styles.heroMain}
          accessible
          accessibilityLabel={`${fmtDuration(minutes)} ${s.activeToday}. ${meta.join(', ')}`}
        >
          <Text style={text.number}>{fmtDuration(minutes)}</Text>
          <Text style={text.small}>{[s.activeToday, ...meta].join(' · ')}</Text>
        </View>
      )}

      <Stepper steps={s.steps} current={step} color={paused ? colors.butterInk : colors.sage} />

      <View style={styles.geo} accessible accessibilityLabel={s.geoLabel(geo.label, range.radius_m, name)}>
        <Icon name={geo.icon} size={18} color={geo.color} />
        <Text style={[styles.geoText, { color: geo.color === colors.textMuted ? colors.text : geo.color }]}>{geo.label}</Text>
        {today && <Text style={styles.open}>{s.timeline}</Text>}
        {today && <Icon name="chevron-right" size={18} color={colors.primaryInk} />}
      </View>
    </Card>
  );

  return (
    <>
      {state.emergency && (
        <Card tint="danger" style={{ marginBottom: spacing.ms }}>
          <View style={styles.emHead} accessibilityRole="alert">
            <View style={styles.emIcon}>
              <Icon name="alarm-light-outline" size={iconSize.large} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[text.h2, { color: colors.danger }]}>{s.emergency}</Text>
              <Text style={text.body}>{s.emergencyBody(state.emergency.message)}</Text>
            </View>
          </View>
        </Card>
      )}

      {askBar}

      {today ? (
        <PressScale
          onPress={() => onOpenShift(today.id)}
          scaleTo={0.985}
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

      {/* Two tiles of different weight: tasks carry a ring, hours a big number. */}
      <View style={styles.tiles}>
        <PressScale onPress={onTasks} style={[styles.tile, styles.tileWide, { backgroundColor: colors.primarySoft }]} accessibilityRole="button" accessibilityLabel={tasks ? `${s.tasksTile}: ${tasks.done} of ${tasks.total} done` : s.tasksTile}>
          <Ring value={tasks?.done ?? 0} total={tasks?.total ?? 0} size={58} color={colors.primary} track={colors.surface}>
            <Text style={styles.ringText}>{tasks ? `${tasks.done}/${tasks.total}` : '–'}</Text>
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={text.bodyStrong}>{s.tasksTile}</Text>
            <Text style={[text.small, { color: colors.primaryInk }]}>{tasks ? t.tasks.left(tasks.total - tasks.done) : '…'}</Text>
          </View>
        </PressScale>
        <PressScale onPress={onHours} style={[styles.tile, { backgroundColor: colors.butter }]} accessibilityRole="button" accessibilityLabel={`${s.hoursTile}: ${fmtDuration(weekMinutes)}`}>
          <Icon name="calendar-week" size={iconSize.inline} color={colors.butterInk} />
          <Text style={styles.tileNum} numberOfLines={1} adjustsFontSizeToFit>
            {weekMinutes === null ? '–' : `${Math.round((weekMinutes / 60) * 10) / 10}h`}
          </Text>
          <Text style={[text.small, { color: colors.butterInk }]}>{s.hoursTile}</Text>
        </PressScale>
      </View>

      {sponsorName && (
        <Pressable
          onPress={onChat}
          style={({ pressed }) => [styles.chat, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={s.messageFamily(sponsorName)}
        >
          <Avatar name={sponsorName} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={text.bodyStrong}>{sponsorName}</Text>
            <Text style={text.small}>{t.roles.user}</Text>
          </View>
          <View style={styles.chatBtn}>
            <Icon name="message-text-outline" size={iconSize.inline} color={colors.onPrimary} />
          </View>
        </Pressable>
      )}

      {voiceCard}
    </>
  );
}

const styles = StyleSheet.create({
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    minHeight: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  askGo: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroMain: { marginTop: spacing.md, marginBottom: spacing.lg },
  geo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
    paddingTop: spacing.ms,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  geoText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: type.small },
  open: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.primaryInk },

  emHead: { flexDirection: 'row', gap: spacing.ms, alignItems: 'center' },
  emIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },

  tiles: { flexDirection: 'row', gap: spacing.ms, marginTop: spacing.ms },
  tile: { flex: 1, borderRadius: radius.lg, padding: spacing.md, minHeight: 112, justifyContent: 'space-between' },
  tileWide: { flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  tileNum: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.text },
  ringText: { fontFamily: fonts.display, fontSize: type.small, color: colors.text },

  chat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.ms,
    paddingLeft: spacing.md,
    marginTop: spacing.ms,
    minHeight: TAP + 24,
  },
  chatBtn: { width: TAP, height: TAP, borderRadius: TAP / 2, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },

  bar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.background, gap: spacing.sm },
  barError: { fontFamily: fonts.bodyMedium, color: colors.danger, fontSize: type.small, textAlign: 'center' },
});
