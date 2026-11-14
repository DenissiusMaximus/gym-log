import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useUi, type SnackbarMessage, type SnackbarOptions } from '../data/useUi';
import { reducedMotionDuration } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { shape } from '../theme/tokens';
import { animateTo } from './animate';
import { shadow } from './elevation';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';
import { useFills } from './themed';

/**
 * Shows a snackbar. One at a time: a new one replaces the current one. `duration` defaults to
 * 5000 ms; `bottomOffset` lifts it above a FAB or the entry panel. State lives in `useUi`.
 */
export function showSnackbar(options: SnackbarOptions) {
  useUi.getState().showSnackbar(options);
}

export function hideSnackbar() {
  useUi.getState().dismissSnackbar();
}

const EXIT_DURATION = 150;
const MARGIN = 16;

/** Renders the current snackbar; mount once in the root layout, after the `PortalHost`. */
export function SnackbarHost() {
  const message = useUi((s) => s.snackbar);
  const [shown, setShown] = useState<SnackbarMessage | null>(message);
  if (message && message !== shown) setShown(message);

  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const clear = useCallback(() => setShown(null), []);
  const messageId = message?.id;

  useEffect(() => {
    if (messageId !== undefined) {
      progress.set(0);
      progress.set(animateTo(1, 'spatialFast', reduced));
      return;
    }
    progress.set(
      withTiming(0, { duration: reduced ? reducedMotionDuration : EXIT_DURATION }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(clear);
      }),
    );
  }, [messageId, progress, reduced, clear]);

  if (!shown) return null;
  return <SnackbarView message={shown} progress={progress} />;
}

type ViewProps = {
  message: SnackbarMessage;
  progress: SharedValue<number>;
};

function SnackbarView({ message, progress }: ViewProps) {
  const { colors } = useTheme();
  const fills = useFills();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: 16 * (1 - progress.get()) }],
  }));
  const rootStyle = useMemo(
    () => ({
      paddingBottom: insets.bottom + MARGIN + (message.bottomOffset ?? 0),
      paddingLeft: insets.left + MARGIN,
      paddingRight: insets.right + MARGIN,
    }),
    [insets.bottom, insets.left, insets.right, message.bottomOffset],
  );
  const shadowStyle = useMemo(() => shadow('level3', colors.shadow), [colors.shadow]);

  const act = () => {
    message.onAction?.();
    useUi.getState().dismissSnackbar();
  };

  return (
    <View style={[styles.root, rootStyle]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[styles.snackbar, fills.inverseSurface, shadowStyle, animatedStyle]}
      >
        <Text
          variant="bodyMedium"
          color="inverseOnSurface"
          style={[styles.text, message.actionLabel ? null : styles.textAlone]}
        >
          {message.text}
        </Text>
        {message.actionLabel ? (
          <PressableSurface
            onPress={act}
            radius={20}
            pressedRadius={shape.medium}
            layerColor={colors.inversePrimary}
            touchStyle={styles.actionTouch}
            style={styles.action}
            accessibilityLabel={message.actionLabel}
          >
            <Text variant="labelLarge" color="inversePrimary" numberOfLines={1}>
              {message.actionLabel}
            </Text>
          </PressableSurface>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'box-none' },
  snackbar: {
    width: '100%',
    maxWidth: 560,
    minHeight: 48,
    borderRadius: shape.extraSmall,
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: { flex: 1, paddingVertical: 14, paddingLeft: 16, paddingRight: 8 },
  textAlone: { paddingRight: 16 },
  actionTouch: { marginRight: 4 },
  action: { height: 40, paddingHorizontal: 12 },
});
