import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme, type Palette } from '../theme/ThemeProvider';
import type { ColorRole } from '../theme/palette.generated';

/**
 * Builds a style factory once per palette object and caches the result, so colored styles are
 * created on theme change only and never inline on every render.
 */
export function createThemedStyles<T>(factory: (colors: Palette) => T): () => T {
  const cache = new WeakMap<Palette, T>();
  return function useThemedStyles() {
    const { colors } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = factory(colors);
      cache.set(colors, styles);
    }
    return styles;
  };
}

const roleMap = <S>(colors: Palette, make: (value: string) => S): Record<ColorRole, S> =>
  StyleSheet.create(
    Object.fromEntries(Object.entries(colors).map(([role, value]) => [role, make(value)])) as never,
  ) as unknown as Record<ColorRole, S>;

/** `{ color }` style for every color role. */
export const useTextColors = createThemedStyles((c) => roleMap<TextStyle>(c, (color) => ({ color })));

/** `{ backgroundColor }` style for every color role. */
export const useFills = createThemedStyles((c) =>
  roleMap<ViewStyle>(c, (backgroundColor) => ({ backgroundColor })),
);
