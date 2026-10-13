import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getHours } from '../../api/client';
import { SectionTitle } from '../../components/HomeShell';
import { Card } from '../../components/ui';
import { fmtDay, fmtDuration, fmtTime } from '../../format';
import { colors, radius, spacing } from '../../theme';
import { Hours } from '../../types';

export default function HoursTab({ token }: { token: string }) {
  const [hours, setHours] = useState<Hours | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () =>
      getHours(token)
        .then((h) => alive && setHours(h))
        .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load your hours.'));
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  if (!hours) return <Text style={styles.muted}>{error || 'Loading…'}</Text>;

  return (
    <>
      <View style={styles.grid}>
        <Tile label="Today" value={hours.today} />
        <Tile label="This week" value={hours.week} />
      </View>
      <View style={styles.grid}>
        <Tile label="This month" value={hours.month} />
        <Tile label="All time" value={hours.total} />
      </View>
      <Text style={styles.note}>Only time verified within 15 m of the elderly person's phone is counted.</Text>

      <SectionTitle>Recent shifts</SectionTitle>
      <Card>
        {hours.recent.length === 0 ? (
          <Text style={styles.muted}>No shifts yet. Your first one starts when you arrive.</Text>
        ) : (
          hours.recent.map((s, i) => (
            <View key={s.id} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {fmtDay(s.start)} · {s.elderly}
                </Text>
                <Text style={styles.small}>
                  {fmtTime(s.start)} – {s.end ? fmtTime(s.end) : 'in progress'} ·{' '}
                  {s.source === 'auto' ? 'Started automatically' : 'Started manually'}
                </Text>
              </View>
              <Text style={styles.rowValue}>{fmtDuration(s.minutes)}</Text>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{fmtDuration(value)}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 14 },
  grid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tileValue: { fontSize: 24, fontWeight: '700', color: colors.primary },
  tileLabel: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  note: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  small: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
