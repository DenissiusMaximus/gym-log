import { StyleSheet, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import type { ColorRole } from '../theme/palette.generated';
import { typography, type TypeVariant } from '../theme/tokens';
import { useTextColors } from './themed';

export type TextProps = RNTextProps & {
  /** MD3 type scale entry. */
  variant?: TypeVariant;
  /** Color role of the theme. */
  color?: ColorRole;
  /** Tabular figures, for numbers that change or align in columns. */
  numeric?: boolean;
};

const typeStyles = StyleSheet.create(typography as Record<TypeVariant, TextStyle>);
const styles = StyleSheet.create({
  numeric: { fontVariant: ['tabular-nums'] },
});

export function Text({
  variant = 'bodyMedium',
  color = 'onSurface',
  numeric,
  style,
  maxFontSizeMultiplier = 1.5,
  ...rest
}: TextProps) {
  const colors = useTextColors();
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[typeStyles[variant], colors[color], numeric && styles.numeric, style]}
      {...rest}
    />
  );
}
