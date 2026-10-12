// Development-only stand-in for the Django backend. Data lives in AsyncStorage on the device.
// Passwords are stored in plain text here ON PURPOSE for dev; the real backend must hash them.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthResult, Member, Profile, Role } from '../types';

const KEY = 'mzazicare_mockdb';

type DbUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  sponsorId: string | null;
};
type Invite = { email: string; role: 'caretaker' | 'elderly'; sponsorId: string };
type Db = { users: DbUser[]; invites: Invite[] };

async function read(): Promise<Db> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : { users: [], invites: [] };
}
const write = (db: Db) => AsyncStorage.setItem(KEY, JSON.stringify(db));
const norm = (email: string) => email.trim().toLowerCase();
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function mockRegister(name: string, email: string, password: string): Promise<AuthResult> {
  const db = await read();
  email = norm(email);
  if (db.users.some((u) => u.email === email)) {
    throw new Error('An account with this email already exists.');
  }
  // If someone already added this email as a caretaker/elderly, they start with that role.
  const invite = db.invites.find((i) => i.email === email);
  const user: DbUser = {
    id: newId(),
    name: name.trim(),
    email,
    password,
    role: invite ? invite.role : 'user',
    sponsorId: invite ? invite.sponsorId : null,
  };
  db.users.push(user);
  db.invites = db.invites.filter((i) => i.email !== email);
  await write(db);
  return { token: user.id, name: user.name, role: user.role };
}

export async function mockLogin(email: string, password: string): Promise<AuthResult> {
  const db = await read();
  const user = db.users.find((u) => u.email === norm(email) && u.password === password);
  if (!user) throw new Error('Incorrect email or password.');
  return { token: user.id, name: user.name, role: user.role };
}

export async function mockProfile(token: string): Promise<Profile> {
  const db = await read();
  const me = db.users.find((u) => u.id === token);
  if (!me) throw new Error('SESSION_EXPIRED');

  const sponsorId = me.role === 'user' ? me.id : me.sponsorId;
  const sponsor = db.users.find((u) => u.id === sponsorId) ?? null;

  const active = (role: Role): Member[] =>
    db.users
      .filter((u) => u.sponsorId === sponsorId && u.role === role)
      .map((u) => ({ email: u.email, name: u.name, status: 'active' }));
  const pending = (role: Role): Member[] =>
    me.role === 'user'
      ? db.invites
          .filter((i) => i.sponsorId === sponsorId && i.role === role)
          .map((i) => ({ email: i.email, name: null, status: 'pending' }))
      : [];

  return {
    id: me.id,
    name: me.name,
    email: me.email,
    role: me.role,
    sponsor: sponsor && sponsor.id !== me.id ? { name: sponsor.name, email: sponsor.email } : null,
    caretakers: [...active('caretaker'), ...pending('caretaker')],
    elderly: [...active('elderly'), ...pending('elderly')],
  };
}

export async function mockAddMember(token: string, email: string, role: 'caretaker' | 'elderly') {
  const db = await read();
  const sponsor = db.users.find((u) => u.id === token);
  if (!sponsor) throw new Error('SESSION_EXPIRED');
  if (sponsor.role !== 'user') throw new Error('Only family accounts can add people.');

  email = norm(email);
  if (email === sponsor.email) throw new Error('You cannot add your own email.');

  const existing = db.users.find((u) => u.email === email);
  if (existing) {
    const alreadyLinked = existing.sponsorId === sponsor.id;
    if (alreadyLinked) throw new Error('This person is already in your care circle.');
    const isFamilyOwner =
      db.users.some((u) => u.sponsorId === existing.id) || db.invites.some((i) => i.sponsorId === existing.id);
    if (existing.role !== 'user' || isFamilyOwner) {
      throw new Error('This account is already linked to another family.');
    }
    existing.role = role; // convert the existing account
    existing.sponsorId = sponsor.id;
  } else {
    if (db.invites.some((i) => i.email === email)) {
      throw new Error('This email has already been invited.');
    }
    db.invites.push({ email, role, sponsorId: sponsor.id });
  }
  await write(db);
}
