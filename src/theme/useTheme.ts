// Access the active theme ({ scheme, tokens, mode }). Must be rendered under
// ThemeProvider; outside it the light defaults apply.
import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import type { ThemeContextValue } from './ThemeProvider';

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
