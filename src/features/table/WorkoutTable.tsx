// Native implementation (Android; iOS native later). Layout: an outer vertical scroll view holds
// [name column | horizontal scroll view]. The date header lives INSIDE the horizontal scroll view, so it
// moves horizontally with the cells natively. Vertically the header and the corner are pinned by
// `translateY = scrollY`, computed on the UI thread. Date columns are a pool of recycled slots.
import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { cellValue } from '../../data/selectors';
import { useData } from '../../data/useData';
import { formatLongDate } from '../../lib/date';
import { formatWeight } from '../../lib/format';
import { strings } from '../../lib/strings';
import { useTheme, type Palette } from '../../theme/ThemeProvider';
import { fontFamily, stateLayer } from '../../theme/tokens';
import { cellLabel, dotsFor, headerLabel } from './labels';
import {
  BUCKET,
  COL_W,
  HEADER_H,
  NAME_W,
  OVERSCAN_NATIVE,
  ROW_H,
  TRAIL_PAD,
  contentHeight,
} from './metrics';
import { trackSlotMount } from './slotStats';
import type { RowInfo, WorkoutTableProps } from './types';
import { bucketIndex, computeWindow, poolSize, replacedWholesale, revealOffset } from './window';

const FONT_SCALE_CAP = 1.3;

/** Appends an alpha channel to a `#RRGGBB` color. */
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

// Colors depend on the theme, so the styles are built once per theme and passed down as one object.
function makeThemedStyles(c: Palette) {
  return {
    ...StyleSheet.create({
      root: { flex: 1, backgroundColor: c.surface },
      nameColumn: {
        backgroundColor: c.surfaceContainerLow,
        borderRightWidth: 1,
        borderRightColor: c.outlineVariant,
      },
      corner: {
        backgroundColor: c.surfaceContainerLow,
        borderRightWidth: 1,
        borderRightColor: c.outlineVariant,
        borderBottomWidth: 1,
        borderBottomColor: c.outlineVariant,
        justifyContent: 'center',
        paddingHorizontal: 12,
      },
      cornerText: {
        fontFamily: fontFamily.medium,
        fontSize: 11,
        lineHeight: 16,
        letterSpacing: 0.5,
        color: c.onSurfaceVariant,
      },
      nameRow: { borderBottomWidth: 1, borderBottomColor: c.outlineVariant },
      nameText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 16, color: c.onSurface },
      addText: {
        fontFamily: fontFamily.medium,
        fontSize: 14,
        lineHeight: 20,
        letterSpacing: 0.1,
        color: c.primary,
      },
      headerStrip: {
        backgroundColor: c.surfaceContainerLow,
        borderBottomWidth: 1,
        borderBottomColor: c.outlineVariant,
      },
      divider: { backgroundColor: c.outlineVariant },
      todayColumn: { backgroundColor: withAlpha(c.primary, 0.08) },
      cellSelected: {
        backgroundColor: c.primaryContainer,
        borderWidth: 2,
        borderColor: c.primary,
      },
      value: {
        fontFamily: fontFamily.medium,
        fontSize: 15,
        lineHeight: 20,
        color: c.onSurface,
        fontVariant: ['tabular-nums'],
      },
      valueUndated: {
        fontFamily: fontFamily.medium,
        fontSize: 15,
        lineHeight: 20,
        color: c.onSurfaceVariant,
        fontVariant: ['tabular-nums'],
      },
      dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: c.outline },
      plus: {
        fontFamily: fontFamily.medium,
        fontSize: 11,
        lineHeight: 12,
        letterSpacing: 0.5,
        color: c.outline,
        includeFontPadding: false,
      },
      date: {
        fontFamily: fontFamily.medium,
        fontSize: 14,
        lineHeight: 20,
        letterSpacing: 0.1,
        color: c.onSurface,
        fontVariant: ['tabular-nums'],
      },
      datePill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 9999,
        backgroundColor: c.primaryContainer,
        overflow: 'hidden',
        color: c.onPrimaryContainer,
      },
      sub: {
        fontFamily: fontFamily.regular,
        fontSize: 11,
        lineHeight: 16,
        letterSpacing: 0.5,
        color: c.onSurfaceVariant,
      },
      noDate: {
        width: 40,
        paddingVertical: 3,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.outline,
        borderRadius: 8,
        textAlign: 'center',
        fontFamily: fontFamily.regular,
        fontSize: 11,
        lineHeight: 14,
        color: c.onSurfaceVariant,
      },
    }),
    ripple: { color: withAlpha(c.onSurface, stateLayer.cellPressed) },
  };
}

type ThemedStyles = ReturnType<typeof makeThemedStyles>;

const layout = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  nameColumnOuter: { width: NAME_W, alignSelf: 'flex-start' },
  corner: { position: 'absolute', top: 0, left: 0, width: NAME_W, height: HEADER_H, zIndex: 2 },
  nameRowsOffset: { paddingTop: HEADER_H },
  nameRow: { height: ROW_H, paddingLeft: 12, paddingRight: 8, justifyContent: 'center' },
  addRow: { height: ROW_H, paddingHorizontal: 12, justifyContent: 'center' },
  headerStrip: { position: 'absolute', top: 0, left: 0, height: HEADER_H, zIndex: 2 },
  headerCell: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: COL_W,
    height: HEADER_H - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { position: 'absolute', left: 0, right: 0, height: 1 },
  slot: { position: 'absolute', top: HEADER_H, left: 0, width: COL_W },
  cell: { height: ROW_H - 1, marginBottom: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 3,
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});

type CellProps = {
  workoutId: string;
  exerciseId: string;
  label: string;
  text: string | null;
  dots: number;
  plus: boolean;
  selected: boolean;
  undated: boolean;
  ts: ThemedStyles;
  onPress: (workoutId: string, exerciseId: string) => void;
};

// All props are primitives or stable objects: when one entry changes, only its cell re-renders.
const Cell = memo(function Cell({
  workoutId,
  exerciseId,
  label,
  text,
  dots,
  plus,
  selected,
  undated,
  ts,
  onPress,
}: CellProps) {
  const handlePress = useCallback(() => onPress(workoutId, exerciseId), [onPress, workoutId, exerciseId]);
  const dotViews: ReactNode[] = [];
  for (let i = 0; i < dots; i++) dotViews.push(<View key={i} style={ts.dot} />);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={ts.ripple}
      onPress={handlePress}
      style={selected ? [layout.cell, ts.cellSelected] : layout.cell}
    >
      {text !== null && (
        <Text style={undated ? ts.valueUndated : ts.value} maxFontSizeMultiplier={FONT_SCALE_CAP}>
          {text}
        </Text>
      )}
      {dots > 0 && (
        <View style={layout.dots} pointerEvents="none">
          {dotViews}
          {plus && (
            <Text style={ts.plus} maxFontSizeMultiplier={FONT_SCALE_CAP}>
              +
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
});

type ColumnSlotProps = {
  workoutId: string;
  rows: RowInfo[];
  x: number;
  today: string;
  selectedExerciseId: string | null;
  ts: ThemedStyles;
  onCellPress: (workoutId: string, exerciseId: string) => void;
};

// One subscription for the cells; the date is a primitive subscription that fires only on a date change.
const ColumnSlot = memo(function ColumnSlot({
  workoutId,
  rows,
  x,
  today,
  selectedExerciseId,
  ts,
  onCellPress,
}: ColumnSlotProps) {
  const byExercise = useData((s) => s.entries[workoutId]);
  const date = useData((s) => s.workouts[workoutId]?.date ?? null);
  useEffect(trackSlotMount, []);

  const cells = [];
  for (const row of rows) {
    const weights = byExercise?.[row.id]?.weights;
    const { dots, plus } = dotsFor(weights ? weights.length : 0);
    cells.push(
      <Cell
        key={row.id}
        workoutId={workoutId}
        exerciseId={row.id}
        label={cellLabel(row.name, date, weights)}
        text={weights ? formatWeight(cellValue(weights)) : null}
        dots={dots}
        plus={plus}
        selected={row.id === selectedExerciseId}
        undated={date === null}
        ts={ts}
        onPress={onCellPress}
      />,
    );
  }

  return (
    <View style={[layout.slot, date === today && ts.todayColumn, { transform: [{ translateX: x }] }]}>{cells}</View>
  );
});

type HeaderSlotProps = {
  workoutId: string;
  x: number;
  today: string;
  ts: ThemedStyles;
  onHeaderPress: (workoutId: string) => void;
};

const HeaderSlot = memo(function HeaderSlot({ workoutId, x, today, ts, onHeaderPress }: HeaderSlotProps) {
  const date = useData((s) => s.workouts[workoutId]?.date ?? null);
  const label = headerLabel(date, today);
  const handlePress = useCallback(() => onHeaderPress(workoutId), [onHeaderPress, workoutId]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={date === null ? strings.table.noDate : formatLongDate(date)}
      android_ripple={ts.ripple}
      onPress={handlePress}
      style={[layout.headerCell, { transform: [{ translateX: x }] }]}
    >
      {label.date === null ? (
        <Text style={ts.noDate} maxFontSizeMultiplier={FONT_SCALE_CAP}>
          {`${strings.table.noDateTop}\n${strings.table.noDateBottom}`}
        </Text>
      ) : (
        <>
          <Text
            style={date === today ? [ts.date, ts.datePill] : ts.date}
            maxFontSizeMultiplier={FONT_SCALE_CAP}
          >
            {label.date}
          </Text>
          <Text style={ts.sub} maxFontSizeMultiplier={FONT_SCALE_CAP}>
            {label.sub}
          </Text>
        </>
      )}
    </Pressable>
  );
});

type NameColumnProps = {
  rows: RowInfo[];
  ts: ThemedStyles;
  onNamePress: (exerciseId: string) => void;
  onAddExercise: () => void;
};

const NameColumn = memo(function NameColumn({ rows, ts, onNamePress, onAddExercise }: NameColumnProps) {
  return (
    <View style={[layout.nameRowsOffset, ts.nameColumn, { height: HEADER_H + (rows.length + 1) * ROW_H }]}>
      {rows.map((row) => (
        <NameRow key={row.id} row={row} ts={ts} onNamePress={onNamePress} />
      ))}
      <Pressable
        accessibilityRole="button"
        android_ripple={ts.ripple}
        onPress={onAddExercise}
        style={layout.addRow}
      >
        <Text style={ts.addText} maxFontSizeMultiplier={FONT_SCALE_CAP}>
          {strings.table.addExercise}
        </Text>
      </Pressable>
    </View>
  );
});

const NameRow = memo(function NameRow({
  row,
  ts,
  onNamePress,
}: {
  row: RowInfo;
  ts: ThemedStyles;
  onNamePress: (exerciseId: string) => void;
}) {
  const handlePress = useCallback(() => onNamePress(row.id), [onNamePress, row.id]);
  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={ts.ripple}
      onPress={handlePress}
      style={[layout.nameRow, ts.nameRow]}
    >
      <Text style={ts.nameText} numberOfLines={2} maxFontSizeMultiplier={FONT_SCALE_CAP}>
        {row.name}
      </Text>
    </Pressable>
  );
});

const Dividers = memo(function Dividers({ count, ts }: { count: number; ts: ThemedStyles }) {
  const lines = [];
  for (let r = 0; r < count; r++) {
    lines.push(<View key={r} style={[layout.divider, ts.divider, { top: HEADER_H + (r + 1) * ROW_H - 1 }]} />);
  }
  return <>{lines}</>;
});

export function WorkoutTable({
  rowIds,
  columnIds,
  today,
  selectedCell,
  bottomPad,
  onCellPress,
  onHeaderPress,
  onNamePress,
  onAddExercise,
  ref,
}: WorkoutTableProps) {
  const { colors } = useTheme();
  const ts = useMemo(() => makeThemedStyles(colors), [colors]);
  const exercises = useData((s) => s.exercises);
  const rows = useMemo<RowInfo[]>(
    () => rowIds.map((id) => ({ id, name: exercises[id]?.name ?? '' })),
    [rowIds, exercises],
  );
  const total = columnIds.length;
  const stripW = total * COL_W + TRAIL_PAD;

  // Callbacks go through a ref so the memoized slots and cells keep identical props between renders.
  const handlers = useRef({ onCellPress, onHeaderPress, onNamePress, onAddExercise });
  useEffect(() => {
    handlers.current = { onCellPress, onHeaderPress, onNamePress, onAddExercise };
  });
  const cellPress = useCallback((w: string, e: string) => handlers.current.onCellPress(w, e), []);
  const headerPress = useCallback((w: string) => handlers.current.onHeaderPress(w), []);
  const namePress = useCallback((e: string) => handlers.current.onNamePress(e), []);
  const addExercise = useCallback(() => handlers.current.onAddExercise(), []);

  const screenW = useWindowDimensions().width;
  const [viewportW, setViewportW] = useState(screenW);
  const viewportH = useRef(0);
  const dataW = Math.max(0, viewportW - NAME_W);

  const verticalRef = useRef<Animated.ScrollView>(null);
  const horizontalRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const pinnedToEnd = useRef(false);

  // First render already mounts the columns at the right edge (newest dates).
  const [initialX] = useState(() => Math.max(0, stripW - (screenW - NAME_W)));
  const [bucket, setBucket] = useState(() => bucketIndex(initialX, COL_W, BUCKET));

  const onVerticalScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  const onHorizontalScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  // The window moves on the JS thread only when the scroll crosses a bucket boundary.
  useAnimatedReaction(
    () => Math.max(0, Math.floor(scrollX.get() / (COL_W * BUCKET))),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setBucket, current);
    },
  );

  // Pins the header strip and the corner to the top of the viewport.
  const stickyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.get() }] }));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    viewportH.current = height;
    setViewportW(width);
  };

  // Start at the right edge, and again when the table goes from empty to filled.
  const onContentSizeChange = (width: number) => {
    if (total === 0) {
      pinnedToEnd.current = false;
      return;
    }
    if (pinnedToEnd.current) return;
    pinnedToEnd.current = true;
    const x = Math.max(0, width - dataW);
    horizontalRef.current?.scrollTo({ x, animated: false });
    scrollX.set(x);
    setBucket(bucketIndex(x, COL_W, BUCKET));
  };

  // The data was replaced wholesale (import, demo data): jump to the newest column like on the first
  // open. The scroll is repeated on the next frame because the native content size may still be the old one.
  const previousColumns = useRef(columnIds);
  useEffect(() => {
    const previous = previousColumns.current;
    previousColumns.current = columnIds;
    if (!replacedWholesale(previous, columnIds)) return;
    const x = Math.max(0, stripW - dataW);
    const jump = () => horizontalRef.current?.scrollTo({ x, animated: false });
    jump();
    scrollX.set(x);
    setBucket(bucketIndex(x, COL_W, BUCKET));
    const frame = requestAnimationFrame(jump);
    return () => cancelAnimationFrame(frame);
  }, [columnIds, stripW, dataW, scrollX]);

  const win = computeWindow({
    scrollX: bucket * COL_W * BUCKET,
    viewportW: dataW,
    colW: COL_W,
    total,
    overscan: OVERSCAN_NATIVE,
    bucket: BUCKET,
  });
  const pool = poolSize(dataW, OVERSCAN_NATIVE);
  const firstKey = win.first % pool;

  const bodySlots = [];
  const headerSlots = [];
  for (let key = 0; key < pool; key++) {
    const index = win.first + ((key - firstKey + pool) % pool);
    if (index > win.last) continue;
    const workoutId = columnIds[index];
    bodySlots.push(
      <ColumnSlot
        key={key}
        workoutId={workoutId}
        rows={rows}
        x={index * COL_W}
        today={today}
        selectedExerciseId={selectedCell?.workoutId === workoutId ? selectedCell.exerciseId : null}
        ts={ts}
        onCellPress={cellPress}
      />,
    );
    headerSlots.push(
      <HeaderSlot
        key={key}
        workoutId={workoutId}
        x={index * COL_W}
        today={today}
        ts={ts}
        onHeaderPress={headerPress}
      />,
    );
  }

  useImperativeHandle(
    ref,
    () => ({
      scrollToColumn(workoutId, animated) {
        const index = columnIds.indexOf(workoutId);
        if (index < 0) return;
        const x = Math.max(0, index * COL_W - (dataW - COL_W) / 2);
        horizontalRef.current?.scrollTo({ x, animated });
      },
      ensureCellVisible(workoutId, exerciseId, bottomInset) {
        const column = columnIds.indexOf(workoutId);
        const row = rowIds.indexOf(exerciseId);
        if (column < 0 || row < 0) return;
        const currentX = scrollX.get();
        const currentY = scrollY.get();
        const x = revealOffset(column * COL_W, COL_W, currentX, dataW);
        const y = revealOffset(row * ROW_H, ROW_H, currentY, viewportH.current - HEADER_H - bottomInset);
        if (x !== currentX) horizontalRef.current?.scrollTo({ x, animated: true });
        if (y !== currentY) verticalRef.current?.scrollTo({ y, animated: true });
      },
    }),
    [columnIds, rowIds, dataW, scrollX, scrollY],
  );

  return (
    <View style={ts.root}>
      <Animated.ScrollView
        ref={verticalRef}
        style={layout.fill}
        onLayout={onLayout}
        onScroll={onVerticalScroll}
        scrollEventThrottle={16}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={[layout.row, { height: contentHeight(rows.length, bottomPad) }]}>
          <View style={layout.nameColumnOuter}>
            <NameColumn rows={rows} ts={ts} onNamePress={namePress} onAddExercise={addExercise} />
            <Animated.View style={[layout.corner, ts.corner, stickyStyle]}>
              <Text style={ts.cornerText} maxFontSizeMultiplier={FONT_SCALE_CAP}>
                {strings.table.corner}
              </Text>
            </Animated.View>
          </View>
          <Animated.ScrollView
            ref={horizontalRef}
            horizontal
            style={layout.fill}
            onScroll={onHorizontalScroll}
            scrollEventThrottle={16}
            overScrollMode="never"
            bounces={false}
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: initialX, y: 0 }}
            onContentSizeChange={onContentSizeChange}
          >
            <View style={{ width: stripW, height: contentHeight(rows.length, bottomPad) }}>
              <Dividers count={rows.length} ts={ts} />
              {bodySlots}
              <Animated.View style={[layout.headerStrip, ts.headerStrip, { width: stripW }, stickyStyle]}>
                {headerSlots}
              </Animated.View>
            </View>
          </Animated.ScrollView>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
