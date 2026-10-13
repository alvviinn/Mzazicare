import { AuthResult, ChatMessage, Dashboard, Profile } from '../types';
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

export function addMember(token: string, email: string, role: 'caretaker' | 'elderly'): Promise<void> {
  if (!API_URL) return mockAddMember(token, email, role);
  return request('/api/team/', { method: 'POST', token, body: JSON.stringify({ email, role }) });
}
