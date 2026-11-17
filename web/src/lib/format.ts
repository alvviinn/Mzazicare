import { ShiftStatus, Tone } from './types';

// The status pill's tones, as in the app: the dot carries the status colour, the words are ink.
export type PillTone = 'success' | 'ink' | 'muted' | 'error' | 'secondary' | 'warning';

export const TONE_LABEL: Record<Tone, string> = {
  happy: 'Happy',
  calm: 'Calm',
  neutral: 'Neutral',
  stressed: 'Stressed',
  angry: 'Angry',
};
export const TONE_ORDER: Tone[] = ['happy', 'calm', 'neutral', 'stressed', 'angry'];

// Tone charts draw each of the five tones in its own colour (green happy, light green calm, grey neutral, amber stressed,
// red angry; same as the app), stacked with angry at the bottom and happy on top.
// The exact share of each tone is always written next to the chart too (legend and the picked column).
export type Band = { key: Tone; label: string; color: string; tones: Tone[] };
export const BANDS: Band[] = (['angry', 'stressed', 'neutral', 'calm', 'happy'] as Tone[]).map((t) => ({
  key: t,
  label: TONE_LABEL[t],
  color: `var(--tone-${t})`,
  tones: [t],
}));
export const bandShare = (shares: Partial<Record<Tone, number>>, b: Band) => b.tones.reduce((n, t) => n + (shares[t] ?? 0), 0);
// Tension bars: green up to 15%, amber up to the 30% line, red above it.
export const tensionColor = (t: number) => (t > 30 ? 'var(--tone-angry)' : t > 15 ? 'var(--tone-stressed)' : 'var(--tone-happy)');

export const STATUS_LABEL: Record<ShiftStatus, { text: string; tone: PillTone }> = {
  on_shift: { text: 'On shift', tone: 'success' },
  paused: { text: 'On a break', tone: 'ink' },
  away: { text: 'Away', tone: 'ink' },
  waiting: { text: 'Not arrived', tone: 'muted' },
  ended: { text: 'Finished', tone: 'muted' },
};

export const QUALITY_LABEL: Record<'good' | 'fair' | 'needs_attention', { text: string; tone: PillTone }> = {
  good: { text: 'Good', tone: 'success' },
  fair: { text: 'Fair', tone: 'ink' },
  needs_attention: { text: 'Needs attention', tone: 'error' },
};

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

// The server sends a shift's day as 'YYYY-MM-DD' (Nairobi time). Noon avoids any time-zone edge.
const parseDay = (date: string) => new Date(`${date}T12:00:00`);

function localDateString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 'Today', 'Yesterday' or 'Tue 20 Oct' */
export function fmtShiftDay(date: string): string {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (date === localDateString(today)) return 'Today';
  if (date === localDateString(yesterday)) return 'Yesterday';
  return parseDay(date).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/** 'Tuesday 20 October' */
export function fmtShiftDayLong(date: string): string {
  return parseDay(date).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export const weekday = (date: string) => parseDay(date).toLocaleDateString([], { weekday: 'short' });

export function fmtDuration(minutes: number | null): string {
  if (minutes === null) return '–';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} hr ago`;
  return fmtDay(iso);
}

export const timeOfDay = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** 'Monday 16 November' */
export const today = () => new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
export const firstName = (name: string) => name.split(' ')[0];
