import { ShiftStatus, Tone } from './types';

export const TONE_COLOR: Record<Tone, string> = {
  happy: '#3E9B6B',
  calm: '#6FB7A8',
  neutral: '#A6AFAC',
  stressed: '#D9A03A',
  angry: '#C4503F',
};

export const TONE_LABEL: Record<Tone, string> = {
  happy: 'Happy',
  calm: 'Calm',
  neutral: 'Neutral',
  stressed: 'Stressed',
  angry: 'Angry',
};

// stacking order in the chart: tense at the bottom, happy on top
export const TONE_STACK: Tone[] = ['angry', 'stressed', 'neutral', 'calm', 'happy'];

export const STATUS_LABEL: Record<ShiftStatus, { text: string; tone: 'good' | 'warn' | 'quiet' }> = {
  on_shift: { text: 'On shift', tone: 'good' },
  paused: { text: 'On a break', tone: 'warn' },
  away: { text: 'Away', tone: 'warn' },
  waiting: { text: 'Not arrived', tone: 'quiet' },
  ended: { text: 'Finished', tone: 'quiet' },
};

export const QUALITY_LABEL = {
  good: { text: 'Good', tone: 'good' },
  fair: { text: 'Fair', tone: 'warn' },
  needs_attention: { text: 'Needs attention', tone: 'bad' },
} as const;

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
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return fmtDay(iso);
}

export const timeOfDay = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
