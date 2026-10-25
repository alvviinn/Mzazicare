import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { getShifts } from '../../api/client';
import { SectionTitle } from '../../components/HomeShell';
import { ShiftRow } from '../../components/ShiftRow';
import { Card } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { ShiftSummary } from '../../types';

type Props = { token: string; onOpenShift: (id: number) => void };

// Every day's shift for the last 30 days. A shift is one day: breaks do not end it.
export default function ShiftsTab({ token, onOpenShift }: Props) {
  const [shifts, setShifts] = useState<ShiftSummary[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setShifts(await getShifts(token, 30));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the shifts.');
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  if (!shifts) return <Text style={styles.muted}>{error || 'Loading…'}</Text>;

  const total = shifts.reduce((n, s) => n + s.minutes, 0);
  return (
    <>
      <SectionTitle>Shifts (last 30 days)</SectionTitle>
      <Card>
        {shifts.length === 0 ? (
          <Text style={styles.muted}>No shifts yet. A day's shift appears when your caretaker arrives.</Text>
        ) : (
          <>
            {shifts.map((s, i) => (
              <ShiftRow key={s.id} shift={s} showCaretaker first={i === 0} onPress={() => onOpenShift(s.id)} />
            ))}
            <Text style={styles.hint}>
              One shift per day. Stepping out is a break and the same shift continues when they return. Tap a day for the
              full timeline. {shifts.length} day{shifts.length === 1 ? '' : 's'}, {Math.floor(total / 60)}h {total % 60}m active in total.
            </Text>
          </>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
});
