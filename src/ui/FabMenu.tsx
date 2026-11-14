import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { strings } from '../lib/strings';
import { useTheme } from '../theme/ThemeProvider';
import { shape } from '../theme/tokens';
import { animateTo } from './animate';
import { shadow } from './elevation';
import { Fab } from './Fab';
import { Icon, type IconName } from './Icon';
import { useBackClose } from './overlay';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';
import { useFills } from './themed';

export type FabMenuItem = { key: string; label: string; icon: IconName; onPress: () => void };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Listed top to bottom; the item nearest to the FAB appears first. */
  items: readonly FabMenuItem[];
  accessibilityLabel: string;
  /** Icon of the FAB, `add` by default. */
  icon?: IconName;
  /** Hides the whole control (for example while the entry panel is open). */
  visible?: boolean;
  /** Extra distance above the bottom safe area (dp). */
  bottomOffset?: number;
};

const MARGIN = 16;
const FAB_SIZE = 56;
const ITEM_HEIGHT = 56;
const STAGGER_MS = 40;

type ItemProps = {
  item: FabMenuItem;
  open: boolean;
  /** Distance from the FAB: 0 is the nearest item. */
  order: number;
  onHidden: () => void;
  onSelect: (item: FabMenuItem) => void;
};

function MenuItem({ item, open, order, onHidden, onSelect }: ItemProps) {
  const { colors } = useTheme();
  const fills = useFills();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (open) {
      progress.set(withDelay(order * STAGGER_MS, animateTo(1, 'spatialFast', reduced)));
      return;
    }
    progress.set(
      animateTo(0, 'spatialFast', reduced, (finished) => {
        'worklet';
        if (finished && order === 0) scheduleOnRN(onHidden);
      }),
    );
  }, [open, order, progress, reduced, onHidden]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 1], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: 16 * (1 - p) }, { scale: 0.6 + 0.4 * p }],
    };
  });
  const shadowStyle = useMemo(() => shadow('level3', colors.shadow), [colors.shadow]);

  return (
    <Animated.View style={[styles.itemWrap, style]}>
      <PressableSurface
        onPress={() => onSelect(item)}
        radius={ITEM_HEIGHT / 2}
        pressedRadius={shape.large}
        layerColor={colors.onPrimaryContainer}
        minTouchHeight={ITEM_HEIGHT}
        style={[styles.item, fills.primaryContainer, shadowStyle]}
        accessibilityLabel={item.label}
      >
        <Icon name={item.icon} color={colors.onPrimaryContainer} />
        <Text variant="labelLarge" color="onPrimaryContainer" numberOfLines={1}>
          {item.label}
        </Text>
      </PressableSurface>
    </Animated.View>
  );
}

/**
 * Expressive FAB menu: the FAB turns into a primary circle with a 45 degree plus and pill actions
 * rise above it. Fills the screen it is placed in (absolute, touch-transparent while closed); an
 * invisible catcher behind the pills closes the menu.
 */
export function FabMenu({
  open,
  onOpenChange,
  items,
  accessibilityLabel,
  icon = 'add',
  visible = true,
  bottomOffset = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);

  const hide = useCallback(() => setShown(false), []);
  useBackClose(open, () => onOpenChange(false));

  const fabPosition = useMemo(
    () => ({ position: 'absolute' as const, right: MARGIN, bottom: insets.bottom + MARGIN + bottomOffset }),
    [insets.bottom, bottomOffset],
  );
  const listPosition = useMemo(
    () => ({
      position: 'absolute' as const,
      right: MARGIN,
      bottom: insets.bottom + MARGIN + bottomOffset + FAB_SIZE + MARGIN,
    }),
    [insets.bottom, bottomOffset],
  );

  const select = (item: FabMenuItem) => {
    onOpenChange(false);
    item.onPress();
  };

  return (
    <View style={styles.root}>
      {open && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.ui.close}
          onPress={() => onOpenChange(false)}
          style={StyleSheet.absoluteFill}
        />
      )}
      {shown && (
        <View style={[styles.list, listPosition]}>
          {items.map((item, index) => (
            <MenuItem
              key={item.key}
              item={item}
              open={open}
              order={items.length - 1 - index}
              onHidden={hide}
              onSelect={select}
            />
          ))}
        </View>
      )}
      <Fab
        icon={icon}
        accessibilityLabel={accessibilityLabel}
        active={open}
        visible={visible}
        onPress={() => onOpenChange(!open)}
        style={fabPosition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' },
  list: { alignItems: 'flex-end', gap: 8, pointerEvents: 'box-none' },
  itemWrap: { alignItems: 'flex-end' },
  item: { height: ITEM_HEIGHT, flexDirection: 'row', gap: 8, paddingLeft: 16, paddingRight: 24 },
});
