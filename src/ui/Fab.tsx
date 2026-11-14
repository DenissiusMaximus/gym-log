import { useEffect, useMemo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { shape } from '../theme/tokens';
import { animateTo } from './animate';
import { shadow } from './elevation';
import { Icon, type IconName } from './Icon';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  /** Adds a label and turns the button into an extended FAB (icon FABs are 56x56). */
  label?: string;
  /** Open state of a FAB menu: the icon turns 45 degrees and the button becomes a primary circle. */
  active?: boolean;
  /** Hides the button with a scale animation (for example while a panel is open). */
  visible?: boolean;
  /** Positioning of the button (absolute offsets, margins). */
  style?: StyleProp<ViewStyle>;
};

const SIZE = 56;

/** MD3 FAB: 56 dp, radius 16, primary-container, level 3 shadow. */
export function Fab({ icon, accessibilityLabel, onPress, label, active = false, visible = true, style }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();

  const color = useSharedValue(active ? 1 : 0);
  const turn = useSharedValue(active ? 1 : 0);
  const presence = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    color.set(animateTo(active ? 1 : 0, 'effectsDefault', reduced));
    turn.set(animateTo(active ? 1 : 0, 'spatialDefault', reduced));
  }, [active, color, turn, reduced]);

  useEffect(() => {
    presence.set(animateTo(visible ? 1 : 0, 'spatialDefault', reduced));
  }, [visible, presence, reduced]);

  const radius = useDerivedValue(() =>
    label ? shape.large : shape.large + (SIZE / 2 - shape.large) * turn.get(),
  );

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(color.get(), [0, 1], [colors.primaryContainer, colors.primary]),
  }));
  const restIcon = useAnimatedStyle(() => ({ opacity: 1 - color.get() }));
  const activeIcon = useAnimatedStyle(() => ({ opacity: color.get() }));
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${45 * turn.get()}deg` }] }));
  const presenceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(presence.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: Math.max(0, presence.get()) }],
  }));

  const shadowStyle = useMemo(() => shadow('level3', colors.shadow), [colors.shadow]);

  return (
    <Animated.View
      style={[presenceStyle, style, !visible && styles.hidden]}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!visible}
    >
      <PressableSurface
        onPress={visible ? onPress : undefined}
        radiusValue={radius}
        pressedRadius={22}
        pressedScale={0.95}
        layerColor={active ? colors.onPrimary : colors.onPrimaryContainer}
        animatedStyle={containerStyle}
        style={[label ? styles.extended : styles.round, shadowStyle]}
        minTouchHeight={SIZE}
        minTouchWidth={SIZE}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={active ? { expanded: true } : undefined}
      >
        <Animated.View style={[styles.glyph, spin]}>
          <Animated.View style={restIcon}>
            <Icon name={icon} color={colors.onPrimaryContainer} />
          </Animated.View>
          <Animated.View style={[styles.glyphOverlay, activeIcon]}>
            <Icon name={icon} color={colors.onPrimary} />
          </Animated.View>
        </Animated.View>
        {label ? (
          <Text variant="labelLarge" color="onPrimaryContainer" numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </PressableSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hidden: { pointerEvents: 'none' },
  round: { width: SIZE, height: SIZE },
  extended: { height: SIZE, flexDirection: 'row', gap: 8, paddingLeft: 16, paddingRight: 20 },
  glyph: { width: 24, height: 24 },
  glyphOverlay: { ...StyleSheet.absoluteFill },
});
