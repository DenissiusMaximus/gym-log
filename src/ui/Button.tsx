import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { ColorRole } from '../theme/palette.generated';
import { useTheme } from '../theme/ThemeProvider';
import { shape, stateLayer } from '../theme/tokens';
import { withAlpha } from './color';
import { Icon, type IconName } from './Icon';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';
import { createThemedStyles, useFills } from './themed';

export type ButtonVariant = 'filled' | 'tonal' | 'text';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** `error` recolors the button for destructive actions. */
  tone?: 'default' | 'error';
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Layout of the touch wrapper (alignSelf, flex, margins). */
  style?: StyleProp<ViewStyle>;
};

const HEIGHT = 40;

// [container, content] roles per variant and tone.
const LOOK: Record<ButtonVariant, Record<'default' | 'error', [ColorRole | null, ColorRole]>> = {
  filled: { default: ['primary', 'onPrimary'], error: ['error', 'onError'] },
  tonal: {
    default: ['secondaryContainer', 'onSecondaryContainer'],
    error: ['errorContainer', 'onErrorContainer'],
  },
  text: { default: [null, 'primary'], error: [null, 'error'] },
};

const useDisabled = createThemedStyles((c) => ({
  ...StyleSheet.create({
    fill: { backgroundColor: withAlpha(c.onSurface, stateLayer.disabledContainer) },
    text: { color: withAlpha(c.onSurface, stateLayer.disabledContent) },
  }),
  content: withAlpha(c.onSurface, stateLayer.disabledContent),
}));

/** MD3 button: height 40, label-large, corner radius full that morphs to 12 while pressed. */
export function Button({
  title,
  onPress,
  variant = 'filled',
  tone = 'default',
  icon,
  disabled,
  accessibilityLabel,
  style,
}: Props) {
  const { colors } = useTheme();
  const fills = useFills();
  const off = useDisabled();

  const [container, content] = LOOK[variant][tone];
  const contentColor = disabled ? off.content : colors[content];
  const fill = container === null ? null : disabled ? off.fill : fills[container];
  const padding = variant === 'text' ? styles.padText : icon ? styles.padIcon : styles.pad;

  return (
    <PressableSurface
      onPress={onPress}
      disabled={disabled}
      radius={HEIGHT / 2}
      pressedRadius={shape.medium}
      layerColor={colors[content]}
      touchStyle={style}
      style={[styles.visible, padding, fill]}
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {icon && <Icon name={icon} size={18} color={contentColor} />}
      <Text variant="labelLarge" color={content} numberOfLines={1} style={disabled ? off.text : undefined}>
        {title}
      </Text>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  visible: { height: HEIGHT, flexDirection: 'row', gap: 8 },
  pad: { paddingHorizontal: 24 },
  padIcon: { paddingLeft: 16, paddingRight: 24 },
  padText: { paddingHorizontal: 12 },
});
