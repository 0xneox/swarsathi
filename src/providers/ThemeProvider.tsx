import React, { createContext, useContext, useMemo } from 'react';
import { DEFAULT_THEME, createTheme, type Theme } from '../theme';

const ThemeContext = createContext<Theme>(DEFAULT_THEME);

export interface ThemeProviderProps {
  highContrast?: boolean;
  fontScale?: number;
  children: React.ReactNode;
}

/** Provides the active theme (light or high contrast) plus the user's extra font scale. */
export function ThemeProvider({ highContrast, fontScale, children }: ThemeProviderProps) {
  const theme = useMemo(() => createTheme({ highContrast, fontScale }), [highContrast, fontScale]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
