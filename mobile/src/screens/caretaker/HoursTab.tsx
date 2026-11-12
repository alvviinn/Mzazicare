import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getHours } from '../../api/client';
import { DayStrip, ShiftRow } from '../../components/ShiftRow';
import { Card, Empty, ErrorState, Loading, Section } from '../../components/ui';
import { fmtDuration } from '../../format';
import { t } from '../../strings';
import { colors, radius, space, text } from '../../theme';
import { Hours } from '../../types';

const h = t.hours;
const RADIUS_M = 15;

export default function HoursTab({ token, onOpenShift }: { token: string; onOpenShift: (id: number) => void }) {
  const [hours, setHours] = useState<Hours | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      getHours(token)
        .then((x) => {
          setHours(x);
          setError('');
        })
        .catch((e) => setError(e instanceof Error ? e.message : '')),
    [token],
  );

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (!hours) return error ? <ErrorState message={`${h.loadError} ${error}`} onRetry={load} /> : <Loading label={h.loading} />;

  return (
    <>
      {/* The week is the figure that matters; the others sit underneath as a quiet row. */}
      <Card tint="primary">
        <View accessible accessibilityLabel={`${h.week}: ${fmtDuration(hours.week)}. ${h.countsLabel(RADIUS_M)}`}>
          <Text style={text.caption}>{h.week}</Text>
          <Text style={text.display}>{fmtDuration(hours.week)}</Text>
        </View>
        <View style={styles.stats}>
          <Stat label={h.today} value={hours.today} />
          <Stat label={h.month} value={hours.month} />
          <Stat label={h.total} value={hours.total} />
        </View>
      </Card>

      {hours.recent.length === 0 ? (
        <View style={{ marginTop: space.m }}>
          <Empty icon="calendar" title={h.emptyTitle} body={h.emptyBody} />
        </View>
      ) : (
        <>
          <Section title={h.days} />
          <DayStrip shifts={hours.recent} onOpen={onOpenShift} />

          <Section title={h.shifts} />
          <Card padded={false} style={{ paddingHorizontal: space.m }}>
            {hours.recent.map((s, i) => (
              <ShiftRow key={s.id} shift={s} first={i === 0} onPress={() => onOpenShift(s.id)} />
            ))}
          </Card>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${fmtDuration(value)}`}>
      <Text style={text.bodyStrong} numberOfLines={1} adjustsFontSizeToFit>
        {fmtDuration(value)}
      </Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space.s, marginTop: space.m },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.small, padding: space.s },
});
