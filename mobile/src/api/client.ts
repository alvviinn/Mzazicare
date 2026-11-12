import {
  AudioStatus,
  AuthResult,
  ChatMessage,
  CodeChallenge,
  Dashboard,
  ElderHome,
  FirstAidReply,
  Hours,
  LiveTone,
  Mood,
  Profile,
  ShiftDetail,
  ShiftState,
  ShiftSummary,
  SignInResult,
  TaskHistory,
  TaskItem,
} from '../types';

import { NETWORK_ERROR, setOnline } from '../net';

// Address of the Django backend, set in mobile/.env.local (see mobile/.env.example).
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const SESSION_EXPIRED = 'SESSION_EXPIRED';

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  if (!API_URL) {
    throw new Error('The app does not know where the server is. Set EXPO_PUBLIC_API_URL in mobile/.env.local.');
  }
  const { token, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    setOnline(false);
    throw new Error(NETWORK_ERROR);
  }
  setOnline(true);
  if (res.status === 401 && token) throw new Error(SESSION_EXPIRED);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ?? 'Something went wrong. Please try again.');
  return data as T;
}

const post = (body?: unknown) => ({ method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

// ---- Account ----

export const login = (email: string, password: string): Promise<SignInResult> =>
  request('/api/auth/login/', post({ email, password }));

export const register = (name: string, email: string, password: string): Promise<SignInResult> =>
  request('/api/auth/register/', post({ name, email, password }));

// The second step for accounts that need it: the 6-digit code that was emailed.
export const verifyCode = (challenge: string, code: string): Promise<AuthResult> =>
  request('/api/auth/verify/', post({ challenge, code }));

export const resendCode = (challenge: string): Promise<CodeChallenge> => request('/api/auth/resend/', post({ challenge }));

// Google has verified the person, so there is no emailed code.
export const googleSignIn = (idToken: string): Promise<AuthResult> => request('/api/auth/google/', post({ id_token: idToken }));

export const getProfile = (token: string): Promise<Profile> => request('/api/me/', { token });

export const addMember = (token: string, email: string, role: 'caretaker' | 'elderly'): Promise<void> =>
  request('/api/team/', { ...post({ email, role }), token });

// ---- Family: dashboard, alerts, chat, medicine reminders ----

export const getDashboard = (token: string): Promise<Dashboard> => request('/api/dashboard/', { token });

export const resolveAlert = (token: string, id: number, status: 'confirmed' | 'dismissed'): Promise<void> =>
  request(`/api/alerts/${id}/`, { ...post({ status }), token });

export const getMessages = (token: string, withEmail: string): Promise<ChatMessage[]> =>
  request(`/api/chat/?with=${encodeURIComponent(withEmail)}`, { token });

export const sendMessage = (token: string, to: string, body: string): Promise<ChatMessage> =>
  request('/api/chat/', { ...post({ to, body }), token });

export const addMedicine = (
  token: string,
  m: { elderly_email: string; name: string; dose: string; time: string },
): Promise<void> => request('/api/medicines/', { ...post(m), token });

export const deleteMedicine = (token: string, id: number): Promise<void> =>
  request(`/api/medicines/${id}/`, { method: 'DELETE', token });

export const assignTask = (
  token: string,
  t: { caretaker_email: string; title: string; recurring: boolean },
): Promise<TaskItem> => request('/api/tasks/', { ...post(t), token });

// ---- Shifts (one per day): caretaker and family ----

export const getShifts = (token: string, days = 30): Promise<ShiftSummary[]> =>
  request(`/api/shifts/?days=${days}`, { token });

export const getShift = (token: string, id: number): Promise<ShiftDetail> => request(`/api/shifts/${id}/`, { token });

export const getLiveTone = (token: string): Promise<LiveTone> => request('/api/tone/live/', { token });

// ---- Phones (caretaker and elderly) ----

export const sendLocation = (
  token: string,
  fix: { latitude: number; longitude: number; accuracy: number | null; mocked: boolean },
): Promise<void> => request('/api/location/', { ...post(fix), token });

// ---- Voice monitoring ----

export const getAudioStatus = (token: string): Promise<AudioStatus> => request('/api/audio/status/', { token });

export const setVoiceConsent = (token: string, consent: boolean): Promise<{ consent: boolean }> =>
  request('/api/audio/consent/', { ...post({ consent }), token });

// One short clip. The server analyses it in memory and keeps only the tone numbers.
export async function sendAudioClip(token: string, clip: ArrayBuffer): Promise<void> {
  if (!API_URL) return;
  const res = await fetch(`${API_URL}/api/audio/tone/`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/mp4', Authorization: `Bearer ${token}` },
    body: clip,
  });
  if (res.status === 401) throw new Error(SESSION_EXPIRED);
}

// ---- Elderly ----

export const getElderHome = (token: string): Promise<ElderHome> => request('/api/elder/home/', { token });

export const sendCheckIn = (token: string, mood: Mood): Promise<void> =>
  request('/api/elder/checkin/', { ...post({ mood }), token });

export const sendSos = (token: string): Promise<void> => request('/api/elder/sos/', { ...post(), token });

export const takeMedicine = (token: string, id: number): Promise<void> =>
  request(`/api/medicines/${id}/take/`, { ...post(), token });

// ---- Caretaker ----

export const getShiftState = (token: string): Promise<ShiftState> => request('/api/shift/state/', { token });

export const startShift = (token: string): Promise<ShiftState> => request('/api/shift/start/', { ...post(), token });

export const stopShift = (token: string): Promise<ShiftState> => request('/api/shift/stop/', { ...post(), token });

export const getHours = (token: string): Promise<Hours> => request('/api/hours/', { token });

export const getTasks = (token: string): Promise<TaskItem[]> => request('/api/tasks/', { token });

export const addTask = (token: string, title: string, recurring: boolean): Promise<TaskItem> =>
  request('/api/tasks/', { ...post({ title, recurring }), token });

export const updateTask = (
  token: string,
  id: number,
  changes: { is_done?: boolean; recurring?: boolean },
): Promise<TaskItem> => request(`/api/tasks/${id}/`, { method: 'PATCH', token, body: JSON.stringify(changes) });

export const deleteTask = (token: string, id: number): Promise<void> =>
  request(`/api/tasks/${id}/`, { method: 'DELETE', token });

// Ticks a task off with the proof photo as the request body (same idea as the voice clips).
export async function completeTask(token: string, id: number, photo: ArrayBuffer, type = 'image/jpeg'): Promise<TaskItem> {
  if (!API_URL) throw new Error('The app does not know where the server is. Set EXPO_PUBLIC_API_URL in mobile/.env.local.');
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/tasks/${id}/done/`, {
      method: 'POST',
      headers: { 'Content-Type': type, Authorization: `Bearer ${token}` },
      body: photo,
    });
  } catch {
    setOnline(false);
    throw new Error(NETWORK_ERROR);
  }
  setOnline(true);
  if (res.status === 401) throw new Error(SESSION_EXPIRED);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ?? 'Could not send the photo. Please try again.');
  return data as TaskItem;
}

export const getTaskHistory = (token: string, days = 30): Promise<TaskHistory> =>
  request(`/api/tasks/history/?days=${days}`, { token });

// Image source for a proof photo: it is only served to a signed-in caretaker or family member.
export const proofPhotoSource = (token: string, completionId: number) => ({
  uri: `${API_URL}/api/tasks/completions/${completionId}/photo/`,
  headers: { Authorization: `Bearer ${token}` },
});

// ---- First-aid assistant (caretakers). Messages are answered and not stored. ----
export const askFirstAid = (
  token: string,
  body: { message?: string; topic?: string; awaiting?: string | null; lang?: 'en' | 'sw'; check?: 'yes' | 'no' },
): Promise<FirstAidReply> => request('/api/firstaid/chat/', { ...post(body), token });
