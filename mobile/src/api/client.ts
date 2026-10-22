import { AuthResult, ChatMessage, Dashboard, ElderHome, Hours, Mood, Profile, ShiftState, TaskItem } from '../types';

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
    throw new Error("Can't reach the server. Check your internet connection and that the backend is running.");
  }
  if (res.status === 401 && token) throw new Error(SESSION_EXPIRED);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ?? 'Something went wrong. Please try again.');
  return data as T;
}

const post = (body?: unknown) => ({ method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

// ---- Account ----

export const login = (email: string, password: string): Promise<AuthResult> =>
  request('/api/auth/login/', post({ email, password }));

export const register = (name: string, email: string, password: string): Promise<AuthResult> =>
  request('/api/auth/register/', post({ name, email, password }));

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

// ---- Phones (caretaker and elderly) ----

export const sendLocation = (
  token: string,
  fix: { latitude: number; longitude: number; accuracy: number | null; mocked: boolean },
): Promise<void> => request('/api/location/', { ...post(fix), token });

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
