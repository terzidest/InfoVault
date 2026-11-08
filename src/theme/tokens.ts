// Design tokens for the v2 UI. Values come from the approved design canvas
// and are the single source of truth for color, spacing, radius, type and
// motion. Components read them through `useTheme()`; never hardcode them.
//
// Both schemes expose the exact same key set (asserted by a test) so a
// component written against one scheme can never break in the other.
import { Easing } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';

export type ThemeScheme = 'light' | 'dark';

export type Rgb = readonly [number, number, number];

export interface Shadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: NonNullable<TextStyle['fontWeight']>;
  fontFamily?: string;
  letterSpacing?: number;
}

export type TemplateKind = 'login' | 'idNumber' | 'idDocument' | 'sim' | 'card' | 'wifi' | 'note' | 'custom';

export interface Gradient {
  colors: readonly [string, string, ...string[]];
  locations?: readonly [number, number, ...number[]];
}

export interface Tokens {
  scheme: ThemeScheme;
  colors: {
    background: string;
    backgroundGlow: string;
    backgroundGlowHero: string;
    text: string;
    text2: string;
    muted: string;
    quiet: string;
    faint: string;
    surface: string;
    line: string;
    line2: string;
    wash: string;
    wash2: string;
    segmentHighlight: string;
    // Opaque base for sheets/modals over a scrim, where translucent `surface`
    // would have nothing to layer on.
    sheet: string;
    icon: string;
    accent: string;
    accentRgb: Rgb;
    teal: string;
    tealDeep: string;
    amber: string;
    amberText: string;
    amberRgb: Rgb;
    ok: string;
    okRgb: Rgb;
    bad: string;
    badRgb: Rgb;
    tints: Record<TemplateKind, string>;
    onAmber: string;
    onTeal: string;
  };
  shadows: {
    elevation: Shadow;
    glowTeal: Shadow;
    glowAmber: Shadow;
  };
  gradients: {
    buttonTeal: Gradient;
    buttonAmber: Gradient;
    ground: Gradient;
  };
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
  motion: typeof motion;
}

// ---------------------------------------------------------------------------
// Scheme-independent tokens
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  pill: 999,
} as const;

// Font-family names as registered by the @expo-google-fonts packages. They
// are only valid once `fonts` below has loaded (see App.tsx / useFonts).
export const fontFamily = {
  sans400: 'Inter_400Regular',
  sans500: 'Inter_500Medium',
  sans600: 'Inter_600SemiBold',
  sans700: 'Inter_700Bold',
  mono400: 'JetBrainsMono_400Regular',
  mono500: 'JetBrainsMono_500Medium',
} as const;

// Map for `useFonts` — bundled TTFs, loaded at startup with no network.
export const fonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} as const;

// Uppercase variants (eyebrow, kind) expect the caller to apply textTransform.
export const type = {
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', fontFamily: fontFamily.sans700 },
  recordTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', fontFamily: fontFamily.sans700 },
  barTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', fontFamily: fontFamily.sans600 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', fontFamily: fontFamily.sans600 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400', fontFamily: fontFamily.sans400 },
  secondary: { fontSize: 12.5, lineHeight: 18, fontWeight: '400', fontFamily: fontFamily.sans400 },
  label: { fontSize: 11.5, lineHeight: 16, fontWeight: '500', fontFamily: fontFamily.sans500 },
  monoNumber: { fontSize: 22, lineHeight: 28, fontWeight: '400', fontFamily: fontFamily.mono400, letterSpacing: 1.3 },
  monoSecret: { fontSize: 18, lineHeight: 24, fontWeight: '400', fontFamily: fontFamily.mono400, letterSpacing: 2.5 },
  monoValue: { fontSize: 13, lineHeight: 18, fontWeight: '400', fontFamily: fontFamily.mono400, letterSpacing: 0.5 },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '400', fontFamily: fontFamily.sans400, letterSpacing: 2 },
  kind: { fontSize: 9.5, lineHeight: 12, fontWeight: '400', fontFamily: fontFamily.mono400, letterSpacing: 1 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;

// Durations in ms.
export const motion = {
  press: 120,
  quick: 200,
  standard: 300,
  enter: 400,
  stagger: 60,
} as const;

// The one easing curve used for all UI motion: cubic-bezier(.2,.7,.2,1).
export const easing = Easing.bezier(0.2, 0.7, 0.2, 1);

const noShadow: Shadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

const glowTeal: Shadow = {
  shadowColor: '#0E8BB3',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.45,
  shadowRadius: 28,
  elevation: 6,
};

const glowAmber: Shadow = {
  shadowColor: '#FFC107',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.25,
  shadowRadius: 28,
  elevation: 6,
};

const buttonTeal: Gradient = { colors: ['#1FA6D1', '#006E90'] };
const buttonAmber: Gradient = { colors: ['#FFD54F', '#FFB300'] };

const groundGradient = (glow: string, background: string): Gradient => ({
  colors: [glow, background, background],
  locations: [0, 0.55, 1],
});

// ---------------------------------------------------------------------------
// Schemes
// ---------------------------------------------------------------------------

const DARK_BACKGROUND = '#0A1420';
const DARK_GLOW = '#0F3A4F';
const LIGHT_BACKGROUND = '#DCE7EE';
const LIGHT_GLOW = '#B9DCEA';

const dark: Tokens = {
  scheme: 'dark',
  colors: {
    background: DARK_BACKGROUND,
    backgroundGlow: DARK_GLOW,
    backgroundGlowHero: '#0F3A4F',
    text: '#F2F6F9',
    text2: '#D6DEE6',
    muted: '#8FA1B3',
    quiet: '#6F8294',
    faint: '#51657A',
    surface: 'rgba(255,255,255,0.05)',
    line: 'rgba(255,255,255,0.10)',
    line2: 'rgba(255,255,255,0.08)',
    wash: 'rgba(255,255,255,0.04)',
    wash2: 'rgba(255,255,255,0.06)',
    segmentHighlight: 'rgba(255,255,255,0.10)',
    sheet: '#122232',
    icon: '#B9C7D4',
    accent: '#39C6E8',
    accentRgb: [57, 198, 232],
    teal: '#1FA6D1',
    tealDeep: '#006E90',
    amber: '#FFC107',
    amberText: '#FFC107',
    amberRgb: [255, 193, 7],
    ok: '#5BC86A',
    okRgb: [91, 200, 106],
    bad: '#F26B61',
    badRgb: [242, 107, 97],
    tints: {
      login: '#1FA6D1',
      idNumber: '#FFC107',
      idDocument: '#A78BFA',
      sim: '#5BC86A',
      card: '#F472B6',
      wifi: '#39C6E8',
      note: '#9FB3C8',
      custom: '#FB923C',
    },
    onAmber: '#1A1400',
    onTeal: '#FFFFFF',
  },
  shadows: { elevation: noShadow, glowTeal, glowAmber },
  gradients: { buttonTeal, buttonAmber, ground: groundGradient(DARK_GLOW, DARK_BACKGROUND) },
  spacing,
  radius,
  type,
  motion,
};

const light: Tokens = {
  scheme: 'light',
  colors: {
    background: LIGHT_BACKGROUND,
    backgroundGlow: LIGHT_GLOW,
    backgroundGlowHero: '#A6D2E4',
    text: '#0F2233',
    text2: '#223548',
    muted: '#4F667A',
    quiet: '#6C8396',
    faint: '#8EA3B3',
    surface: 'rgba(255,255,255,0.72)',
    line: 'rgba(0,110,144,0.16)',
    line2: 'rgba(0,110,144,0.14)',
    wash: 'rgba(0,110,144,0.06)',
    wash2: 'rgba(0,110,144,0.09)',
    segmentHighlight: '#FFFFFF',
    sheet: '#F3F7FA',
    icon: '#2E4659',
    accent: '#007A9E',
    accentRgb: [0, 122, 158],
    teal: '#0E8BB3',
    tealDeep: '#006E90',
    amber: '#FFB300',
    // Darker than the design's #9A6A00 (3.77:1 on the light ground); this
    // passes AA at ~5.1:1 while staying the same hue. Design to follow.
    amberText: '#7F5700',
    amberRgb: [201, 138, 0],
    ok: '#2E9E4F',
    okRgb: [46, 158, 79],
    bad: '#D7382E',
    badRgb: [215, 56, 46],
    tints: {
      login: '#0E8BB3',
      idNumber: '#B07800',
      idDocument: '#6D4FD6',
      sim: '#2E9E4F',
      card: '#C92E84',
      wifi: '#007A9E',
      note: '#4F667A',
      custom: '#B9410C',
    },
    onAmber: '#1A1400',
    onTeal: '#FFFFFF',
  },
  shadows: {
    elevation: {
      shadowColor: '#0F2233',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 2,
    },
    glowTeal,
    glowAmber,
  },
  gradients: { buttonTeal, buttonAmber, ground: groundGradient(LIGHT_GLOW, LIGHT_BACKGROUND) },
  spacing,
  radius,
  type,
  motion,
};

export const tokens: Record<ThemeScheme, Tokens> = { light, dark };

// `rgba()` string from an rgb triple token and an alpha — the common way
// components derive fills/borders/halos from accentRgb/okRgb/badRgb.
export const rgba = (rgb: Rgb, alpha: number): string => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;

// Helper so a Shadow token spreads cleanly into a ViewStyle.
export const shadowStyle = (shadow: Shadow): ViewStyle => ({ ...shadow });
