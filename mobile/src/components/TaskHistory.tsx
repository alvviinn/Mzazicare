import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getTaskHistory } from '../api/client';
import { fmtDay, fmtTime } from '../format';
import { t } from '../strings';
import { colors, radius, space, text } from '../theme';
import { TaskRecord } from '../types';
import { ProofPhoto } from './ProofPhoto';
import { Card, Chip, Empty, ErrorState, Loading } from './ui';

const RANGES = [7, 30, 90];
const h = t.history;

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
      setError(e instanceof Error ? e.message : '');
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
      <View style={styles.ranges} accessibilityRole="radiogroup">
        {RANGES.map((d) => (
          <Chip key={d} label={h.days(d)} selected={days === d} onPress={() => setDays(d)} accessibilityLabel={h.daysLabel(d)} />
        ))}
      </View>
      {items === null ? (
        error ? <ErrorState message={`${h.loadError} ${error}`} onRetry={load} /> : <Loading label={h.loading} />
      ) : groups.length === 0 ? (
        <Empty icon="history" title={h.emptyTitle} body={h.emptyBody(days)} />
      ) : (
        groups.map((g) => (
          <View key={g.day} style={{ marginBottom: space.m }}>
            <View style={styles.dayHead}>
              <Text style={text.heading}>{g.day}</Text>
              <Text style={text.caption}>{h.count(g.items.length)}</Text>
            </View>
            {/* photos first: a grid you can scan, captions underneath */}
            <Card padded={false} style={styles.grid}>
              {g.items.map((r) => (
                <View key={r.id} style={styles.cell}>
                  <ProofPhoto
                    token={token}
                    completionId={r.id}
                    caption={`${r.title} · ${fmtDay(r.done_at)} ${fmtTime(r.done_at)}`}
                    size={96}
                  />
                  <Text style={[text.captionStrong, styles.caption]} numberOfLines={2}>
                    {r.title}
                  </Text>
                  <Text style={text.caption} numberOfLines={1}>
                    {[fmtTime(r.done_at), showCaretaker ? r.caretaker.split(' ')[0] : null, r.assigned_by ? h.setBy(r.assigned_by.split(' ')[0]) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
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
  ranges: { flexDirection: 'row', gap: space.s, marginBottom: space.m },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.s },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: space.s, gap: space.s, borderRadius: radius.card },
  cell: { width: 96, alignItems: 'flex-start' },
  caption: { marginTop: space.s, color: colors.ink },
});
