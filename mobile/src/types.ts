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

// A shift is one DAY of work. Stepping out of range is a break; the same shift continues when the caretaker returns.
export type ShiftStatus = 'on_shift' | 'paused' | 'away' | 'waiting' | 'ended';

export type ShiftSummary = {
  id: number;
  date: string; // 'YYYY-MM-DD' (Nairobi)
  caretaker: string;
  elderly: string;
  start: string; // first arrival (or when it was opened, if they never arrived)
  arrived: string | null;
  left: string | null; // the last time they left range; null while they are there
  end: string | null; // when the day's shift closed; null while it is still open
  minutes: number; // active, verified time near the elder (breaks excluded)
  breaks: number;
  break_minutes: number;
  status: ShiftStatus; // paused = on a break, away = a long break
  source: 'auto' | 'manual';
  chores_done: number;
  chores_total: number;
  dominant_tone?: Tone | null; // only in the family dashboard
};

export type TimelineEvent = {
  kind: 'started' | 'arrived' | 'stepped_out' | 'returned' | 'left';
  at: string;
  break_minutes?: number; // on 'returned': how long the break was
  note?: string;
};

export type ShiftDetail = ShiftSummary & {
  phase: 'waiting' | 'active' | 'break' | 'away' | 'ended';
  timeline: TimelineEvent[];
  segments: { start: string; end: string | null; minutes: number }[];
  breaks_list: { start: string; end: string | null; minutes: number }[];
  chores: { description: string; is_done: boolean; done_at: string | null }[];
  tones?: Dashboard['tones']; // family only
  tone_timeline?: TonePoint[]; // family only
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
    status: 'on_shift' | 'paused' | 'away' | 'waiting' | 'completed' | 'none';
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

// ---- Live tone (family) ----

export type ToneShares = Record<Tone, number>; // percent, adds up to 100
export type TonePoint = {
  start: string; // the start of the time bucket
  speech_s: number;
  shares: ToneShares;
  tension: number; // stressed + angry, percent
  positive: number; // happy + calm, percent
  dominant: Tone;
};
export type LiveTone = {
  state: 'live' | 'listening' | 'idle'; // live: speech heard in the last 3 minutes
  last_heard: string | null;
  current: { shares: ToneShares; dominant: Tone; tension: number } | null; // last 5 minutes
  series: TonePoint[];
  bucket_minutes: number;
  earlier_days: { date: string; tension: number; positive: number }[];
  today: (Dashboard['tones'] & {
    speech_minutes: number;
    clips: number;
    calmest: { start: string; tension: number };
    tensest: { start: string; tension: number };
    usual_tension: number | null;
    raised_voice_clips: number;
    vocal_alerts: number;
  }) | null;
};

// ---- Caretaker ----

export type ShiftState = {
  status: 'none' | 'active' | 'waiting'; // waiting = shift open but not within range of the elder
  // what to say: waiting (not arrived yet), active, break, away (a long break), ended (End tapped), none
  phase: 'none' | 'waiting' | 'active' | 'break' | 'away' | 'ended';
  today: ShiftSummary | null; // today's shift as a card, so it can be opened even after End
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
  recent: ShiftSummary[]; // one card per day worked
};

export type ChatMessage = { id: number; mine: boolean; body: string; created_at: string };
