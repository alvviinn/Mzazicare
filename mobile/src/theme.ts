// Shared design tokens. Reuse these everywhere so the app stays visually consistent.
export const colors = {
  primary: '#1F6F5F', // deep teal green: trust, care
  primaryDark: '#16554A',
  primarySoft: '#E3F0ED',
  background: '#F8F6F1', // warm off-white
  surface: '#FFFFFF',
  text: '#1E2A28',
  textMuted: '#6B7774',
  border: '#D9DED9',
  danger: '#B3372F',
  dangerSoft: '#F9E7E5',
  warning: '#A8700F',
  warningSoft: '#FBF1DC',
  success: '#2E7D5B',
  onPrimary: '#FFFFFF',
};

// Bar colours for the voice-tone breakdown.
export const toneColors: Record<string, string> = {
  happy: '#3E9B6B',
  calm: '#6FB7A8',
  neutral: '#A6AFAC',
  stressed: '#D9A03A',
  angry: '#C4503F',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { md: 12, lg: 16 };
