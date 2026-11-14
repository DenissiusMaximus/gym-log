import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { reducedMotionDuration } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { shape } from '../theme/tokens';
import { animateTo } from './animate';
import { Icon, type IconName } from './Icon';
import { Portal } from './Portal';
import { Scrim, useBackClose, usePresence } from './overlay';
import { SurfaceColorContext } from './surface';
import { Text } from './Text';

type Props = {
  visible: boolean;
  /** Called on scrim tap and hardware back (when `dismissable`). Must set `visible` to false. */
  onClose: () => void;
  /**
   * `center` is the standard MD3 position. `top` pins the dialog below the top safe area so the
   * system keyboard cannot cover it: use it for forms with a text field.
   */
  anchor?: 'center' | 'top';
  title?: string;
  /** Screen reader name when there is no visible `title`. */
  accessibilityLabel?: string;
  /** Optional icon above the title. */
  icon?: IconName;
  /** Buttons row, right-aligned; build it from text `Button`s. */
  actions?: ReactNode;
  dismissable?: boolean;
  /** Distance from the screen edges (dp), 24 by default. */
  margin?: number;
  /** Inner padding (dp), 24 by default. */
  padding?: number;
  children?: ReactNode;
};

const MAX_WIDTH = 560;
const EXIT_DURATION = 150;

type BodyProps = Props & { onExited: () => void };

function DialogBody({
  visible,
  onClose,
  anchor = 'center',
  title,
  accessibilityLabel,
  icon,
  actions,
  dismissable = true,
  margin = 24,
  padding = 24,
  children,
  onExited,
}: BodyProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const progress = useSharedValue(0);
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useBackClose(visible && dismissable, onClose);

  useEffect(() => {
    if (visible) {
      progress.set(animateTo(1, 'spatialDefault', reduced));
      return;
    }
    progress.set(
      withTiming(0, { duration: reduced ? reducedMotionDuration : EXIT_DURATION }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(onExited);
      }),
    );
  }, [visible, progress, reduced, onExited]);

  const cardStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 1], [0, 1], Extrapolation.CLAMP),
      transform: [{ scale: 0.88 + 0.12 * p }],
    };
  });

  const rootStyle = useMemo(
    () => ({
      justifyContent: anchor === 'top' ? ('flex-start' as const) : ('center' as const),
      paddingTop: anchor === 'top' ? insets.top + 16 : insets.top + margin,
      paddingBottom: insets.bottom + margin,
      paddingLeft: insets.left + margin,
      paddingRight: insets.right + margin,
    }),
    [anchor, insets, margin],
  );
  const cardColor = useMemo(
    () => ({
      backgroundColor: colors.surfaceContainerHigh,
      padding,
      maxHeight: windowHeight - insets.top - insets.bottom - 32,
      transformOrigin: anchor === 'top' ? ('top' as const) : ('center' as const),
    }),
    [colors.surfaceContainerHigh, padding, windowHeight, insets.top, insets.bottom, anchor],
  );

  return (
    <View style={[styles.root, rootStyle]}>
      <Scrim progress={progress} onPress={dismissable ? () => latestClose.current() : undefined} />
      <Animated.View
        style={[styles.card, cardColor, cardStyle]}
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel ?? title}
      >
        <SurfaceColorContext.Provider value={colors.surfaceContainerHigh}>
          {icon ? (
            <View style={styles.icon}>
              <Icon name={icon} color={colors.secondary} />
            </View>
          ) : null}
          {title ? (
            <Text
              variant="headlineSmall"
              accessibilityRole="header"
              style={[styles.title, icon ? styles.titleCentered : null]}
            >
              {title}
            </Text>
          ) : null}
          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </SurfaceColorContext.Provider>
      </Animated.View>
    </View>
  );
}

/** MD3 dialog: radius 28, surface-container-high, 24 dp padding, scrim 0.32. */
export function Dialog(props: Props) {
  const { mounted, onExited } = usePresence(props.visible);
  if (!mounted) return null;
  return (
    <Portal>
      <DialogBody {...props} onExited={onExited} />
    </Portal>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: 'center' },
  card: { width: '100%', maxWidth: MAX_WIDTH, borderRadius: shape.extraLarge },
  icon: { alignItems: 'center', marginBottom: 16 },
  title: { marginBottom: 16 },
  titleCentered: { textAlign: 'center' },
  body: { flexGrow: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24, flexWrap: 'wrap' },
});
