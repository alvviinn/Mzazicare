import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { startShift, stopShift } from '../../api/client';
import { SectionTitle } from '../../components/HomeShell';
import { Icon } from '../../components/Icon';
import { ShiftRow } from '../../components/ShiftRow';
import { SharingBanner } from '../../components/SharingBanner';
import { Button, Card, ErrorText } from '../../components/ui';
import { fmtDuration, fmtTime } from '../../format';
import { SharingStatus } from '../../location/useLocationSharing';
import { colors, spacing } from '../../theme';
import { ShiftState } from '../../types';

type Props = {
  token: string;
  state: ShiftState | null;
  error: string;
  sharing: SharingStatus;
  sponsorName: string | null;
  onChanged: () => Promise<void>;
  onChat: () => void;
  onOpenShift: (id: number) => void;
};

export default function ShiftTab({ token, state, error, sharing, sponsorName, onChanged, onChat, onOpenShift }: Props) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError('');
    try {
      await action();
      await onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function confirmStop() {
    Alert.alert(
      'Finish for now?',
      "Your hours so far are saved. If you come back today, the same shift carries on. A new shift starts tomorrow.",
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'End for now', style: 'destructive', onPress: () => run(() => stopShift(token)) },
      ],
    );
  }

  if (!state) return <Text style={styles.muted}>{error || 'Loading…'}</Text>;

  if (!state.elderly) {
    return (
      <Card>
        <Text style={styles.title}>No elderly person linked yet</Text>
        <Text style={styles.muted}>
          Once your family account links the person you care for, your shifts will start here automatically.
        </Text>
      </Card>
    );
  }

  const name = state.elderly.name.split(' ')[0];
  const { range, phase, today } = state;
  const minutes = today ? today.minutes : state.shift_minutes;

  const HEADLINE: Record<ShiftState['phase'], string> = {
    none: 'Not on shift',
    waiting: 'Waiting to arrive',
    active: `On shift with ${name}`,
    break: 'On a break',
    away: `Away from ${name}`,
    ended: "Today's shift is finished for now",
  };
  const dot = phase === 'active' ? colors.success : phase === 'break' || phase === 'away' || phase === 'waiting' ? colors.warning : colors.border;

  let rangeText = '';
  if (range.state === 'in') {
    rangeText = `Within ${range.radius_m} m of ${name}${range.distance_m !== null ? ` (${range.distance_m} m)` : ''}`;
  } else if (range.state === 'out') {
    rangeText = `You are ${range.distance_m !== null ? `${range.distance_m} m` : 'more than 15 m'} from ${name}`;
  } else if (!range.elder_sharing) {
    rangeText = `Waiting for ${name}'s phone to share its location`;
  } else {
    rangeText = 'Getting your location…';
  }

  const EXPLAIN: Partial<Record<ShiftState['phase'], string>> = {
    none: `Your shift starts automatically when you are within ${range.radius_m} m of ${name}. There is one shift per day.`,
    waiting: `The shift is open. Your time starts counting when you are within ${range.radius_m} m of ${name}.`,
    break: `Your timer is paused. When you are back within ${range.radius_m} m it carries on in the same shift. A new shift starts tomorrow.`,
    away: `You have been away a while. If you come back today it is still the same shift. A new shift starts tomorrow.`,
    ended: "You ended today's shift. If you come back today it carries on as the same shift.",
  };

  return (
    <>
      {state.emergency && (
        <View style={styles.emergency}>
          <View style={styles.row}>
            <Icon name="alarm-light-outline" size={22} color={colors.onPrimary} />
            <Text style={[styles.emergencyTitle, { marginLeft: spacing.sm }]}>Emergency</Text>
          </View>
          <Text style={styles.emergencyText}>
            {state.emergency.message} Check on them now, and tell the family what you find.
          </Text>
        </View>
      )}

      <View style={{ marginBottom: spacing.sm }}>
        <SharingBanner status={sharing} />
      </View>

      <Card>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text style={styles.title}>{HEADLINE[phase]}</Text>
        </View>

        {phase !== 'none' && (
          <>
            <Text style={styles.big}>{fmtDuration(minutes)}</Text>
            <Text style={styles.muted}>
              active today
              {today?.arrived ? ` · arrived ${fmtTime(today.arrived)}` : ''}
              {today && today.breaks > 0
                ? ` · ${today.breaks} break${today.breaks === 1 ? '' : 's'} (${fmtDuration(today.break_minutes)})`
                : ''}
            </Text>
          </>
        )}

        <View style={styles.rangeRow}>
          {range.state === 'in' && <Icon name="check-circle" size={18} color={colors.success} />}
          <Text style={[styles.range, range.state === 'in' && { color: colors.success, marginLeft: spacing.xs }]}>
            {rangeText}
          </Text>
        </View>

        {!!EXPLAIN[phase] && <Text style={styles.muted}>{EXPLAIN[phase]}</Text>}

        <ErrorText>{actionError}</ErrorText>
        <View style={{ marginTop: spacing.md }}>
          {phase === 'none' || phase === 'ended' ? (
            <Button
              title={phase === 'ended' ? "Continue today's shift" : 'Start shift manually'}
              onPress={() => run(() => startShift(token))}
              loading={busy}
            />
          ) : (
            <Button title="Finish for now" variant="secondary" onPress={confirmStop} loading={busy} />
          )}
        </View>
        <Text style={styles.note}>
          Starting and finishing by hand are checked against {name}'s phone too: only time within {range.radius_m} m counts.
        </Text>
      </Card>

      {today && (
        <>
          <SectionTitle>Today's shift</SectionTitle>
          <Card>
            <ShiftRow shift={today} first onPress={() => onOpenShift(today.id)} />
            <Text style={styles.hint}>Tap to see when you arrived, every break and when you left.</Text>
          </Card>
        </>
      )}

      {sponsorName && (
        <>
          <SectionTitle>Family</SectionTitle>
          <Card>
            <Text style={styles.muted}>Send {sponsorName} an update or ask a question.</Text>
            <View style={{ marginTop: spacing.md }}>
              <Button title={`Message ${sponsorName.split(' ')[0]}`} onPress={onChat} />
            </View>
          </Card>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  emergency: {
    backgroundColor: colors.danger,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emergencyTitle: { color: colors.onPrimary, fontSize: 18, fontWeight: '800' },
  emergencyText: { color: colors.onPrimary, fontSize: 15, marginTop: spacing.xs },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 },
  muted: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  big: { fontSize: 40, fontWeight: '700', color: colors.primary, marginTop: spacing.md },
  rangeRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  range: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  note: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
});
