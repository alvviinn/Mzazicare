import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { addTask, completeTask, deleteTask, getTasks, updateTask } from '../../api/client';
import { SectionTitle } from '../../components/HomeShell';
import { Icon } from '../../components/Icon';
import { ProofPhoto } from '../../components/ProofPhoto';
import { TaskHistory } from '../../components/TaskHistory';
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
  const [view, setView] = useState<'today' | 'history'>('today');
  const [sending, setSending] = useState<number | null>(null); // the task whose proof photo is uploading

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

  // Ticking a task off needs a photo taken there and then (the camera only, not old photos from the gallery).
  async function markDone(task: TaskItem) {
    if (sending !== null) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera needed', 'Allow MzaziCare to use the camera so you can take a photo showing the task is done.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, exif: false });
    if (shot.canceled || !shot.assets?.length) return;
    const asset = shot.assets[0];
    const file = new File(asset.uri);
    setSending(task.id);
    try {
      const updated = await completeTask(token, task.id, await file.arrayBuffer(), asset.mimeType ?? 'image/jpeg');
      setTasks((prev) => (prev ?? []).map((t) => (t.id === task.id ? updated : t)));
    } catch (e) {
      Alert.alert('Not marked as done', e instanceof Error ? e.message : 'Could not send the photo.');
    } finally {
      setSending(null);
      try {
        file.delete(); // the server has its copy; nothing is left on the phone
      } catch {
        /* already gone */
      }
    }
  }

  function change(task: TaskItem, changes: { is_done?: boolean; recurring?: boolean }) {
    if (changes.is_done === true) return markDone(task);
    if (changes.is_done === false) {
      Alert.alert('Mark as not done?', 'The photo you took for this task will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark not done', style: 'destructive', onPress: () => save(task, changes) },
      ]);
      return;
    }
    return save(task, changes);
  }

  async function save(task: TaskItem, changes: { is_done?: boolean; recurring?: boolean }) {
    // update the screen straight away, then confirm with the server
    setTasks((prev) =>
      (prev ?? []).map((t) =>
        t.id === task.id
          ? { ...t, ...changes, ...(changes.is_done === false ? { done_at: null, completion_id: null } : {}) }
          : t,
      ),
    );
    try {
      await updateTask(token, task.id, changes);
    } catch {
      load(); // put it back the way the server has it
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

  const tabs = (
    <View style={styles.tabs}>
      {(['today', 'history'] as const).map((v) => (
        <Pressable key={v} onPress={() => setView(v)} style={[styles.tab, view === v && styles.tabOn]}>
          <Text style={[styles.tabText, view === v && { color: colors.onPrimary }]}>{v === 'today' ? 'Today' : 'History'}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (view === 'history') {
    return (
      <>
        {tabs}
        <TaskHistory token={token} />
      </>
    );
  }

  return (
    <>
      {tabs}
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
            <Text style={styles.small}>Resets each morning, Monday to Friday. No need to write it again. Tick a task to take a photo showing it is done.</Text>
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
          Your list is empty. Add what you need to do today. Tasks the family assigns to you also appear here.
        </Text>
      ) : (
        <>
          <SectionTitle>{`To do (${todo.length})`}</SectionTitle>
          <Card>
            {todo.length === 0 ? (
              <Text style={styles.small}>All done for today. Well done.</Text>
            ) : (
              todo.map((t, i) => (
                <Row key={t.id} token={token} task={t} first={i === 0} sending={sending === t.id} onChange={change} onRemove={remove} />
              ))
            )}
          </Card>

          {done.length > 0 && (
            <>
              <SectionTitle>{`Done (${done.length})`}</SectionTitle>
              <Card>
                {done.map((t, i) => (
                  <Row key={t.id} token={token} task={t} first={i === 0} sending={false} onChange={change} onRemove={remove} />
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
  token,
  task,
  first,
  sending,
  onChange,
  onRemove,
}: {
  token: string;
  task: TaskItem;
  first: boolean;
  sending: boolean;
  onChange: (t: TaskItem, c: { is_done?: boolean; recurring?: boolean }) => void;
  onRemove: (t: TaskItem) => void;
}) {
  const fromFamily = !!task.assigned_by;
  return (
    <View style={[styles.row, !first && styles.rowBorder]}>
      <Pressable
        onPress={() => onChange(task, { is_done: !task.is_done })}
        hitSlop={8}
        style={styles.checkHit}
        disabled={sending}
        accessibilityLabel={task.is_done ? 'Mark as not done' : 'Take a photo and mark as done'}
      >
        <View style={[styles.box, task.is_done && styles.boxDone]}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : task.is_done ? (
            <Icon name="check" size={18} color={colors.onPrimary} />
          ) : (
            <Icon name="camera-outline" size={16} color={colors.textMuted} />
          )}
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.taskText, task.is_done && styles.taskDone]}>{task.title}</Text>
        <View style={styles.meta}>
          {/* a task the family assigned can be ticked off, but only they can change or remove it */}
          <Pressable onPress={() => onChange(task, { recurring: !task.recurring })} hitSlop={6} disabled={fromFamily}>
            <View style={styles.chipRow}>
              {task.recurring && <Icon name="repeat" size={14} color={colors.primary} />}
              <Text style={[styles.chip, task.recurring && styles.chipOn]}>
                {task.recurring ? ' Every working day' : 'Once'}
              </Text>
            </View>
          </Pressable>
          {fromFamily && <Text style={styles.from}> · from {task.assigned_by}</Text>}
          {task.done_at && <Text style={styles.small}> · done {fmtTime(task.done_at)}</Text>}
        </View>
      </View>
      {task.completion_id !== null && (
        <View style={{ marginRight: spacing.sm }}>
          <ProofPhoto token={token} completionId={task.completion_id} caption={task.title} size={40} />
        </View>
      )}
      {!fromFamily && (
        <Pressable onPress={() => onRemove(task)} hitSlop={10}>
          <Icon name="close" size={20} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.primary, fontWeight: '700' },
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
  from: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  remove: { color: colors.textMuted, fontSize: 18, paddingLeft: spacing.md },
});
