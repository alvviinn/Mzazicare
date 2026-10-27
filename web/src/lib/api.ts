import { ChatMessage, Dashboard, LiveTone, Profile, ShiftDetail, ShiftSummary } from './types';

// Address of the Django backend, set in web/.env.local (see web/.env.example).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

export const SESSION_EXPIRED = 'SESSION_EXPIRED';

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
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
    throw new Error("Can't reach the server. Check that the backend is running and NEXT_PUBLIC_API_URL is right.");
  }
  if (res.status === 401 && token) throw new Error(SESSION_EXPIRED);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ?? 'Something went wrong. Please try again.');
  return data as T;
}

const post = (body?: unknown) => ({ method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const login = (email: string, password: string): Promise<{ token: string; name: string; role: string }> =>
  request('/api/auth/login/', post({ email, password }));

export const getProfile = (token: string): Promise<Profile> => request('/api/me/', { token });

export const addMember = (token: string, email: string, role: 'caretaker' | 'elderly'): Promise<void> =>
  request('/api/team/', { ...post({ email, role }), token });

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

export const getShifts = (token: string, days = 30): Promise<ShiftSummary[]> =>
  request(`/api/shifts/?days=${days}`, { token });

export const getShift = (token: string, id: number): Promise<ShiftDetail> => request(`/api/shifts/${id}/`, { token });

export const getLiveTone = (token: string): Promise<LiveTone> => request('/api/tone/live/', { token });
