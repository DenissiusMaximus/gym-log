import { useEffect, useMemo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { stateLayer, typography } from '../theme/tokens';
import { animateTo } from './animate';
import { withAlpha } from './color';
import { Icon, type IconName } from './Icon';
import { PressableSurface } from './PressableSurface';

type Props = {
  label: string;
  onPress?: () => void;
  /** Filter chip state. Leave undefined for an action chip (no check mark, never selected). */
  selected?: boolean;
  /** Optional leading icon of an action chip. */
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT = 32;
const CHECK = 18;
const RADIUS = 8;
const RADIUS_SELECTED = 16;

/**
 * MD3 filter chip: height 32, radius 8, 1 px outline. Selecting animates the check mark in
 * (layout fast, no overshoot), morphs the radius 8 -> 16 (spatial default) and the colors (effects default);
 * pressing scales to 0.96.
 */
export function Chip({ label, onPress, selected, icon, disabled, accessibilityLabel, style }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const isSelected = selected === true;

  const check = useSharedValue(isSelected ? 1 : 0);
  const morph = useSharedValue(isSelected ? 1 : 0);
  const tint = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    const to = isSelected ? 1 : 0;
    check.set(animateTo(to, 'layoutFast', reduced));
    morph.set(animateTo(to, 'spatialDefault', reduced));
    tint.set(animateTo(to, 'effectsDefault', reduced));
  }, [isSelected, check, morph, tint, reduced]);

  const radius = useDerivedValue(() => RADIUS + (RADIUS_SELECTED - RADIUS) * morph.get());

  const clear = useMemo(() => withAlpha(colors.secondaryContainer, 0), [colors.secondaryContainer]);
  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tint.get(), [0, 1], [clear, colors.secondaryContainer]),
    borderColor: interpolateColor(tint.get(), [0, 1], [colors.outlineVariant, colors.secondaryContainer]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(tint.get(), [0, 1], [colors.onSurfaceVariant, colors.onSecondaryContainer]),
  }));
  // Clamped: a negative width makes Yoga on Android measure the node by its content.
  const checkStyle = useAnimatedStyle(() => {
    const c = Math.max(0, check.get());
    return { width: CHECK * c, marginRight: 8 * c, opacity: Math.min(1, c) };
  });

  return (
    <PressableSurface
      onPress={onPress}
      disabled={disabled}
      radiusValue={radius}
      pressedScale={0.96}
      layerColor={isSelected ? colors.onSecondaryContainer : colors.onSurfaceVariant}
      touchStyle={style}
      minTouchWidth={HEIGHT}
      animatedStyle={containerStyle}
      style={[styles.visible, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected === undefined ? undefined : { selected: isSelected }}
    >
      {selected !== undefined && (
        <Animated.View style={[styles.check, checkStyle]}>
          <Icon name="check" size={CHECK} color={colors.onSecondaryContainer} />
        </Animated.View>
      )}
      {icon && <Icon name={icon} size={CHECK} color={colors.primary} />}
      <Animated.Text
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        style={[styles.label, icon ? styles.labelAfterIcon : null, labelStyle]}
      >
        {label}
      </Animated.Text>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  visible: { height: HEIGHT, flexDirection: 'row', paddingHorizontal: 16, borderWidth: 1 },
  disabled: { opacity: stateLayer.disabledContent },
  // Clips the check mark while its width grows from 0 to 18.
  check: { height: CHECK, overflow: 'hidden', alignItems: 'flex-start' },
  label: typography.labelLarge,
  labelAfterIcon: { marginLeft: 8 },
});
