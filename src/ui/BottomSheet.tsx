import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { exitTiming } from '../theme/motion';
import type { ColorRole } from '../theme/palette.generated';
import { useTheme } from '../theme/ThemeProvider';
import { shape } from '../theme/tokens';
import { animateTo } from './animate';
import { shadow } from './elevation';
import { Portal } from './Portal';
import { Scrim, useBackClose, usePresence } from './overlay';
import { SurfaceColorContext } from './surface';

type Props = {
  visible: boolean;
  /** Called on scrim tap (modal), hardware back and drag-to-dismiss. Must set `visible` to false. */
  onClose: () => void;
  /** Modal: scrim 0.32 and closes on scrim tap. Non-modal: no scrim, content above stays interactive. */
  modal?: boolean;
  /** Reports the panel height (without the 48 dp tail); 0 while it is closing or closed. */
  onHeightChange?: (height: number) => void;
  /** Surface color role; `surfaceContainerLow` by default. */
  containerColor?: ColorRole;
  accessibilityLabel?: string;
  children: ReactNode;
};

const HANDLE_ZONE = 20;
const TAIL = 48;
const DISMISS_FRACTION = 0.25;
const DISMISS_VELOCITY = 800;
const OVERDRAG_RESISTANCE = 0.2;
const MAX_WIDTH = 640;

const exitEasing = Easing.bezier(...exitTiming.bezier);

type BodyProps = Props & { onExited: () => void };

function SheetBody({
  visible,
  onClose,
  modal = true,
  onHeightChange,
  containerColor = 'surfaceContainerLow',
  accessibilityLabel,
  children,
  onExited,
}: BodyProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  // translateY of the panel: 0 is fully open, `height` is fully hidden. Starts off-screen.
  const offset = useSharedValue(windowHeight);
  const height = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const measured = useRef(false);

  const latestHeightChange = useRef(onHeightChange);
  useEffect(() => {
    latestHeightChange.current = onHeightChange;
  });

  useBackClose(visible, onClose);
  useEffect(() => () => latestHeightChange.current?.(0), []);

  const handleLayout = (event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    height.set(h);
    if (visible) latestHeightChange.current?.(h);
    if (!measured.current) {
      measured.current = true;
      // The first measurement places the panel just below the screen, then it springs in.
      offset.set(h);
      if (visible) offset.set(animateTo(0, 'spatialDefault', reduced));
    }
  };

  useEffect(() => {
    if (visible) {
      if (measured.current) offset.set(animateTo(0, 'spatialDefault', reduced));
      return;
    }
    latestHeightChange.current?.(0);
    const hidden = height.get();
    if (!measured.current || offset.get() >= hidden) {
      onExited();
      return;
    }
    offset.set(
      withTiming(hidden, { duration: exitTiming.duration, easing: exitEasing }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(onExited);
      }),
    );
  }, [visible, offset, height, reduced, onExited]);

  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    onActivate: () => {
      'worklet';
      dragStart.set(offset.get());
    },
    onUpdate: (event) => {
      'worklet';
      const next = dragStart.get() + event.translationY;
      offset.set(next < 0 ? next * OVERDRAG_RESISTANCE : next);
    },
    onDeactivate: (event) => {
      'worklet';
      const dismiss =
        !event.canceled &&
        (offset.get() > height.get() * DISMISS_FRACTION || event.velocityY > DISMISS_VELOCITY);
      if (dismiss) {
        // The `visible` effect continues from the current offset with the exit timing.
        scheduleOnRN(onClose);
      } else {
        offset.set(animateTo(0, 'spatialFast', reduced));
      }
    },
  });

  const progress = useDerivedValue(() => {
    const h = height.get();
    return h > 0 ? 1 - Math.min(1, Math.max(0, offset.get() / h)) : 0;
  });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  const surfaceStyle = useMemo(
    () => ({
      backgroundColor: colors[containerColor],
      paddingBottom: insets.bottom,
      ...(modal
        ? null
        : { ...shadow('level2', colors.shadow, true), borderTopWidth: 1, borderTopColor: colors.outlineVariant }),
    }),
    [colors, containerColor, insets.bottom, modal],
  );
  const tailStyle = useMemo(() => ({ backgroundColor: colors[containerColor] }), [colors, containerColor]);
  const handleStyle = useMemo(() => ({ backgroundColor: colors.onSurfaceVariant }), [colors.onSurfaceVariant]);

  return (
    <View style={[styles.root, modal ? null : styles.passThrough]}>
      {modal && <Scrim progress={progress} onPress={onClose} />}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <SurfaceColorContext.Provider value={colors[containerColor]}>
          <View
            onLayout={handleLayout}
            style={[styles.surface, surfaceStyle]}
            accessibilityLabel={accessibilityLabel}
            accessibilityViewIsModal={modal}
          >
            <GestureDetector gesture={pan}>
              <View style={styles.handleZone}>
                <View style={[styles.handle, handleStyle]} />
              </View>
            </GestureDetector>
            {children}
          </View>
        </SurfaceColorContext.Provider>
        <View style={[styles.tail, tailStyle]} />
      </Animated.View>
    </View>
  );
}

/**
 * MD3 bottom sheet sized by its content. The handle (32x4 in a 20 dp zone) drags the panel down;
 * dismissal needs a 25% drag or a 800 px/s fling, otherwise the panel springs back.
 */
export function BottomSheet(props: Props) {
  const { mounted, onExited } = usePresence(props.visible);
  if (!mounted) return null;
  return (
    <Portal>
      <SheetBody {...props} onExited={onExited} />
    </Portal>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', alignItems: 'center' },
  passThrough: { pointerEvents: 'box-none' },
  sheet: { width: '100%', maxWidth: MAX_WIDTH },
  surface: { borderTopLeftRadius: shape.extraLarge, borderTopRightRadius: shape.extraLarge },
  handleZone: { height: HANDLE_ZONE, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 32, height: 4, borderRadius: 2, opacity: 0.4 },
  // Sits below the panel so the spring overshoot never reveals what is behind it.
  tail: { position: 'absolute', top: '100%', left: 0, right: 0, height: TAIL },
});
