// Design tokens. "Marigold & Mulberry". The ONLY place colours, type, spacing, radii, shadow and motion are defined.
// Rules (from the brief; contrast measured, WCAG AA):
//  - 11 colours, nothing else. Transparent shades are ink with alpha (see `alpha`), never a new hue.
//  - Marigold at full strength: the ONE primary action per screen and the active nav item. Charts may also use it,
//    but never as the only carrier of a value (marigold is 1.9:1 on cards), so a number always sits beside it.
//  - Text on marigold is ink (8.0:1). Text on mulberry, brick or olive fills is `surface`, the palette's white.
//  - Olive text only on `surface` (4.5:1); elsewhere olive is an icon next to ink text.
//  - Brick text on background, surface or primary-tint only (fails on secondary-tint).
//  - Progress rings draw in mulberry (7.7:1) so the arc itself is readable.
import { Easing, Platform, StatusBar } from 'react-native';

export const colors = {
  background: '#FBF6EE', // warm rice paper
  surface: '#FFFDF9', // cards, sheets, inputs; also the "white" text on dark fills
  primary: '#F2A93B', // marigold
  primaryTint: '#FCEBCB',
  secondary: '#7A3E5D', // mulberry
  secondaryTint: '#F1E2EA',
  ink: '#2B1E24',
  inkMuted: '#6E5F66',
  line: '#EADFD2',
  success: '#5E7F35', // olive
  error: '#C23B22', // brick
};

// Ink with transparency, for the sheet backdrop and the photo viewer.
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
export const shade = { scrim: alpha(colors.ink, 0.45), photo: alpha(colors.ink, 0.94) };

// Text sitting on each full-strength fill.
export const on = { primary: colors.ink, secondary: colors.surface, error: colors.surface, success: colors.surface };

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

// One warm shadow, only for floating things: sheets, the sticky action bar, the nav bar, the toast.
export const shadow = {
  float: Platform.select({
    android: { elevation: 6, shadowColor: colors.secondary },
    default: { shadowColor: colors.secondary, shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
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
