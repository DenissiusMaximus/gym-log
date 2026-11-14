import { useMemo, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { stateLayer, touchTarget } from '../theme/tokens';
import { animateTo } from './animate';

// MD3 state layer opacities (the shared tokens carry a slightly different `pressed` value).
const PRESSED_LAYER = 0.12;

// Hover only exists with a fine pointer; touch browsers emulate it and would leave the layer stuck.
const canHover =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover)').matches;

type Props = {
  onPress?: () => void;
  disabled?: boolean;
  /** Resting corner radius; animated towards `pressedRadius` while pressed. Omit to leave radii to `style`. */
  radius?: number;
  /** Resting radius driven by a shared value (selection morph); overrides `radius`. */
  radiusValue?: SharedValue<number>;
  pressedRadius?: number;
  pressedScale?: number;
  /** State layer color: the content color of the element. */
  layerColor: string;
  /** Visible element: size, fill, border. */
  style?: StyleProp<ViewStyle>;
  /** Extra animated style for the visible element (colors that follow selection). */
  animatedStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  /** Layout of the 48 dp touch wrapper (alignment, flex). */
  touchStyle?: StyleProp<ViewStyle>;
  /** Minimum touch size; the visible element is centered in it. */
  minTouchWidth?: number;
  minTouchHeight?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  children?: ReactNode;
};

/**
 * Base of every pressable element of the kit: a touch wrapper (>= 48 dp) around a visible element
 * that morphs its corner radius, scales and shows a state layer. Springs follow the Expressive
 * presets (shape: spatial fast, layer: effects fast).
 */
export function PressableSurface({
  onPress,
  disabled,
  radius,
  radiusValue,
  pressedRadius,
  pressedScale = 1,
  layerColor,
  style,
  animatedStyle,
  touchStyle,
  minTouchWidth = touchTarget,
  minTouchHeight = touchTarget,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  children,
}: Props) {
  const reduced = useReducedMotion();
  const shape = useSharedValue(0);
  const layer = useSharedValue(0);
  const hover = useSharedValue(0);

  const visibleStyle = useAnimatedStyle(() => {
    const p = shape.get();
    const transform = [{ scale: 1 + (pressedScale - 1) * p }];
    const rest = radiusValue ? radiusValue.get() : radius;
    if (rest === undefined) return { transform };
    return { transform, borderRadius: Math.max(0, rest + ((pressedRadius ?? rest) - rest) * p) };
  });

  const layerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(layer.get() * PRESSED_LAYER, hover.get() * stateLayer.hover)),
  }));

  const layerFill = useMemo(() => ({ backgroundColor: layerColor }), [layerColor]);
  const wrapperStyle = useMemo(
    () => ({ minWidth: minTouchWidth, minHeight: minTouchHeight }),
    [minTouchWidth, minTouchHeight],
  );
  const state = useMemo(
    () => (disabled ? { ...accessibilityState, disabled: true } : accessibilityState),
    [accessibilityState, disabled],
  );

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={state}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        shape.set(animateTo(1, 'spatialFast', reduced));
        layer.set(animateTo(1, 'effectsFast', reduced));
      }}
      onPressOut={() => {
        shape.set(animateTo(0, 'spatialFast', reduced));
        layer.set(animateTo(0, 'effectsFast', reduced));
      }}
      onHoverIn={canHover ? () => hover.set(withTiming(1, { duration: 100 })) : undefined}
      onHoverOut={canHover ? () => hover.set(withTiming(0, { duration: 100 })) : undefined}
      style={[styles.touch, wrapperStyle, !disabled && styles.pointer, touchStyle]}
    >
      <Animated.View style={[styles.visible, style, visibleStyle, animatedStyle]}>
        <Animated.View style={[styles.layer, layerFill, layerStyle]} />
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { alignItems: 'center', justifyContent: 'center' },
  pointer: Platform.select<ViewStyle>({ web: { cursor: 'pointer' }, default: {} }),
  layer: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  visible: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
