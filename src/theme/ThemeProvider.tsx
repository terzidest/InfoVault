// Resolves the user's theme preference (settingsStore) against the OS
// appearance and hands the matching token set to the tree. Everything in
// components/ui reads tokens through `useTheme()`; nothing imports a scheme
// directly, so flipping the theme is a single context update.
import React, { createContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { ColorSchemeName } from 'react-native';
import useSettingsStore from '../store/settingsStore';
import type { ThemeMode } from '../types/models';
import { tokens } from './tokens';
import type { ThemeScheme, Tokens } from './tokens';

export interface ThemeContextValue {
  /** The scheme actually in effect after resolving `mode`. */
  scheme: ThemeScheme;
  tokens: Tokens;
  /** The user's stored preference ('system' | 'light' | 'dark'). */
  mode: ThemeMode;
}

// Pure: `mode` wins when pinned; 'system' follows the OS, falling back to
// light when the OS reports nothing (null/undefined on some platforms).
export const resolveScheme = (mode: ThemeMode, systemScheme: ColorSchemeName | null | undefined): ThemeScheme => {
  if (mode === 'light' || mode === 'dark') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
};

export const ThemeContext = createContext<ThemeContextValue>({
  scheme: 'light',
  tokens: tokens.light,
  mode: 'system',
});

interface Props {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<Props> = ({ children }) => {
  const mode = useSettingsStore((s) => s.settings.theme);
  const systemScheme = useColorScheme();
  const scheme = resolveScheme(mode, systemScheme);

  const value = useMemo<ThemeContextValue>(() => ({ scheme, tokens: tokens[scheme], mode }), [scheme, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
