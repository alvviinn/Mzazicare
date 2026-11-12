import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getShifts } from '../../api/client';
import { DayStrip, ShiftRow } from '../../components/ShiftRow';
import { Card, Empty, ErrorState, Loading, Section } from '../../components/ui';
import { fmtDuration } from '../../format';
import { space, text } from '../../theme';
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
      setError(e instanceof Error ? e.message : '');
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  if (!shifts) return error ? <ErrorState message={`Couldn't load the shifts. ${error}`} onRetry={load} /> : <Loading label="Loading shifts" />;

  if (shifts.length === 0) {
    return <Empty icon="calendar" title="No shifts yet" body="One appears each day your caretaker arrives." />;
  }

  const total = shifts.reduce((n, s) => n + s.minutes, 0);
  return (
    <>
      <Card tint="primary">
        <View accessible accessibilityLabel={`Last 30 days: ${fmtDuration(total)} active over ${shifts.length} days`}>
          <Text style={text.caption}>30 days</Text>
          <Text style={text.display}>{fmtDuration(total)}</Text>
          <Text style={text.caption}>
            {shifts.length} day{shifts.length === 1 ? '' : 's'} worked
          </Text>
        </View>
      </Card>

      <Section title="Recent days" />
      <DayStrip shifts={shifts} onOpen={onOpenShift} />

      <Section title="All shifts" />
      <Card padded={false} style={styles.list}>
        {shifts.map((s, i) => (
          <ShiftRow key={s.id} shift={s} showCaretaker first={i === 0} onPress={() => onOpenShift(s.id)} />
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.m },
});
