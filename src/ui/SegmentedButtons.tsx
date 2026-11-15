import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/tokens';
import { animateTo } from './animate';
import { withAlpha } from './color';
import { Icon } from './Icon';
import { PressableSurface } from './PressableSurface';
import { createThemedStyles } from './themed';

export type SegmentedOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Describes the whole group to assistive technology. */
  accessibilityLabel?: string;
  /** Check mark on the selected segment (default true). Off, only the fill marks the selection. */
  showCheck?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT = 40;
const CHECK = 18;
const R = HEIGHT / 2;

type Position = 'first' | 'middle' | 'last' | 'only';

const segmentShape = StyleSheet.create({
  first: { borderTopLeftRadius: R, borderBottomLeftRadius: R },
  middle: {},
  last: { borderTopRightRadius: R, borderBottomRightRadius: R },
  only: { borderRadius: R },
});

const useOutline = createThemedStyles((c) => StyleSheet.create({ border: { borderColor: c.outline } }));

type SegmentProps = {
  label: string;
  selected: boolean;
  position: Position;
  showCheck: boolean;
  onPress: () => void;
};

function Segment({ label, selected, position, showCheck, onPress }: SegmentProps) {
  const { colors } = useTheme();
  const outline = useOutline();
  const reduced = useReducedMotion();
  const tint = useSharedValue(selected ? 1 : 0);
  const check = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    tint.set(animateTo(selected ? 1 : 0, 'effectsDefault', reduced));
    check.set(animateTo(selected ? 1 : 0, 'layoutFast', reduced));
  }, [selected, tint, check, reduced]);

  // withAlpha is a plain function: it must not be called inside a worklet.
  const clear = useMemo(() => withAlpha(colors.secondaryContainer, 0), [colors.secondaryContainer]);
  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tint.get(), [0, 1], [clear, colors.secondaryContainer]),
  }));
  const labelColor = useAnimatedStyle(() => ({
    color: interpolateColor(tint.get(), [0, 1], [colors.onSurface, colors.onSecondaryContainer]),
  }));
  const checkStyle = useAnimatedStyle(() => {
    const c = Math.max(0, check.get());
    return { width: CHECK * c, marginRight: 8 * c, opacity: Math.min(1, c) };
  });

  return (
    <PressableSurface
      onPress={onPress}
      layerColor={selected ? colors.onSecondaryContainer : colors.onSurface}
      touchStyle={styles.stretch}
      animatedStyle={fill}
      style={[styles.segment, outline.border, segmentShape[position]]}
      minTouchWidth={0}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
    >
      {showCheck ? (
        <Animated.View style={[styles.check, checkStyle]}>
          <Icon name="check" size={CHECK} color={colors.onSecondaryContainer} />
        </Animated.View>
      ) : null}
      <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[typography.labelLarge, labelColor]}>
        {label}
      </Animated.Text>
    </PressableSurface>
  );
}

function positionOf(index: number, count: number): Position {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** MD3 single-choice segmented button: height 40 (touch 48), 1 px outline, check mark on the selected segment (optional). */
export function SegmentedButtons<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  showCheck = true,
  style,
}: Props<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.row, style]}>
      {options.map((option, index) => (
        <View
          key={option.value}
          style={[styles.slot, index > 0 && styles.overlap, option.value === value && styles.slotSelected]}
        >
          <Segment
            label={option.label}
            selected={option.value === value}
            position={positionOf(index, options.length)}
            showCheck={showCheck}
            onPress={() => onChange(option.value)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  slot: { flex: 1 },
  // Neighbouring borders overlap so the divider stays 1 px wide.
  overlap: { marginLeft: -1 },
  slotSelected: { zIndex: 1 },
  stretch: { alignSelf: 'stretch' },
  segment: {
    height: HEIGHT,
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  check: { height: CHECK, overflow: 'hidden', alignItems: 'flex-start' },
});
