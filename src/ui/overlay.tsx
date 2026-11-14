import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { strings } from '../lib/strings';
import { stateLayer } from '../theme/tokens';
import { useFills } from './themed';

/** Android hardware back closes the topmost overlay (handlers registered last run first). */
export function useBackClose(active: boolean, onClose: () => void) {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      latest.current();
      return true;
    });
    return () => subscription.remove();
  }, [active]);
}

/**
 * Keeps an overlay mounted while it animates out. `mounted` is true from the moment `visible`
 * turns on until the body reports `onExited` after the exit animation.
 */
export function usePresence(visible: boolean) {
  const [exited, setExited] = useState(!visible);
  if (visible && exited) setExited(false);
  const onExited = useCallback(() => setExited(true), []);
  return { mounted: visible || !exited, onExited };
}

type ScrimProps = {
  /** 0 (hidden) to 1 (fully shown); the scrim reaches `stateLayer.scrim` opacity at 1. */
  progress: SharedValue<number>;
  onPress?: () => void;
};

export function Scrim({ progress, onPress }: ScrimProps) {
  const fills = useFills();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, stateLayer.scrim], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, fills.scrim, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.ui.close}
        onPress={onPress}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
