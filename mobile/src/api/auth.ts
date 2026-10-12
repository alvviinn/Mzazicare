const API_URL = process.env.EXPO_PUBLIC_API_URL;

export type LoginResult = { token: string; name: string; role: 'caregiver' | 'sponsor' };

// Calls the Django backend (POST /api/auth/login/) once it exists.
// Until EXPO_PUBLIC_API_URL is set, a development stub accepts any valid-looking credentials.
export async function login(email: string, password: string): Promise<LoginResult> {
  if (!API_URL) {
    await new Promise((r) => setTimeout(r, 600));
    return { token: 'dev-token', name: email.split('@')[0], role: 'caregiver' };
  }

  const res = await fetch(`${API_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 400 || res.status === 401) {
    throw new Error('Incorrect email or password.');
  }
  if (!res.ok) {
    throw new Error('Something went wrong. Please try again.');
  }
  return res.json();
}
