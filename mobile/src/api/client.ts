import { AuthResult, ChatMessage, Dashboard, ElderHome, Hours, Mood, Profile, ShiftState, TaskItem } from '../types';
import { mockAddMember, mockLogin, mockProfile, mockRegister } from './mockDb';

// When EXPO_PUBLIC_API_URL is set the app talks to the Django backend;
// otherwise it uses the on-device dev backend in mockDb.ts.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401 && token) throw new Error('SESSION_EXPIRED');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ?? 'Something went wrong. Please try again.');
  return data as T;
}

export const SESSION_EXPIRED = 'SESSION_EXPIRED';

export function login(email: string, password: string): Promise<AuthResult> {
  if (!API_URL) return mockLogin(email, password);
  return request('/api/auth/login/', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function register(name: string, email: string, password: string): Promise<AuthResult> {
  if (!API_URL) return mockRegister(name, email, password);
  return request('/api/auth/register/', { method: 'POST', body: JSON.stringify({ name, email, password }) });
}

export function getProfile(token: string): Promise<Profile> {
  if (!API_URL) return mockProfile(token);
  return request('/api/me/', { token });
}

// Dashboard and chat need the real backend (no on-device stand-in for them).
function needBackend(): never {
  throw new Error('Connect to the MzaziCare server to use this (set EXPO_PUBLIC_API_URL).');
}

export function getDashboard(token: string): Promise<Dashboard> {
  if (!API_URL) needBackend();
  return request('/api/dashboard/', { token });
}

export function resolveAlert(token: string, id: number, status: 'confirmed' | 'dismissed'): Promise<void> {
  if (!API_URL) needBackend();
  return request(`/api/alerts/${id}/`, { method: 'POST', token, body: JSON.stringify({ status }) });
}

export function getMessages(token: string, withEmail: string): Promise<ChatMessage[]> {
  if (!API_URL) needBackend();
  return request(`/api/chat/?with=${encodeURIComponent(withEmail)}`, { token });
}

export function sendMessage(token: string, to: string, body: string): Promise<ChatMessage> {
  if (!API_URL) needBackend();
  return request('/api/chat/', { method: 'POST', token, body: JSON.stringify({ to, body }) });
}

// ---- Phones (caretaker and elderly) ----

export function sendLocation(
  token: string,
  fix: { latitude: number; longitude: number; accuracy: number | null; mocked: boolean },
): Promise<void> {
  if (!API_URL) needBackend();
  return request('/api/location/', { method: 'POST', token, body: JSON.stringify(fix) });
}

// ---- Elderly ----

export function getElderHome(token: string): Promise<ElderHome> {
  if (!API_URL) needBackend();
  return request('/api/elder/home/', { token });
}

export function sendCheckIn(token: string, mood: Mood): Promise<void> {
  if (!API_URL) needBackend();
  return request('/api/elder/checkin/', { method: 'POST', token, body: JSON.stringify({ mood }) });
}

export function sendSos(token: string): Promise<void> {
  if (!API_URL) needBackend();
  return request('/api/elder/sos/', { method: 'POST', token });
}

export function takeMedicine(token: string, id: number): Promise<void> {
  if (!API_URL) needBackend();
  return request(`/api/medicines/${id}/take/`, { method: 'POST', token });
}

// ---- Family: medicine reminders ----

export function addMedicine(
  token: string,
  m: { elderly_email: string; name: string; dose: string; time: string },
): Promise<void> {
  if (!API_URL) needBackend();
  return request('/api/medicines/', { method: 'POST', token, body: JSON.stringify(m) });
}

export function deleteMedicine(token: string, id: number): Promise<void> {
  if (!API_URL) needBackend();
  return request(`/api/medicines/${id}/`, { method: 'DELETE', token });
}

// ---- Caretaker ----

export function getShiftState(token: string): Promise<ShiftState> {
  if (!API_URL) needBackend();
  return request('/api/shift/state/', { token });
}

export function startShift(token: string): Promise<ShiftState> {
  if (!API_URL) needBackend();
  return request('/api/shift/start/', { method: 'POST', token });
}

export function stopShift(token: string): Promise<ShiftState> {
  if (!API_URL) needBackend();
  return request('/api/shift/stop/', { method: 'POST', token });
}

export function getHours(token: string): Promise<Hours> {
  if (!API_URL) needBackend();
  return request('/api/hours/', { token });
}

export function getTasks(token: string): Promise<TaskItem[]> {
  if (!API_URL) needBackend();
  return request('/api/tasks/', { token });
}

export function addTask(token: string, title: string, recurring: boolean): Promise<TaskItem> {
  if (!API_URL) needBackend();
  return request('/api/tasks/', { method: 'POST', token, body: JSON.stringify({ title, recurring }) });
}

export function updateTask(token: string, id: number, changes: { is_done?: boolean; recurring?: boolean }): Promise<TaskItem> {
  if (!API_URL) needBackend();
  return request(`/api/tasks/${id}/`, { method: 'PATCH', token, body: JSON.stringify(changes) });
}

export function deleteTask(token: string, id: number): Promise<void> {
  if (!API_URL) needBackend();
  return request(`/api/tasks/${id}/`, { method: 'DELETE', token });
}

export function addMember(token: string, email: string, role: 'caretaker' | 'elderly'): Promise<void> {
  if (!API_URL) return mockAddMember(token, email, role);
  return request('/api/team/', { method: 'POST', token, body: JSON.stringify({ email, role }) });
}
