import { createContext, useContext } from 'react';

import { useTheme } from '../theme/ThemeProvider';

/** Background color of the surface a component sits on (the outlined text field cuts its label out of it). */
export const SurfaceColorContext = createContext<string | null>(null);

export function useSurfaceColor(): string {
  const inherited = useContext(SurfaceColorContext);
  const { colors } = useTheme();
  return inherited ?? colors.surface;
}
