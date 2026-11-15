import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectPrevious } from '../../data/selectors';
import { useData } from '../../data/useData';
import type { SelectedCell } from '../../data/useUi';
import { formatColumnDate, weekdayIndex, WEEKDAYS_SHORT } from '../../lib/date';
import { formatWeight } from '../../lib/format';
import * as haptics from '../../lib/haptics';
import { strings } from '../../lib/strings';
import { useTheme } from '../../theme/ThemeProvider';
import { fontFamily, typography } from '../../theme/tokens';
import { animateTo } from '../../ui/animate';
import { BottomSheet } from '../../ui/BottomSheet';
import { withAlpha } from '../../ui/color';
import { Chip } from '../../ui/Chip';
import { Icon, type IconName } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { PressableSurface } from '../../ui/PressableSurface';
import { showSnackbar } from '../../ui/Snackbar';
import { Text } from '../../ui/Text';
import { createThemedStyles, useFills } from '../../ui/themed';
import { Button } from '../../ui/Button';
import {
  numpadDisplay,
  numpadReduce,
  previousValue,
  sameWeights,
  type NumpadAction,
} from './numpad';

type Props = {
  /** The cell being edited; `null` closes the panel. */
  cell: SelectedCell | null;
  onClose: () => void;
  /** Panel height in dp (0 while closed); the screen uses it as the table's bottom padding. */
  onHeightChange: (height: number) => void;
};

const s = strings.entry;
const EMPTY: number[] = [];
const SHIFT = 6;
const KEY_HEIGHT = 48;
const KEY_GAP = 6;

const useValueStyles = createThemedStyles((c) => ({
  ...StyleSheet.create({
    value: { color: c.onSurface },
    ghost: { color: c.onSurfaceVariant },
    onPill: { color: c.onPrimaryContainer },
  }),
}));

type KeyProps = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  icon?: IconName;
  /** 1 or 2 columns wide. */
  span?: 1 | 2;
  look?: 'digit' | 'action' | 'primary';
};

// Keys have no visual gap in layout terms: each key sits in a padded cell, so the double-width
// zero lines up exactly with the 4-column grid above it.
const Key = memo(function Key({ label, accessibilityLabel, onPress, icon, span = 1, look = 'digit' }: KeyProps) {
  const { colors } = useTheme();
  const fills = useFills();
  const primary = look === 'primary';
  const content = primary ? colors.onPrimary : colors.onSurface;
  return (
    <View style={span === 2 ? styles.cellDouble : styles.cell}>
      <PressableSurface
        onPress={onPress}
        radius={KEY_HEIGHT / 2}
        pressedRadius={14}
        layerColor={content}
        touchStyle={styles.stretch}
        style={[styles.key, primary ? fills.primary : fills.surfaceContainerHigh]}
        minTouchHeight={KEY_HEIGHT}
        accessibilityLabel={accessibilityLabel}
      >
        {icon ? (
          <Icon name={icon} color={content} />
        ) : (
          <Text
            variant="labelLarge"
            color={primary ? 'onPrimary' : 'onSurface'}
            style={look === 'digit' ? styles.digit : undefined}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {label}
          </Text>
        )}
      </PressableSurface>
    </View>
  );
});

function weightsLabel(weights: readonly number[]): string {
  return `${weights.map(formatWeight).join(' · ')} ${s.unit}`;
}

function dateLabel(date: string | null): string {
  return date === null ? strings.table.noDate : `${WEEKDAYS_SHORT[weekdayIndex(date)]}, ${formatColumnDate(date)}`;
}

type ContentProps = {
  cell: SelectedCell;
  sheetHeight: number;
  onClose: () => void;
};

function SheetContent({ cell, sheetHeight, onClose }: ContentProps) {
  const { workoutId, exerciseId } = cell;
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const valueColors = useValueStyles();

  const exercise = useData((st) => st.exercises[exerciseId]);
  const workout = useData((st) => st.workouts[workoutId]);
  const entry = useData((st) => st.entries[workoutId]?.[exerciseId]);
  // The previous workout cannot change while this cell is open, so it is looked up once.
  const [previous] = useState(() => selectPrevious(useData.getState(), exerciseId, workoutId));
  const previousBase = previousValue(previous?.weights);

  const [typed, setTyped] = useState<{ active: number; buf: string | null }>({ active: 0, buf: null });
  const weights = entry?.weights ?? EMPTY;
  const active = Math.min(typed.active, Math.max(0, weights.length - 1));
  const state = { weights, active, buf: typed.buf, previous: previousBase };
  const display = numpadDisplay(state);
  const numeric = Number(display.text);

  const apply = (action: NumpadAction) => {
    // Weights are read from the store, not from the last render, so quick taps never use stale data.
    const stored = useData.getState().entries[workoutId]?.[exerciseId]?.weights ?? EMPTY;
    const next = numpadReduce({ ...state, weights: stored }, action);
    setTyped({ active: next.active, buf: next.buf });
    if (!sameWeights(next.weights, stored)) useData.getState().setWeights(workoutId, exerciseId, next.weights);
  };

  const press = (action: NumpadAction) => () => {
    haptics.key();
    apply(action);
  };
  const step = (delta: 1 | -1) => () => {
    haptics.tick();
    apply({ type: 'step', delta });
  };

  const clear = () => {
    haptics.reject();
    const undo = useData.getState().clearEntry(workoutId, exerciseId);
    setTyped({ active: 0, buf: null });
    if (entry) {
      showSnackbar({
        text: s.deleted,
        actionLabel: strings.common.undo,
        onAction: undo,
        // Just above the panel.
        bottomOffset: Math.max(0, sheetHeight - insets.bottom - 8),
      });
    }
  };

  const done = () => {
    haptics.confirm();
    onClose();
  };

  const openChart = () => {
    onClose();
    router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } });
  };

  // Retargeting the panel: the content eases in with a critically damped spring (no overshoot).
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.set(animateTo(1, 'standardFast', reduced));
  }, [enter, reduced]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * enter.get(),
    transform: [{ translateY: 6 * (1 - enter.get()) }],
  }));

  // The number nudges by 6 dp in the direction of the change and settles back.
  const shift = useSharedValue(0);
  const lastNumeric = useRef(numeric);
  useEffect(() => {
    const direction = Math.sign(numeric - lastNumeric.current);
    lastNumeric.current = numeric;
    if (direction === 0 || reduced) return;
    shift.set(withSequence(withTiming(-SHIFT * direction, { duration: 60 }), animateTo(0, 'effectsFast', false)));
  }, [numeric, shift, reduced]);
  const shiftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: shift.get() }] }));

  const pill = useSharedValue(display.replace ? 1 : 0);
  useEffect(() => {
    pill.set(animateTo(display.replace ? 1 : 0, 'effectsDefault', reduced));
  }, [display.replace, pill, reduced]);
  const clearContainer = useMemo(() => withAlpha(colors.primaryContainer, 0), [colors.primaryContainer]);
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pill.get(), [0, 1], [clearContainer, colors.primaryContainer]),
  }));

  const valueColor = display.ghost ? valueColors.ghost : display.replace ? valueColors.onPill : valueColors.value;
  const setCount = weights.length;
  const valueLabel = `${s.value}: ${display.text} ${s.unit}`;

  return (
    <Animated.View testID="entry-panel" style={[styles.content, enterStyle]}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text variant="titleMedium" numberOfLines={1}>
            {exercise?.name ?? ''}
          </Text>
          <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1}>
            {dateLabel(workout?.date ?? null)}
          </Text>
        </View>
        <IconButton icon="show_chart" accessibilityLabel={s.openChart} onPress={openChart} />
      </View>

      <View style={styles.previousRow}>
        {previous && !entry ? (
          <Button
            title={s.sameAsLast(weightsLabel(previous.weights))}
            variant="tonal"
            style={styles.previousButton}
            onPress={() => {
              haptics.key();
              apply({ type: 'copyPrevious', weights: previous.weights });
            }}
          />
        ) : previous ? (
          <Text variant="bodySmall" color="onSurfaceVariant" numberOfLines={1} style={styles.previousText}>
            {s.lastTime(weightsLabel(previous.weights), formatColumnDate(previous.date))}
          </Text>
        ) : (
          <Text variant="bodySmall" color="onSurfaceVariant" style={styles.previousText}>
            {s.firstEntry}
          </Text>
        )}
      </View>

      <View style={styles.stepper}>
        <IconButton
          icon="remove"
          accessibilityLabel={s.decrease}
          variant="tonal"
          size={56}
          pressedScale={0.92}
          onPress={step(-1)}
        />
        <View style={styles.valueBox} accessible accessibilityLabel={valueLabel} testID="entry-value">
          <Animated.View style={[styles.pill, pillStyle]}>
            <Animated.View style={[styles.valueRow, shiftStyle]}>
              <Text variant="displaySmall" numeric style={[styles.value, valueColor]} maxFontSizeMultiplier={1.2}>
                {display.text}
              </Text>
              <Text variant="bodyLarge" numeric style={[styles.unit, valueColor]} maxFontSizeMultiplier={1.2}>
                {` ${s.unit}`}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
        <IconButton
          icon="add"
          accessibilityLabel={s.increase}
          variant="filled"
          size={56}
          pressedScale={0.92}
          onPress={step(1)}
        />
      </View>

      {setCount >= 2 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.setsScroll}
          contentContainerStyle={styles.setsRow}
          keyboardShouldPersistTaps="handled"
        >
          {weights.map((weight, index) => (
            <Chip
              // Sets have no ids; the position is their identity.
              key={index}
              label={s.set(index + 1, formatWeight(weight))}
              accessibilityLabel={`${s.selectSet(index + 1)}: ${formatWeight(weight)} ${s.unit}`}
              selected={index === active}
              onPress={press({ type: 'selectSet', index })}
            />
          ))}
          <IconButton
            icon="delete"
            accessibilityLabel={s.removeSet}
            onPress={() => {
              haptics.reject();
              apply({ type: 'removeSet' });
            }}
          />
        </ScrollView>
      ) : null}

      <View style={styles.keypad}>
        <View style={styles.keyRow}>
          <Key label="1" accessibilityLabel="1" onPress={press({ type: 'digit', digit: '1' })} />
          <Key label="2" accessibilityLabel="2" onPress={press({ type: 'digit', digit: '2' })} />
          <Key label="3" accessibilityLabel="3" onPress={press({ type: 'digit', digit: '3' })} />
          <Key label="" icon="backspace" accessibilityLabel={s.backspace} onPress={press({ type: 'backspace' })} />
        </View>
        <View style={styles.keyRow}>
          <Key label="4" accessibilityLabel="4" onPress={press({ type: 'digit', digit: '4' })} />
          <Key label="5" accessibilityLabel="5" onPress={press({ type: 'digit', digit: '5' })} />
          <Key label="6" accessibilityLabel="6" onPress={press({ type: 'digit', digit: '6' })} />
          <Key label={s.addSet} look="action" accessibilityLabel={s.addSetLabel} onPress={press({ type: 'addSet' })} />
        </View>
        <View style={styles.keyRow}>
          <Key label="7" accessibilityLabel="7" onPress={press({ type: 'digit', digit: '7' })} />
          <Key label="8" accessibilityLabel="8" onPress={press({ type: 'digit', digit: '8' })} />
          <Key label="9" accessibilityLabel="9" onPress={press({ type: 'digit', digit: '9' })} />
          <Key label={s.clear} look="action" accessibilityLabel={s.clear} onPress={clear} />
        </View>
        <View style={styles.keyRow}>
          <Key label="." accessibilityLabel={s.point} onPress={press({ type: 'point' })} />
          <Key label="0" span={2} accessibilityLabel="0" onPress={press({ type: 'digit', digit: '0' })} />
          <Key label={s.done} look="primary" accessibilityLabel={s.done} onPress={done} />
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Weight entry panel (plan 8.5): a non-modal bottom sheet with the previous value, a stepper, set
 * chips and its own numeric keypad. The system keyboard is never opened. Every change that makes a
 * valid number is saved at once; nothing is created until a digit, "+", "-" or "Same as last time"
 * is pressed.
 */
export function CellSheet({ cell, onClose, onHeightChange }: Props) {
  // Keeps the last cell while the panel slides out, when `cell` is already null.
  const [last, setLast] = useState(cell);
  if (cell && (last === null || last.workoutId !== cell.workoutId || last.exerciseId !== cell.exerciseId)) {
    setLast(cell);
  }
  const [height, setHeight] = useState(0);

  const handleHeight = (h: number) => {
    setHeight(h);
    onHeightChange(h);
  };

  return (
    <BottomSheet
      visible={cell !== null}
      onClose={onClose}
      modal={false}
      onHeightChange={handleHeight}
      accessibilityLabel={s.panel}
    >
      {last ? (
        // A new key per cell resets the typed text and the active set when the panel retargets.
        <SheetContent key={`${last.workoutId}|${last.exerciseId}`} cell={last} sheetHeight={height} onClose={onClose} />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 12 },
  header: { height: 48, paddingLeft: 24, paddingRight: 12, flexDirection: 'row', alignItems: 'center' },
  headerTexts: { flex: 1, justifyContent: 'center' },
  previousRow: { height: 40, paddingHorizontal: 24, justifyContent: 'center' },
  previousButton: { alignSelf: 'flex-start', marginLeft: -8, maxWidth: '100%' },
  previousText: { paddingVertical: 2 },
  stepper: { height: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  valueBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 9999, paddingHorizontal: 20, minWidth: 96, alignItems: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  value: { fontFamily: fontFamily.medium, fontVariant: ['tabular-nums'] },
  unit: { ...typography.bodyLarge, letterSpacing: 0 },
  setsScroll: { flexGrow: 0 },
  setsRow: { height: 48, alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  keypad: { paddingHorizontal: 16 - KEY_GAP / 2, paddingTop: 4 },
  keyRow: { flexDirection: 'row' },
  cell: { width: '25%', padding: KEY_GAP / 2 },
  cellDouble: { width: '50%', padding: KEY_GAP / 2 },
  stretch: { alignSelf: 'stretch' },
  key: { height: KEY_HEIGHT, alignSelf: 'stretch' },
  digit: { fontSize: 20, lineHeight: 24 },
});
