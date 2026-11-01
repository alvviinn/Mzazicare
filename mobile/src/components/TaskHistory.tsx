import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getTaskHistory } from '../api/client';
import { fmtDay, fmtTime } from '../format';
import { colors, radius, spacing } from '../theme';
import { TaskRecord } from '../types';
import { SectionTitle } from './HomeShell';
import { Icon } from './Icon';
import { ProofPhoto } from './ProofPhoto';
import { Card, ErrorText } from './ui';

const RANGES = [7, 30, 90];

// Every task done in the chosen period, grouped by day, each with its proof photo.
// The caretaker sees their own; the family sees all their caretakers' (showCaretaker).
export function TaskHistory({ token, showCaretaker = false }: { token: string; showCaretaker?: boolean }) {
  const [days, setDays] = useState(30);
  const [items, setItems] = useState<TaskRecord[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setItems((await getTaskHistory(token, days)).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the task history.');
    }
  }, [token, days]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const groups: { day: string; items: TaskRecord[] }[] = [];
  for (const r of items ?? []) {
    const day = fmtDay(r.done_at);
    if (groups[groups.length - 1]?.day !== day) groups.push({ day, items: [] });
    groups[groups.length - 1].items.push(r);
  }

  return (
    <>
      <View style={styles.ranges}>
        {RANGES.map((d) => (
          <Pressable key={d} onPress={() => setDays(d)} style={[styles.range, days === d && styles.rangeOn]}>
            <Text style={[styles.rangeText, days === d && { color: colors.onPrimary }]}>{`${d} days`}</Text>
          </Pressable>
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      {items === null ? (
        !error && <Text style={styles.small}>Loading…</Text>
      ) : groups.length === 0 ? (
        <Card>
          <Text style={styles.small}>No tasks were done in the last {days} days.</Text>
        </Card>
      ) : (
        groups.map((g) => (
          <View key={g.day}>
            <SectionTitle>{`${g.day} · ${g.items.length} done`}</SectionTitle>
            <Card>
              {g.items.map((r, i) => (
                <View key={r.id} style={[styles.row, i > 0 && styles.border]}>
                  <ProofPhoto token={token} completionId={r.id} caption={`${r.title} · ${fmtDay(r.done_at)} ${fmtTime(r.done_at)}`} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.title}>{r.title}</Text>
                    <View style={styles.meta}>
                      <Icon name="check-circle" size={14} color={colors.success} />
                      <Text style={styles.small}>
                        {` ${fmtTime(r.done_at)}`}
                        {showCaretaker ? ` · ${r.caretaker}` : ''}
                        {r.assigned_by ? ` · set by ${r.assigned_by}` : ''}
                        {r.recurring ? ' · daily' : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
  ranges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  range: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  rangeOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeText: { color: colors.primary, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  small: { color: colors.textMuted, fontSize: 12 },
});
