// Design tokens. "Delft & Ice". The ONLY place colours, type, spacing, radii, shadow and motion are defined.
// Colour rules (from the brief; every pairing measured against WCAG AA, numbers are contrast ratios):
//  - 13 colours, nothing else. Transparent shades are ink with alpha (see `alpha`), never a new hue.
//  - Cobalt at full strength: the ONE primary action per screen, the active nav item, and text links (6.8 on white).
//    Text on cobalt is white (6.8).
//  - Cornflower is a fill or an accent, never text on a light colour (2.7 on white). Text on cornflower is ink (5.8).
//  - The hero: at most one card per screen is ink with white text and cornflower accents (5.8). Never cobalt or
//    muted text on ink (2.3 / 2.9).
//  - Muted text on white, the background or the cornflower tint only; on the cobalt tint (4.4) captions are ink.
//  - Status colours only for status. Green and amber are icons next to ink text (they fail as small text);
//    red text only on white (4.6); white text on a red fill (4.6) for destructive buttons and SOS.
//  - Warning: warning-tint background, ink text, an amber icon.
//  - Charts and rings: cobalt and cornflower and their tints. On light cards the ring arc is cobalt (readable on its
//    own); on the ink hero it is cornflower.
import { Easing, Platform, StatusBar } from 'react-native';

export const colors = {
  background: '#F7FAFD', // ice white, main app background
  surface: '#FFFFFF', // cards, sheets, inputs; also the white text on ink, cobalt and red
  primary: '#1E5AA8', // Delft cobalt
  primaryTint: '#DCE8F7',
  secondary: '#7C9CE0', // cornflower
  secondaryTint: '#E8EDFB',
  ink: '#0F2340', // deep navy: all text and icons, and the one hero card
  inkMuted: '#5A6B85',
  line: '#E3EAF3',
  success: '#1F8A5B',
  error: '#D14343',
  warning: '#B26A00',
  warningTint: '#FFF1D6',
};

// Ink with transparency, for the sheet backdrop and the photo viewer.
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
export const shade = { scrim: alpha(colors.ink, 0.45), photo: alpha(colors.ink, 0.94) };

// Text and icons sitting on each full-strength fill.
export const on = {
  primary: colors.surface,
  secondary: colors.ink,
  error: colors.surface,
  success: colors.surface,
  ink: colors.surface,
};

// Fonts (loaded in App.tsx). Android ignores fontWeight on custom fonts, so the weight is in the name.
export const fonts = {
  display: 'BricolageGrotesque_700Bold', // display and big numbers
  heading: 'BricolageGrotesque_600SemiBold',
  body: 'AtkinsonHyperlegibleNext_400Regular',
  bodyBold: 'AtkinsonHyperlegibleNext_700Bold',
};

// Exactly four text sizes in the whole app. Weight and colour make the rest of the hierarchy.
// The elderly screen's "text size" choice multiplies these same four (an accessibility setting, like phone font size).
export const size = { display: 32, heading: 20, body: 16, caption: 13 };
const lh = { display: 38, heading: 26, body: 24, caption: 18 };

export const text = {
  display: { fontFamily: fonts.display, fontSize: size.display, lineHeight: lh.display, color: colors.ink, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.heading, fontSize: size.heading, lineHeight: lh.heading, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: size.body, lineHeight: lh.body, color: colors.ink },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: size.body, lineHeight: lh.body, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: size.body, lineHeight: lh.body, color: colors.inkMuted },
  caption: { fontFamily: fonts.body, fontSize: size.caption, lineHeight: lh.caption, color: colors.inkMuted },
  captionStrong: { fontFamily: fonts.bodyBold, fontSize: size.caption, lineHeight: lh.caption, color: colors.ink },
  captionInk: { fontFamily: fonts.body, fontSize: size.caption, lineHeight: lh.caption, color: colors.ink }, // on the cobalt tint
} as const;

// The same styles for the one ink hero card per screen: white text, cornflower accent (no muted grey on ink).
const white = { color: colors.surface };
export const textOnInk = {
  display: { ...text.display, ...white },
  heading: { ...text.heading, ...white },
  body: { ...text.body, ...white },
  bodyStrong: { ...text.bodyStrong, ...white },
  caption: { ...text.caption, ...white },
  captionStrong: { ...text.captionStrong, ...white },
  accent: { ...text.captionStrong, color: colors.secondary },
} as const;

// Scale a text style for the elderly screen's text-size setting (same four sizes, multiplied).
export const scaled = <T extends { fontSize: number; lineHeight: number }>(s: T, k: number) => ({
  ...s,
  fontSize: Math.round(s.fontSize * k),
  lineHeight: Math.round(s.lineHeight * k),
});

// 8 px spacing scale only.
export const space = { s: 8, m: 16, l: 24, xl: 32, xxl: 48 };

// Cards and sheets 24, small elements (tiles, thumbnails) 12, buttons, chips and anything round: pill.
export const radius = { card: 24, small: 12, pill: 999 };

// One soft navy shadow, only for floating things: sheets, the sticky action bar, the nav bar, the toast.
export const shadow = {
  float: Platform.select({
    android: { elevation: 6, shadowColor: colors.ink },
    default: { shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  }),
};

// One easing curve, two durations.
export const motion = { easing: Easing.bezier(0.2, 0, 0, 1), fast: 150, slow: 300 };

// Smallest touch area (dp).
export const TAP = 48;

// Icons: one line library (Lucide), one stroke width, four sizes.
export const icon = { stroke: 2, xs: 16, s: 20, m: 24, l: 32 };

// Room for the phone's status bar (no safe-area library in this app).
export const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + space.s : 48;
