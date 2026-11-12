// Design tokens: the only place colours, type, spacing, radii and shadows are defined.
// Direction "Kanga Morning": warm oat paper, papaya for the one action on each screen, deep sage for calm
// and "all good", tinted surfaces instead of grey boxes, and a thin kanga-cloth stripe as the signature.
// Every text/background pair below was checked for WCAG AA (4.5:1 text, 3:1 icons and chart marks).
import { Platform, StatusBar } from 'react-native';

export const colors = {
  // brand
  primary: '#C4471F', // papaya: the main button on a screen (white text 4.9:1)
  primaryPressed: '#A63A16',
  primaryInk: '#A63A16', // papaya used as text or icon on light surfaces (5.3:1 on peach)
  primarySoft: '#FBE3D6', // peach tint
  onPrimary: '#FFFFFF',

  sage: '#2F6152', // calm secondary: live, success, "in range" (6.5:1 on page)
  sagePressed: '#244C40',
  sageSoft: '#E1ECE3',

  butter: '#F8E7BD', // third tint for tiles
  butterInk: '#7A5300', // 5.6:1 on butter

  // paper and ink
  background: '#FAF3EA', // oat page
  surface: '#FFFCF7', // warm white card
  sunken: '#F3EADF', // inputs, tracks, quiet chips
  overlay: 'rgba(32, 22, 16, 0.92)', // full-screen photo viewer
  scrim: 'rgba(43, 33, 28, 0.38)', // behind bottom sheets

  text: '#2B211C', // warm ink (14:1)
  textMuted: '#6E5D51', // 5.7:1 on page, 5.1:1 on peach
  textDisabled: '#A99A8E',
  onOverlay: '#FFFFFF',

  border: '#EADFD2', // hairlines inside cards, decorative only
  borderStrong: '#9C8778', // unticked boxes and input focus: 3.3:1

  success: '#2F6152',
  successSoft: '#E1ECE3',
  warning: '#7A5300',
  warningSoft: '#F8E7BD',
  danger: '#B3261E', // white text 6.5:1
  dangerPressed: '#8E1E18',
  dangerSoft: '#FBE2DC',
};

// The signature: a kanga/kikoi border, read left to right. Decorative only.
export const stripe = [colors.primary, colors.butter, colors.sage, colors.butterInk, colors.text];

// Voice tones: each 3:1 or better on the card colour so bars stay visible.
export const toneColors: Record<string, string> = {
  happy: '#3E8A5F',
  calm: '#3F7F8C',
  neutral: '#8C7B6E',
  stressed: '#B07A12',
  angry: '#C4471F',
};

// Fonts (loaded in App.tsx). Android ignores fontWeight on custom fonts, so the weight is in the name.
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
  body: 'AtkinsonHyperlegibleNext_400Regular',
  bodyMedium: 'AtkinsonHyperlegibleNext_500Medium',
  bodyBold: 'AtkinsonHyperlegibleNext_700Bold',
};

// One type scale. At most four of these on a screen. Big numbers use `number`.
export const type = {
  number: 44, // the one key figure on a screen
  h1: 26, // screen title / greeting
  h2: 20, // card titles
  body: 16,
  small: 14,
  caption: 12, // tab labels and badges only
};

export const text = {
  number: { fontFamily: fonts.display, fontSize: type.number, lineHeight: 48, color: colors.text, letterSpacing: -1 },
  h1: { fontFamily: fonts.display, fontSize: type.h1, lineHeight: 32, color: colors.text, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.displayMedium, fontSize: type.h2, lineHeight: 26, color: colors.text, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: type.body, lineHeight: 23, color: colors.text },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: type.body, lineHeight: 23, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: type.small, lineHeight: 20, color: colors.textMuted },
  smallStrong: { fontFamily: fonts.bodyBold, fontSize: type.small, lineHeight: 20, color: colors.text },
  caption: { fontFamily: fonts.bodyBold, fontSize: type.caption, lineHeight: 16, color: colors.textMuted },
} as const;

export const spacing = { xs: 4, sm: 8, ms: 12, md: 16, lg: 24, xl: 32, xxl: 48 };

// Cards are big and soft; tiles inside them a step smaller; buttons and chips are pills.
export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };

// One warm shadow, only for things that float: hero cards, the tab bar, sheets.
export const shadow = {
  float: Platform.select({
    android: { elevation: 4, shadowColor: '#5A3A22' },
    default: { shadowColor: '#5A3A22', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  }),
};

export const motion = { fast: 120, base: 220, slow: 320 };

// Smallest touch area (dp).
export const TAP = 48;

// Room for the phone's status bar (no safe-area library in this app).
export const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + spacing.sm : 52;

export const iconSize = { inline: 20, tab: 24, large: 28, hero: 40 };

// Older names still used in a few places.
export const weight = { regular: '400', semibold: '600', bold: '700' } as const;
