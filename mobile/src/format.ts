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
