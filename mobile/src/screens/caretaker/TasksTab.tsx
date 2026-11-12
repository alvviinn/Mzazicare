import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { addTask, completeTask, deleteTask, getTasks, updateTask } from '../../api/client';
import { Icon } from '../../components/Icon';
import { ProofPhoto } from '../../components/ProofPhoto';
import { TaskHistory } from '../../components/TaskHistory';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorState,
  ErrorText,
  Field,
  haptic,
  IconButton,
  Loading,
  PendingTag,
  Ring,
  Row,
  Section,
  Segmented,
  Sheet,
} from '../../components/ui';
import { fmtTime } from '../../format';
import { isOnline, NETWORK_ERROR } from '../../net';
import { clearProblem, enqueue, keepPhoto, TaskOp, useTaskQueue, withPending } from '../../offline/taskQueue';
import { t } from '../../strings';
import { colors, fonts, iconSize, radius, spacing, TAP, text, type } from '../../theme';
import { TaskItem } from '../../types';
import type { Notice } from '../CaretakerHome';

const x = t.tasks;
type Changes = { is_done?: boolean; recurring?: boolean };

export default function TasksTab({
  token,
  caretaker,
  onNotice,
}: {
  token: string;
  caretaker: string;
  onNotice: (n: Notice) => void;
}) {
  const [server, setServer] = useState<TaskItem[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [title, setTitle] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menu, setMenu] = useState<TaskItem | null>(null); // the task whose options are open
  const [view, setView] = useState<'today' | 'history'>('today');
  const [sending, setSending] = useState<number | null>(null); // the task whose proof photo is uploading
  const queue = useTaskQueue();

  const load = useCallback(async () => {
    try {
      setServer(await getTasks(token));
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // When the offline queue empties, fetch the server's version.
  useEffect(() => {
    if (queue.ops.length === 0) load();
  }, [queue.ops.length, load]);

  useEffect(() => {
    if (queue.problem) {
      onNotice({ message: x.syncProblem(queue.problem) });
      clearProblem();
    }
  }, [queue.problem, onNotice]);

  const { list: tasks, pending } = withPending(server ?? [], queue.ops, caretaker);

  // Try the server; if it can't be reached, keep the change on the phone instead of showing an error.
  async function sendOrQueue<T>(send: () => Promise<T>, op: TaskOp): Promise<T | 'queued'> {
    if (!isOnline()) {
      await enqueue(op);
      return 'queued';
    }
    try {
      return await send();
    } catch (e) {
      if (e instanceof Error && e.message === NETWORK_ERROR) {
        await enqueue(op);
        return 'queued';
      }
      throw e;
    }
  }

  async function add() {
    if (!title.trim() || adding) return;
    setAdding(true);
    setError('');
    const text = title.trim();
    try {
      const res = await sendOrQueue(() => addTask(token, text, recurring), {
        kind: 'add',
        tempId: -Date.now(),
        title: text,
        recurring,
        at: new Date().toISOString(),
      });
      if (res !== 'queued') setServer((prev) => [...(prev ?? []), res]);
      setTitle('');
      setRecurring(false);
      setAddOpen(false);
      haptic.success();
      if (res === 'queued') onNotice({ message: x.savedOffline });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.somethingWrong);
    } finally {
      setAdding(false);
    }
  }

  // Ticking a task off needs a photo taken there and then (the camera only, not old photos from the gallery).
  async function markDone(task: TaskItem) {
    if (sending !== null) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(x.cameraTitle, x.cameraBody);
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, exif: false });
    if (shot.canceled || !shot.assets?.length) return;
    const asset = shot.assets[0];
    const mime = asset.mimeType ?? 'image/jpeg';
    const file = new File(asset.uri);
    setSending(task.id);
    try {
      const queued = async () => {
        await enqueue({ kind: 'done', id: task.id, photo: await keepPhoto(asset.uri), mime, at: new Date().toISOString() });
        onNotice({ message: x.savedOffline });
      };
      if (!isOnline() || task.id < 0) {
        await queued();
        return;
      }
      try {
        const updated = await completeTask(token, task.id, await file.arrayBuffer(), mime);
        setServer((prev) => (prev ?? []).map((t) => (t.id === task.id ? updated : t)));
        haptic.success();
        onNotice({
          message: x.markedDone(fmtTime(updated.done_at ?? new Date().toISOString())),
          actionLabel: t.common.undo,
          onAction: () => save(updated, { is_done: false }, x.markedNotDone),
        });
      } catch (e) {
        if (e instanceof Error && e.message === NETWORK_ERROR) await queued();
        else Alert.alert(x.notDoneError, e instanceof Error ? e.message : x.photoError);
      }
    } finally {
      setSending(null);
      try {
        file.delete(); // the server (or the offline folder) has its copy; the camera's file is not kept
      } catch {
        /* already gone */
      }
    }
  }

  function change(task: TaskItem, changes: Changes) {
    if (changes.is_done === true) return markDone(task);
    if (changes.is_done === false) {
      Alert.alert(x.notDoneTitle, x.notDoneBody, [
        { text: t.common.cancel, style: 'cancel' },
        { text: x.notDoneConfirm, style: 'destructive', onPress: () => save(task, changes, x.markedNotDone) },
      ]);
      return;
    }
    return save(task, changes);
  }

  async function save(task: TaskItem, changes: Changes, done?: string) {
    // update the screen straight away, then confirm with the server
    setServer((prev) =>
      (prev ?? []).map((t) =>
        t.id === task.id
          ? { ...t, ...changes, ...(changes.is_done === false ? { done_at: null, completion_id: null } : {}) }
          : t,
      ),
    );
    try {
      const res = await sendOrQueue(() => updateTask(token, task.id, changes), { kind: 'update', id: task.id, changes });
      if (done) onNotice({ message: res === 'queued' ? x.savedOffline : done });
    } catch {
      load(); // put it back the way the server has it
    }
  }

  function remove(task: TaskItem) {
    setMenu(null);
    Alert.alert(x.deleteTitle, task.recurring ? x.deleteRecurring(task.title) : `"${task.title}"`, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          setServer((prev) => (prev ?? []).filter((t) => t.id !== task.id));
          try {
            const res = await sendOrQueue(() => deleteTask(token, task.id), { kind: 'delete', id: task.id });
            onNotice({ message: res === 'queued' ? x.savedOffline : x.deleted });
          } catch {
            load();
          }
        },
      },
    ]);
  }

  const todo = tasks.filter((t) => !t.is_done);
  const done = tasks.filter((t) => t.is_done);

  const switcher = (
    <Segmented
      options={[
        { key: 'today', label: x.today },
        { key: 'history', label: x.history },
      ]}
      value={view}
      onChange={setView}
    />
  );

  if (view === 'history') {
    return (
      <>
        {switcher}
        <TaskHistory token={token} />
      </>
    );
  }

  const row = (task: TaskItem, i: number) => (
    <TaskRow
      key={task.id}
      token={token}
      task={task}
      first={i === 0}
      sending={sending === task.id}
      pending={pending.has(task.id)}
      onChange={change}
      onMenu={setMenu}
    />
  );

  return (
    <>
      {switcher}

      {server === null && !loadError ? (
        <Loading label={x.loading} />
      ) : server === null ? (
        <ErrorState message={`${x.loadError} ${loadError}`} onRetry={load} />
      ) : tasks.length === 0 ? (
        <Empty icon="clipboard-check-outline" title={x.emptyTitle} body={x.emptyBody} action={x.add} onAction={() => setAddOpen(true)} tint="peach" />
      ) : (
        <>
          {/* Hero: progress at a glance, and the add button in reach. */}
          <Card tint={todo.length === 0 ? 'sage' : 'peach'} raised>
            <View style={styles.hero}>
              <Ring
                value={done.length}
                total={tasks.length}
                size={84}
                stroke={9}
                color={todo.length === 0 ? colors.sage : colors.primary}
                track={colors.surface}
              >
                <Text style={styles.ringNum}>{x.of(done.length, tasks.length)}</Text>
              </Ring>
              <View style={{ flex: 1 }}>
                <Text style={text.h1}>{todo.length === 0 ? x.allDoneTitle : x.left(todo.length)}</Text>
                <View style={styles.tip}>
                  <Icon name="camera-outline" size={16} color={colors.textMuted} />
                  <Text style={text.small}>{todo.length === 0 ? x.allDoneBody : x.photoTip}</Text>
                </View>
              </View>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <Button title={x.add} icon="plus" variant={todo.length === 0 ? 'sage' : 'primary'} size="md" onPress={() => setAddOpen(true)} />
            </View>
          </Card>

          {todo.length > 0 && (
            <>
              <Section title={x.todo} />
              <Card padded={false} style={styles.list}>
                {todo.map(row)}
              </Card>
            </>
          )}

          {done.length > 0 && (
            <>
              <Section title={x.done} />
              <Card padded={false} style={styles.list}>
                {done.map(row)}
              </Card>
            </>
          )}
        </>
      )}

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title={x.addTitle}>
        <Field
          label={x.inputLabel}
          value={title}
          onChangeText={setTitle}
          placeholder={x.placeholder}
          autoCapitalize="sentences"
          maxLength={200}
          returnKeyType="done"
          onSubmitEditing={add}
          autoFocus
        />
        <View style={styles.chips}>
          <Chip label={x.once} icon="calendar-today" selected={!recurring} onPress={() => setRecurring(false)} />
          <Chip label={x.repeat} icon="repeat" selected={recurring} onPress={() => setRecurring(true)} />
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title={x.add} icon="plus" onPress={add} loading={adding} disabled={!title.trim()} />
      </Sheet>

      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.title}>
        {menu && (
          <>
            <Row
              first
              leading={<Icon name="repeat" size={iconSize.inline} color={colors.text} />}
              title={x.repeat}
              trailing={<Icon name={menu.recurring ? 'toggle-switch' : 'toggle-switch-off-outline'} size={36} color={menu.recurring ? colors.sage : colors.borderStrong} />}
              onPress={() => {
                change(menu, { recurring: !menu.recurring });
                setMenu({ ...menu, recurring: !menu.recurring });
              }}
              accessibilityLabel={x.repeatLabel(menu.title, menu.recurring)}
            />
            <Row
              leading={<Icon name="trash-can-outline" size={iconSize.inline} color={colors.danger} />}
              title={t.common.delete}
              onPress={() => remove(menu)}
              accessibilityLabel={x.deleteLabel(menu.title)}
            />
          </>
        )}
      </Sheet>
    </>
  );
}

function TaskRow({
  token,
  task,
  first,
  sending,
  pending,
  onChange,
  onMenu,
}: {
  token: string;
  task: TaskItem;
  first: boolean;
  sending: boolean;
  pending: boolean;
  onChange: (t: TaskItem, c: Changes) => void;
  onMenu: (t: TaskItem) => void;
}) {
  const fromFamily = !!task.assigned_by;
  return (
    <View style={[styles.row, !first && styles.rowLine]}>
      {/* The whole left part of the row is the tick area. */}
      <Pressable
        onPress={() => onChange(task, { is_done: !task.is_done })}
        style={({ pressed }) => [styles.tickArea, pressed && { opacity: 0.6 }]}
        disabled={sending}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.is_done, busy: sending }}
        accessibilityLabel={task.is_done ? x.untickLabel(task.title) : x.tickLabel(task.title)}
      >
        <View style={[styles.tick, task.is_done && styles.tickDone]}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : task.is_done ? (
            <Icon name="check-bold" size={iconSize.inline} color={colors.onPrimary} />
          ) : (
            <Icon name="camera-outline" size={iconSize.inline} color={colors.primaryInk} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyStrong, task.is_done && styles.strike]}>{task.title}</Text>
          <View style={styles.meta}>
            {sending && <Text style={text.small}>{x.sending}</Text>}
            {task.done_at && (
              <View style={styles.tag}>
                <Icon name="check" size={13} color={colors.sage} />
                <Text style={[styles.tagText, { color: colors.sage }]}>{x.doneAt(fmtTime(task.done_at))}</Text>
              </View>
            )}
            {task.recurring && (
              <View style={styles.tag}>
                <Icon name="repeat" size={13} color={colors.textMuted} />
                <Text style={styles.tagText}>{x.everyDay}</Text>
              </View>
            )}
            {fromFamily && (
              <View style={[styles.tag, { backgroundColor: colors.butter }]}>
                <Icon name="account-heart-outline" size={13} color={colors.butterInk} />
                <Text style={[styles.tagText, { color: colors.butterInk }]}>{x.from(task.assigned_by!.split(' ')[0])}</Text>
              </View>
            )}
            {pending && <PendingTag />}
          </View>
        </View>
      </Pressable>

      {task.completion_id !== null && <ProofPhoto token={token} completionId={task.completion_id} caption={task.title} size={44} />}

      {/* a task the family assigned can be ticked off, but only they can change or remove it */}
      {!fromFamily && <IconButton icon="dots-vertical" label={`Options for ${task.title}`} onPress={() => onMenu(task)} size={40} />}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ringNum: { fontFamily: fonts.display, fontSize: type.h2, color: colors.text },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  list: { paddingLeft: spacing.ms, paddingRight: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tickArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.ms, minHeight: TAP + 24, paddingVertical: spacing.ms },
  tick: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickDone: { backgroundColor: colors.sage, borderColor: colors.sage, borderStyle: 'solid' },
  strike: { textDecorationLine: 'line-through', color: colors.textMuted },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.sunken,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.textMuted },
});
