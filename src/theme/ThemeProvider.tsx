import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { applyCssVars } from './cssVars';
import { dark, light, type ColorRole } from './palette.generated';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Palette = Record<ColorRole, string>;

export type Theme = {
  mode: ThemeMode;
  isDark: boolean;
  colors: Palette;
};

const ThemeContext = createContext<Theme | null>(null);

type Props = {
  /** User preference; `system` follows the OS color scheme. */
  mode?: ThemeMode;
  children: ReactNode;
};

export function ThemeProvider({ mode = 'system', children }: Props) {
  const systemScheme = useColorScheme();
  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  const value = useMemo<Theme>(
    () => ({ mode, isDark, colors: isDark ? dark : light }),
    [mode, isDark],
  );

  useEffect(() => {
    applyCssVars(value.colors, value.isDark, value.mode);
  }, [value]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider');
  return theme;
}
