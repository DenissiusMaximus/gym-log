import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { stateLayer } from '../theme/tokens';
import { animateTo } from './animate';
import { Icon } from './Icon';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Row label; without it the control is a bare 48 dp target around the 18 dp box. */
  label?: string;
  disabled?: boolean;
  error?: boolean;
  /** Required when there is no `label`. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const BOX = 18;
const CIRCLE = 40;

/** MD3 checkbox: 18 dp box with radius 2 in a 48 dp target; the check pops in with a spring. */
export function Checkbox({ checked, onChange, label, disabled, error, accessibilityLabel, style }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(checked ? 1 : 0);
  const mark = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.set(animateTo(checked ? 1 : 0, 'effectsDefault', reduced));
    mark.set(animateTo(checked ? 1 : 0, 'spatialFast', reduced));
  }, [checked, progress, mark, reduced]);

  const accent = error ? colors.error : colors.primary;
  const restBorder = error ? colors.error : colors.onSurfaceVariant;
  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.surface, accent]),
    borderColor: interpolateColor(progress.get(), [0, 1], [restBorder, accent]),
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, mark.get())),
    transform: [{ scale: Math.max(0, mark.get()) }],
  }));

  return (
    <PressableSurface
      onPress={() => onChange(!checked)}
      disabled={disabled}
      radius={label ? 24 : CIRCLE / 2}
      layerColor={checked || error ? accent : colors.onSurface}
      touchStyle={[label ? styles.stretch : null, style]}
      style={[label ? styles.row : styles.circle, disabled && styles.disabled]}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked }}
    >
      <Animated.View style={[styles.box, boxStyle]}>
        <Animated.View style={markStyle}>
          <Icon name="check" size={BOX} color={colors.onPrimary} />
        </Animated.View>
      </Animated.View>
      {label ? (
        <Text variant="bodyLarge" style={styles.label}>
          {label}
        </Text>
      ) : null}
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: 'stretch' },
  circle: { width: CIRCLE, height: CIRCLE },
  // 11 dp on the left centers the 18 dp box in a 40 dp circle.
  row: {
    height: 48,
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingLeft: 11,
    paddingRight: 16,
    gap: 11,
  },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
  disabled: { opacity: stateLayer.disabledContent },
});
