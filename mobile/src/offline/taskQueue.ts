import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { addTask, completeTask, deleteTask, updateTask } from '../api/client';
import { NETWORK_ERROR, subscribe as onNetChange, isOnline } from '../net';
import { TaskItem } from '../types';

// Task changes made while offline wait here (saved on the phone) and are sent, in order, once the
// server can be reached again. Proof photos are kept in the app's own folder until they are sent.

export type TaskOp =
  | { kind: 'add'; tempId: number; title: string; recurring: boolean; at: string }
  | { kind: 'done'; id: number; photo: string; mime: string; at: string }
  | { kind: 'update'; id: number; changes: { is_done?: boolean; recurring?: boolean } }
  | { kind: 'delete'; id: number };

const KEY = 'mzazi.pendingTaskChanges';

let ops: TaskOp[] = [];
let loaded = false;
let flushing = false;
let lastProblem = ''; // a change the server refused while syncing, shown once
const listeners = new Set<() => void>();
let snapshot = { ops, problem: lastProblem };

function changed() {
  snapshot = { ops, problem: lastProblem };
  listeners.forEach((l) => l());
}

async function save() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    /* storage full or unavailable: the changes stay in memory */
  }
}

export async function loadQueue() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) ops = JSON.parse(raw);
  } catch {
    ops = [];
  }
  changed();
}

export async function enqueue(op: TaskOp) {
  ops = [...ops, op];
  changed();
  await save();
}

// Keep a photo taken offline in the app's own folder until it can be sent.
export async function keepPhoto(uri: string): Promise<string> {
  const dest = new File(Paths.document, `pending-proof-${Date.now()}.jpg`);
  await new File(uri).copy(dest);
  return dest.uri;
}

function removePhoto(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    /* already gone */
  }
}

// Sends the waiting changes in order. Stops at the first network failure and tries again later.
export async function flush(token: string) {
  if (flushing || ops.length === 0) return;
  flushing = true;
  const ids = new Map<number, number>(); // temporary id of a task added offline -> its real id
  const real = (id: number) => ids.get(id) ?? id;
  try {
    while (ops.length > 0) {
      const op = ops[0];
      try {
        if (op.kind === 'add') {
          const t = await addTask(token, op.title, op.recurring);
          ids.set(op.tempId, t.id);
          ops = ops.map((o) => ('id' in o && o.id === op.tempId ? { ...o, id: t.id } : o));
        } else if (op.kind === 'done') {
          const file = new File(op.photo);
          await completeTask(token, real(op.id), await file.arrayBuffer(), op.mime);
          removePhoto(op.photo);
        } else if (op.kind === 'update') {
          await updateTask(token, real(op.id), op.changes);
        } else if (op.id > 0) {
          await deleteTask(token, real(op.id));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        if (message === NETWORK_ERROR) break; // still offline: keep everything for next time
        // The server refused this one (e.g. the task was deleted meanwhile): drop it and say so.
        lastProblem = message || 'A change made offline could not be saved.';
        if (op.kind === 'done') removePhoto(op.photo);
      }
      ops = ops.slice(1);
      changed();
      await save();
    }
  } finally {
    flushing = false;
  }
}

export function clearProblem() {
  lastProblem = '';
  changed();
}

// The server's list with the waiting changes laid over it, and which tasks are not yet synced.
export function withPending(tasks: TaskItem[], queue: TaskOp[], caretaker: string) {
  let list = [...tasks];
  const pending = new Set<number>();
  for (const op of queue) {
    if (op.kind === 'add') {
      list.push({
        id: op.tempId,
        title: op.title,
        recurring: op.recurring,
        is_done: false,
        done_at: null,
        caretaker,
        assigned_by: null,
        completion_id: null,
      });
      pending.add(op.tempId);
    } else if (op.kind === 'done') {
      list = list.map((t) => (t.id === op.id ? { ...t, is_done: true, done_at: op.at } : t));
      pending.add(op.id);
    } else if (op.kind === 'update') {
      list = list.map((t) =>
        t.id === op.id
          ? { ...t, ...op.changes, ...(op.changes.is_done === false ? { done_at: null, completion_id: null } : {}) }
          : t,
      );
      pending.add(op.id);
    } else {
      list = list.filter((t) => t.id !== op.id);
    }
  }
  return { list, pending };
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getSnapshot = () => snapshot;

export function useTaskQueue() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Send waiting changes as soon as the server is reachable again.
export function startAutoSync(getToken: () => string | null) {
  return onNetChange(() => {
    const token = getToken();
    if (isOnline() && token) flush(token);
  });
}
