/**
 * Design tokens.
 *
 * SwarSathi ships a light theme by default and a high-contrast variant. Both keep the same
 * structure so a screen never has to know which one is active, and no state is signalled by colour
 * alone - every coloured element also carries text or an accessibility label.
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  onPrimary: string;
  primary: string;
  primaryPressed: string;
  onDanger: string;
  danger: string;
  dangerPressed: string;
  info: string;
  focusRing: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface Theme {
  mode: 'light' | 'high-contrast';
  colors: ThemeColors;
  spacing: ThemeSpacing;
  radius: { sm: number; md: number; lg: number; pill: number };
  /** Base font sizes in points, before the user's font scale is applied. */
  fontSizes: { caption: number; body: number; label: number; title: number; heading: number; display: number };
  /** Minimum touch target required for every interactive element, in density-independent pixels. */
  minTouchTarget: number;
  /** Extra multiplier applied on top of the system font scale. */
  fontScale: number;
}

const spacing: ThemeSpacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
const radius = { sm: 6, md: 10, lg: 16, pill: 999 };
const fontSizes = {
  caption: 14,
  body: 18,
  label: 20,
  title: 24,
  heading: 30,
  display: 40,
};

const LIGHT_COLORS: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F4F7F9',
  surfaceMuted: '#E8EEF2',
  border: '#C3CED6',
  text: '#122029',
  textMuted: '#4B5C68',
  onPrimary: '#FFFFFF',
  primary: '#0B6B4F',
  primaryPressed: '#084F3A',
  onDanger: '#FFFFFF',
  danger: '#A3271C',
  dangerPressed: '#7C1D15',
  info: '#1B4F9C',
  focusRing: '#0B3C8C',
};

/**
 * High contrast keeps a light background but removes every subtle tint: pure black text on pure
 * white is a 21:1 contrast ratio, the maximum available.
 */
const HIGH_CONTRAST_COLORS: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#FFFFFF',
  border: '#000000',
  text: '#000000',
  textMuted: '#000000',
  onPrimary: '#FFFFFF',
  primary: '#000000',
  primaryPressed: '#333333',
  onDanger: '#FFFFFF',
  danger: '#000000',
  dangerPressed: '#333333',
  info: '#000000',
  focusRing: '#000000',
};

export interface ThemeOptions {
  highContrast?: boolean;
  fontScale?: number;
}

export function createTheme(options: ThemeOptions = {}): Theme {
  const highContrast = options.highContrast === true;
  return {
    mode: highContrast ? 'high-contrast' : 'light',
    colors: highContrast ? HIGH_CONTRAST_COLORS : LIGHT_COLORS,
    spacing,
    radius,
    fontSizes,
    minTouchTarget: 48,
    fontScale: options.fontScale && options.fontScale > 0 ? options.fontScale : 1,
  };
}

export const DEFAULT_THEME = createTheme();

/** Scales a token font size by the user's multiplier. */
export function scaledFont(theme: Theme, size: number): number {
  return Math.round(size * theme.fontScale);
}
