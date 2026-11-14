import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { ColorRole } from '../theme/palette.generated';
import { useTheme } from '../theme/ThemeProvider';
import { shape, stateLayer } from '../theme/tokens';
import { withAlpha } from './color';
import { Icon, type IconName } from './Icon';
import { PressableSurface } from './PressableSurface';
import { createThemedStyles, useFills } from './themed';

export type IconButtonVariant = 'standard' | 'filled' | 'tonal';

type Props = {
  icon: IconName;
  /** Required: an icon alone says nothing to a screen reader. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  /** Visible diameter in dp (the touch target stays at least 48). */
  size?: 40 | 56;
  /** Toggle state; also recolors a standard button to `primary`. */
  selected?: boolean;
  disabled?: boolean;
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
};

const LOOK: Record<IconButtonVariant, [ColorRole | null, ColorRole]> = {
  standard: [null, 'onSurfaceVariant'],
  filled: ['primary', 'onPrimary'],
  tonal: ['secondaryContainer', 'onSecondaryContainer'],
};

const useDisabled = createThemedStyles((c) => ({
  ...StyleSheet.create({ fill: { backgroundColor: withAlpha(c.onSurface, stateLayer.disabledContainer) } }),
  content: withAlpha(c.onSurface, stateLayer.disabledContent),
}));

/** MD3 icon button: 24 dp glyph in a 40 dp circle (touch target 48) that morphs to radius 12 on press. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'standard',
  size = 40,
  selected,
  disabled,
  pressedScale,
  style,
}: Props) {
  const { colors } = useTheme();
  const fills = useFills();
  const off = useDisabled();

  const [container, content] = LOOK[variant];
  const contentRole: ColorRole = variant === 'standard' && selected ? 'primary' : content;
  const fill = container === null ? null : disabled ? off.fill : fills[container];
  const dimensions = size === 40 ? styles.size40 : styles.size56;

  return (
    <PressableSurface
      onPress={onPress}
      disabled={disabled}
      radius={size / 2}
      pressedRadius={size === 40 ? shape.medium : shape.large}
      pressedScale={pressedScale}
      layerColor={colors[contentRole]}
      touchStyle={style}
      style={[dimensions, fill]}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      <Icon name={icon} color={disabled ? off.content : colors[contentRole]} />
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  size40: { width: 40, height: 40 },
  size56: { width: 56, height: 56 },
});
