import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { addTask, deleteTask, getTasks, updateTask } from '../../api/client';
import { SectionTitle } from '../../components/HomeShell';
import { Icon } from '../../components/Icon';
import { Button, Card, ErrorText } from '../../components/ui';
import { fmtTime } from '../../format';
import { colors, radius, spacing } from '../../theme';
import { TaskItem } from '../../types';

export default function TasksTab({ token }: { token: string }) {
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [title, setTitle] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setTasks(await getTasks(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your tasks.');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!title.trim() || adding) return;
    setAdding(true);
    setError('');
    try {
      const t = await addTask(token, title.trim(), recurring);
      setTasks((prev) => [...(prev ?? []), t]);
      setTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the task.');
    } finally {
      setAdding(false);
    }
  }

  async function change(task: TaskItem, changes: { is_done?: boolean; recurring?: boolean }) {
    // update the screen straight away, then confirm with the server
    setTasks((prev) =>
      (prev ?? []).map((t) =>
        t.id === task.id
          ? { ...t, ...changes, done_at: changes.is_done === undefined ? t.done_at : changes.is_done ? new Date().toISOString() : null }
          : t,
      ),
    );
    try {
      await updateTask(token, task.id, changes);
    } catch (e) {
      load(); // put the tick back the way the server has it
      if (changes.is_done) {
        Alert.alert('Not marked as done', e instanceof Error ? e.message : 'Could not update the task.');
      }
    }
  }

  function remove(task: TaskItem) {
    Alert.alert('Delete task?', task.recurring ? `"${task.title}" will no longer repeat.` : `"${task.title}"`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setTasks((prev) => (prev ?? []).filter((t) => t.id !== task.id));
          try {
            await deleteTask(token, task.id);
          } catch {
            load();
          }
        },
      },
    ]);
  }

  const todo = (tasks ?? []).filter((t) => !t.is_done);
  const done = (tasks ?? []).filter((t) => t.is_done);

  return (
    <>
      <Card>
        <Text style={styles.cardTitle}>Add a task</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Give afternoon medication"
          placeholderTextColor={colors.textMuted}
          maxLength={200}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Repeat every working day</Text>
            <Text style={styles.small}>Resets each morning, Monday to Friday. No need to write it again.</Text>
          </View>
          <Switch
            value={recurring}
            onValueChange={setRecurring}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title="Add task" onPress={add} loading={adding} />
      </Card>

      {tasks === null ? (
        <Text style={[styles.small, { marginTop: spacing.md }]}>Loading…</Text>
      ) : tasks.length === 0 ? (
        <Text style={[styles.small, { marginTop: spacing.lg, textAlign: 'center' }]}>
          Your list is empty. Add what you need to do today.
        </Text>
      ) : (
        <>
          <SectionTitle>{`To do (${todo.length})`}</SectionTitle>
          <Card>
            {todo.length === 0 ? (
              <Text style={styles.small}>All done for today. Well done.</Text>
            ) : (
              todo.map((t, i) => <Row key={t.id} task={t} first={i === 0} onChange={change} onRemove={remove} />)
            )}
          </Card>

          {done.length > 0 && (
            <>
              <SectionTitle>{`Done (${done.length})`}</SectionTitle>
              <Card>
                {done.map((t, i) => (
                  <Row key={t.id} task={t} first={i === 0} onChange={change} onRemove={remove} />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}

function Row({
  task,
  first,
  onChange,
  onRemove,
}: {
  task: TaskItem;
  first: boolean;
  onChange: (t: TaskItem, c: { is_done?: boolean; recurring?: boolean }) => void;
  onRemove: (t: TaskItem) => void;
}) {
  return (
    <View style={[styles.row, !first && styles.rowBorder]}>
      <Pressable onPress={() => onChange(task, { is_done: !task.is_done })} hitSlop={8} style={styles.checkHit}>
        <View style={[styles.box, task.is_done && styles.boxDone]}>
          {task.is_done && <Icon name="check" size={18} color={colors.onPrimary} />}
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.taskText, task.is_done && styles.taskDone]}>{task.title}</Text>
        <View style={styles.meta}>
          <Pressable onPress={() => onChange(task, { recurring: !task.recurring })} hitSlop={6}>
            <View style={styles.chipRow}>
              {task.recurring && <Icon name="repeat" size={14} color={colors.primary} />}
              <Text style={[styles.chip, task.recurring && styles.chipOn]}>
                {task.recurring ? ' Every working day' : 'Once'}
              </Text>
            </View>
          </Pressable>
          {task.done_at && <Text style={styles.small}> · done {fmtTime(task.done_at)}</Text>}
        </View>
      </View>
      <Pressable onPress={() => onRemove(task)} hitSlop={10}>
        <Icon name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  small: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  checkHit: { marginRight: spacing.md },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  taskText: { fontSize: 16, color: colors.text },
  taskDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  chipRow: { flexDirection: 'row', alignItems: 'center' },
  chip: { fontSize: 12, color: colors.textMuted },
  chipOn: { color: colors.primary, fontWeight: '600' },
  remove: { color: colors.textMuted, fontSize: 18, paddingLeft: spacing.md },
});
