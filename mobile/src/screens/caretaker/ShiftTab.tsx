import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { startShift, stopShift } from '../../api/client';
import { SectionTitle } from '../../components/HomeShell';
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
};

export default function ShiftTab({ token, state, error, sharing, sponsorName, onChanged, onChat }: Props) {
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
    Alert.alert('End shift?', 'Your hours so far are saved. A new shift starts automatically next time you arrive.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End shift', style: 'destructive', onPress: () => run(() => stopShift(token)) },
    ]);
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
  const { range } = state;
  const active = state.status === 'active';
  const waiting = state.status === 'waiting';

  let rangeText = '';
  if (range.state === 'in') {
    rangeText = `✓ Within ${range.radius_m} m of ${name}${range.distance_m !== null ? ` (${range.distance_m} m)` : ''}`;
  } else if (range.state === 'out') {
    rangeText = `You are ${range.distance_m !== null ? `${range.distance_m} m` : 'more than 15 m'} from ${name}`;
  } else if (!range.elder_sharing) {
    rangeText = `Waiting for ${name}'s phone to share its location`;
  } else {
    rangeText = 'Getting your location…';
  }

  return (
    <>
      <SharingBanner status={sharing} />

      <Card>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: active ? colors.success : waiting ? colors.warning : colors.border }]} />
          <Text style={styles.title}>
            {active ? `On shift with ${name}` : waiting ? 'Shift open, timer paused' : 'Not on shift'}
          </Text>
        </View>

        {state.status !== 'none' && (
          <>
            <Text style={styles.big}>{fmtDuration(state.shift_minutes)}</Text>
            <Text style={styles.muted}>
              verified this shift{state.started_at ? ` · started ${fmtTime(state.started_at)}` : ''}
              {state.source === 'manual' ? ' · started manually' : ''}
            </Text>
          </>
        )}

        <Text style={[styles.range, range.state === 'in' && { color: colors.success }]}>{rangeText}</Text>

        {waiting && (
          <Text style={styles.muted}>
            Your timer resumes by itself as soon as you are back within {range.radius_m} m of {name}.
          </Text>
        )}
        {state.status === 'none' && (
          <Text style={styles.muted}>
            Your shift starts automatically when you are within {range.radius_m} m of {name}.
          </Text>
        )}

        <ErrorText>{actionError}</ErrorText>
        <View style={{ marginTop: spacing.md }}>
          {state.status === 'none' ? (
            <Button title="Start shift manually" onPress={() => run(() => startShift(token))} loading={busy} />
          ) : (
            <Button title="End shift" variant="secondary" onPress={confirmStop} loading={busy} />
          )}
        </View>
        <Text style={styles.note}>
          Manual start and stop are checked against {name}'s phone too: only time within {range.radius_m} m counts.
        </Text>
      </Card>

      <View style={styles.tiles}>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{fmtDuration(state.today_minutes)}</Text>
          <Text style={styles.tileLabel}>Verified today</Text>
        </View>
      </View>

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
  title: { fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 },
  muted: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  big: { fontSize: 40, fontWeight: '700', color: colors.primary, marginTop: spacing.md },
  range: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: spacing.md },
  note: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
  tiles: { flexDirection: 'row', marginTop: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tileValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  tileLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
