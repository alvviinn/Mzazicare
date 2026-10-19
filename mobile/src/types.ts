// 'user' is the family sponsor (the account everyone starts with).
// 'caretaker' and 'elderly' are assigned when a user adds that person's email.
export type Role = 'user' | 'caretaker' | 'elderly';

export type Member = {
  email: string;
  name: string | null; // null while the invite is still pending
  status: 'active' | 'pending';
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  sponsor: { name: string; email: string } | null; // the user who linked this family
  caretakers: Member[];
  elderly: Member[];
};

export type AuthResult = { token: string; name: string; role: Role };

// ---- Family dashboard ----

export type Tone = 'happy' | 'calm' | 'neutral' | 'stressed' | 'angry';

export type ChatPerson = { email: string; name: string; unread: number };

export type ShiftSummary = {
  id: number;
  caretaker: string;
  elderly: string;
  start: string;
  end: string | null;
  minutes: number; // verified time near the elder
  status: 'on_shift' | 'paused' | 'ended';
  source: 'auto' | 'manual';
  chores_done: number;
  chores_total: number;
  dominant_tone: Tone | null;
};

export type AlertItem = {
  id: number;
  kind: string;
  label: string;
  message: string;
  status: 'open' | 'confirmed' | 'dismissed';
  created_at: string;
};

export type Mood = 'good' | 'okay' | 'unwell';

export type Medicine = {
  id: number;
  elderly: string;
  elderly_email: string;
  name: string;
  dose: string;
  time: string; // 'HH:MM' (24 hour)
  taken: boolean;
  taken_at: string | null;
  state: 'taken' | 'due' | 'later' | 'missed';
};

// What the elderly person's home screen shows.
export type ElderHome = {
  caretaker: { status: 'here' | 'away' | 'left' | 'not_arrived' | 'none'; name: string | null };
  mood_today: { mood: Mood; at: string } | null;
  medicines: Medicine[];
};

export type Dashboard = {
  demo: boolean; // true while the numbers are sample data
  matched: boolean; // at least one caretaker AND one elderly person linked
  caretakers: ChatPerson[];
  elderly: ChatPerson[];
  today: {
    status: 'on_shift' | 'paused' | 'completed' | 'none';
    shifts: ShiftSummary[];
    chores: { description: string; is_done: boolean; done_at: string | null }[];
  };
  stats: { avg_visit_minutes: number | null; visits_7d: number; chore_rate_7d: number | null };
  tones: {
    items: { tone: Tone; emoji: string; label: string; percent: number }[];
    dominant: Tone | null;
    quality: 'good' | 'fair' | 'needs_attention' | null;
    positive_percent: number | null;
    negative_percent: number | null; // stressed + angry; the service-quality rating is based on this
  };
  recent_shifts: ShiftSummary[];
  alerts: AlertItem[];
  wellbeing: { name: string; mood: Mood | null; emoji: string | null; label: string | null; at: string | null }[];
  medicines: { taken: number; total: number; items: Medicine[] };
};

// ---- Caretaker ----

export type ShiftState = {
  status: 'none' | 'active' | 'waiting'; // waiting = shift open but not within range of the elder
  source: 'auto' | 'manual' | null;
  started_at: string | null;
  shift_minutes: number;
  today_minutes: number;
  emergency: { message: string; at: string } | null; // an open emergency from the elderly person
  elderly: { name: string; email: string } | null;
  range: {
    state: 'in' | 'out' | 'unknown';
    distance_m: number | null;
    elder_sharing: boolean; // false when the elder's phone isn't sending a fresh location
    radius_m: number;
  };
};

export type TaskItem = {
  id: number;
  title: string;
  recurring: boolean;
  is_done: boolean;
  done_at: string | null;
};

export type Hours = {
  today: number;
  week: number;
  month: number;
  total: number;
  recent: { id: number; elderly: string; start: string; end: string | null; minutes: number; source: 'auto' | 'manual' }[];
};

export type ChatMessage ={ id: number; mine: boolean; body: string; created_at: string };
