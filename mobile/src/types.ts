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
  minutes: number;
  chores_done: number;
  chores_total: number;
  dominant_emoji: string | null;
};

export type AlertItem = {
  id: number;
  kind: string;
  label: string;
  message: string;
  status: 'open' | 'confirmed' | 'dismissed';
  created_at: string;
};

export type Dashboard = {
  demo: boolean; // true while the numbers are sample data
  matched: boolean; // at least one caretaker AND one elderly person linked
  caretakers: ChatPerson[];
  elderly: ChatPerson[];
  today: {
    status: 'on_shift' | 'completed' | 'none';
    shifts: ShiftSummary[];
    chores: { description: string; is_done: boolean; done_at: string | null }[];
  };
  stats: { avg_visit_minutes: number | null; visits_7d: number; chore_rate_7d: number | null };
  tones: {
    items: { tone: Tone; emoji: string; label: string; percent: number }[];
    dominant: Tone | null;
    quality: 'good' | 'fair' | 'needs_attention' | null;
    positive_percent: number | null;
  };
  recent_shifts: ShiftSummary[];
  alerts: AlertItem[];
};

export type ChatMessage = { id: number; mine: boolean; body: string; created_at: string };
