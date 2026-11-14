import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  scrollTo,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import * as haptics from '../../lib/haptics';
import { strings } from '../../lib/strings';
import { useTheme } from '../../theme/ThemeProvider';
import { stateLayer } from '../../theme/tokens';
import { animateTo } from '../../ui/animate';
import { shadow } from '../../ui/elevation';
import { Icon } from '../../ui/Icon';
import {
  autoScrollRatio,
  indexFromTop,
  orderFromPositions,
  positionsFromOrder,
  shiftPositions,
  type Positions,
} from './reorderMath';

export const ROW_HEIGHT = 56;
const HANDLE_SIZE = 48;
const HANDLE_TOP = (ROW_HEIGHT - HANDLE_SIZE) / 2;
/** The list scrolls when the finger is closer than this to the top or bottom edge of the viewport. */
const AUTOSCROLL_EDGE = 72;
/** Auto-scroll speed at the very edge (dp per second). */
const AUTOSCROLL_SPEED = 900;
const LIFT_SCALE = 0.02;

/** State shared between the list, its frame callback and the gestures of the rows. */
type DragContext = {
  positions: SharedValue<Positions>;
  /** The row being dragged, or null. */
  activeId: SharedValue<string | null>;
  count: SharedValue<number>;
  /** Top of the dragged row in list coordinates, following the finger. */
  dragTop: SharedValue<number>;
  startTop: SharedValue<number>;
  startScroll: SharedValue<number>;
  /** Finger position in the viewport when the drag began, plus the pan translation. */
  fingerStartY: SharedValue<number>;
  translation: SharedValue<number>;
  scrollY: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  contentHeight: SharedValue<number>;
};

const dragStepHaptic = () => haptics.dragStep();

/** Recomputes the dragged row's top and, when it crosses into another slot, the neighbours' slots. */
function applyDrag(ctx: DragContext) {
  'worklet';
  const id = ctx.activeId.get();
  if (id === null) return;
  const count = ctx.count.get();
  const raw = ctx.startTop.get() + ctx.translation.get() + (ctx.scrollY.get() - ctx.startScroll.get());
  const top = Math.min(Math.max(raw, 0), Math.max(count - 1, 0) * ROW_HEIGHT);
  ctx.dragTop.set(top);
  const positions = ctx.positions.get();
  const target = indexFromTop(top, ROW_HEIGHT, count);
  if (positions[id] !== undefined && positions[id] !== target) {
    ctx.positions.set(shiftPositions(positions, id, target));
    scheduleOnRN(dragStepHaptic);
  }
}

// The handle must own the touch: without `touch-action: none` the browser takes a vertical drag as a scroll.
const handleWebStyle = Platform.select<ViewStyle>({
  web: { touchAction: 'none', cursor: 'grab', userSelect: 'none' } as ViewStyle,
  default: {},
});

type RowProps = {
  id: string;
  index: number;
  ctx: DragContext;
  renderItem: (id: string, handle: ReactNode) => ReactNode;
  onDragState: (active: boolean) => void;
  onCommit: (orderedIds: string[]) => void;
};

const Row = memo(function Row({ id, index, ctx, renderItem, onDragState, onCommit }: RowProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  // Resting top of this row; neighbours of a dragged row slide here with a spring.
  const top = useSharedValue(index * ROW_HEIGHT);
  const lift = useSharedValue(0);

  useAnimatedReaction(
    () => (ctx.activeId.get() === id ? -1 : (ctx.positions.get()[id] ?? -1)),
    (slot) => {
      if (slot >= 0) top.set(animateTo(slot * ROW_HEIGHT, 'spatialFast', reduced));
    },
  );

  const pan = usePanGesture({
    minDistance: 2,
    onActivate: (event) => {
      'worklet';
      const slot = ctx.positions.get()[id];
      if (slot === undefined) return;
      const rowTop = slot * ROW_HEIGHT;
      ctx.activeId.set(id);
      ctx.startTop.set(rowTop);
      ctx.startScroll.set(ctx.scrollY.get());
      ctx.translation.set(0);
      ctx.dragTop.set(rowTop);
      ctx.fingerStartY.set(rowTop - ctx.scrollY.get() + HANDLE_TOP + event.y);
      lift.set(animateTo(1, 'spatialFast', reduced));
      scheduleOnRN(onDragState, true);
    },
    onUpdate: (event) => {
      'worklet';
      if (ctx.activeId.get() !== id) return;
      ctx.translation.set(event.translationY);
      applyDrag(ctx);
    },
    onDeactivate: () => {
      'worklet';
      if (ctx.activeId.get() !== id) return;
      // Hand over from "follow the finger" to "spring into the slot".
      top.set(ctx.dragTop.get());
      ctx.activeId.set(null);
      lift.set(animateTo(0, 'spatialFast', reduced));
      scheduleOnRN(onDragState, false);
      scheduleOnRN(onCommit, orderFromPositions(ctx.positions.get()));
    },
  });

  const rowStyle = useAnimatedStyle(() => {
    const active = ctx.activeId.get() === id;
    const l = lift.get();
    return {
      transform: [{ translateY: active ? ctx.dragTop.get() : top.get() }, { scale: 1 + LIFT_SCALE * l }],
      zIndex: active ? 2 : l > 0.001 ? 1 : 0,
    };
  });
  const shadowAnimated = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, lift.get())) }));
  const layerAnimated = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, lift.get())) * stateLayer.dragged,
  }));

  const fillStyle = useMemo(() => ({ backgroundColor: colors.surface }), [colors.surface]);
  const liftedStyle = useMemo(
    () => ({ backgroundColor: colors.surface, ...shadow('level3', colors.shadow) }),
    [colors.surface, colors.shadow],
  );
  const layerFill = useMemo(() => ({ backgroundColor: colors.onSurface }), [colors.onSurface]);

  const handle = (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.handle, handleWebStyle]}
        accessibilityRole="button"
        accessibilityLabel={strings.manage.reorder}
        testID={`reorder-handle-${id}`}
      >
        <Icon name="drag_indicator" color={colors.onSurfaceVariant} />
      </View>
    </GestureDetector>
  );

  return (
    <Animated.View style={[styles.row, rowStyle]} testID={`reorder-row-${id}`}>
      <Animated.View style={[styles.layer, liftedStyle, shadowAnimated]} />
      <View style={[styles.content, fillStyle]}>{renderItem(id, handle)}</View>
      <Animated.View style={[styles.layer, layerFill, layerAnimated]} />
    </Animated.View>
  );
});

type Props = {
  /** Row ids in display order. Rows are `ROW_HEIGHT` tall. */
  ids: readonly string[];
  /** Renders the row body; `handle` is the drag handle (48x48) to place where it belongs. */
  renderItem: (id: string, handle: ReactNode) => ReactNode;
  /** Called once when a drag ends with a changed order. */
  onReorder: (orderedIds: string[]) => void;
  /** Rendered instead of the rows when `ids` is empty. */
  empty?: ReactNode;
  /** Rendered under the rows, inside the same scroll view. */
  footer?: ReactNode;
  /** Space under the content (for example to clear a FAB). */
  bottomPadding?: number;
};

const sameOrder = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * Vertical list of fixed-height rows that are reordered by dragging their handle. Rows sit at
 * absolute positions driven by a shared `positions` map; neighbours of the dragged row slide with
 * a spring and the list scrolls itself when the finger nears an edge. The new order is reported
 * once, on release.
 */
export function ReorderList({ ids, renderItem, onReorder, empty, footer, bottomPadding = 0 }: Props) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const positions = useSharedValue<Positions>(positionsFromOrder(ids));
  const activeId = useSharedValue<string | null>(null);
  const count = useSharedValue(ids.length);
  const dragTop = useSharedValue(0);
  const startTop = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const fingerStartY = useSharedValue(0);
  const translation = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  const ctx = useMemo<DragContext>(
    () => ({
      positions,
      activeId,
      count,
      dragTop,
      startTop,
      startScroll,
      fingerStartY,
      translation,
      scrollY,
      viewportHeight,
      contentHeight,
    }),
    [
      positions,
      activeId,
      count,
      dragTop,
      startTop,
      startScroll,
      fingerStartY,
      translation,
      scrollY,
      viewportHeight,
      contentHeight,
    ],
  );

  // The data changes from outside too (an exercise is added, archived, regrouped): rebuild the slots.
  useEffect(() => {
    count.set(ids.length);
    positions.set(positionsFromOrder(ids));
    const active = activeId.get();
    if (active !== null && !ids.includes(active)) activeId.set(null);
  }, [ids, count, positions, activeId]);

  const latest = useRef({ ids, onReorder });
  useEffect(() => {
    latest.current = { ids, onReorder };
  });

  const onCommit = useCallback((ordered: string[]) => {
    const current = latest.current;
    if (!sameOrder(ordered, current.ids)) current.onReorder(ordered);
  }, []);

  // Auto-scroll runs on every frame, only while a row is being dragged.
  const frame = useFrameCallback((info) => {
    'worklet';
    if (ctx.activeId.get() === null) return;
    const fingerY = ctx.fingerStartY.get() + ctx.translation.get();
    const ratio = autoScrollRatio(fingerY, ctx.viewportHeight.get(), AUTOSCROLL_EDGE);
    if (ratio === 0) return;
    const maxScroll = Math.max(0, ctx.contentHeight.get() - ctx.viewportHeight.get());
    const dt = info.timeSincePreviousFrame ?? 16;
    const next = Math.min(Math.max(ctx.scrollY.get() + (ratio * AUTOSCROLL_SPEED * dt) / 1000, 0), maxScroll);
    if (next === ctx.scrollY.get()) return;
    ctx.scrollY.set(next);
    scrollTo(scrollRef, 0, next, false);
    applyDrag(ctx);
  }, false);

  const onDragState = useCallback(
    (active: boolean) => {
      frame.setActive(active);
      if (active) haptics.dragStart();
    },
    [frame],
  );

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  // A native ScrollView would keep scrolling under the finger; the web handle uses touch-action instead.
  const scrollProps = useAnimatedProps(() => ({ scrollEnabled: activeId.get() === null }));

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => viewportHeight.set(event.nativeEvent.layout.height),
    [viewportHeight],
  );
  const onContentSizeChange = useCallback((_width: number, height: number) => contentHeight.set(height), [contentHeight]);

  const contentStyle = useMemo(() => ({ paddingBottom: bottomPadding }), [bottomPadding]);
  const listStyle = useMemo(() => ({ height: ids.length * ROW_HEIGHT }), [ids.length]);

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={contentStyle}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      onLayout={onLayout}
      onContentSizeChange={onContentSizeChange}
      animatedProps={Platform.OS === 'web' ? undefined : scrollProps}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {ids.length === 0 ? (
        empty
      ) : (
        <View style={listStyle} testID="reorder-list">
          {ids.map((id, index) => (
            <Row
              key={id}
              id={id}
              index={index}
              ctx={ctx}
              renderItem={renderItem}
              onDragState={onDragState}
              onCommit={onCommit}
            />
          ))}
        </View>
      )}
      {footer}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  row: { position: 'absolute', top: 0, left: 0, right: 0, height: ROW_HEIGHT },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  layer: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  handle: { width: HANDLE_SIZE, height: HANDLE_SIZE, marginRight: 4, alignItems: 'center', justifyContent: 'center' },
});
