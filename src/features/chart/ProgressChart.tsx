import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Svg, { ClipPath, Circle, Defs, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import * as haptics from '../../lib/haptics';
import { strings } from '../../lib/strings';
import { useTheme } from '../../theme/ThemeProvider';
import { fontFamily } from '../../theme/tokens';
import { Text } from '../../ui/Text';
import { buildChartModel, CHART_HEIGHT, type ChartModel } from './chartLayout';
import { nearestIndex, type ChartPeriod, type ChartPoint, type PeriodView } from './chartMath';
import { chartLabel } from './labels';

type Props = {
  series: readonly ChartPoint[];
  view: PeriodView;
  period: ChartPeriod;
  /** Index into `series` of the point under the cursor, or null. */
  selected: number | null;
  onSelect: (index: number) => void;
  /** A touch started on the plane; the screen uses it to tell "outside the chart" taps apart. */
  onPlaneTouch?: () => void;
};

const s = strings.chart;
const CLIP_ID = 'gym-chart-clip';
/** Radius of the marker of a new high, and of the ring in the surface color around it. */
const HIGH_R = 5.5;
const HIGH_RING = 7.5;
const SELECTED_R = 6;
const LABEL_SIZE = 11;

// The plane owns horizontal drags; the browser keeps vertical ones for scrolling the page.
const planeWebStyle = Platform.select<ViewStyle>({
  web: { touchAction: 'pan-y', userSelect: 'none', cursor: 'crosshair' } as ViewStyle,
  default: {},
});

type LayerProps = { model: ChartModel };

/** Lines, axes, markers and labels. Memoized: moving the cursor never repaints this layer. */
const StaticLayer = memo(function StaticLayer({ model }: LayerProps) {
  const { colors } = useTheme();
  const { plot, width, height } = model;
  return (
    <Svg width={width} height={height} style={styles.layer}>
      <Defs>
        <ClipPath id={CLIP_ID}>
          <Rect x={plot.left} y={plot.top - 3} width={plot.right - plot.left} height={plot.bottom - plot.top + 6} />
        </ClipPath>
      </Defs>

      {model.yTicks.map((tick) => (
        <G key={tick.label}>
          <Line
            x1={plot.left}
            x2={plot.right}
            y1={tick.y}
            y2={tick.y}
            stroke={colors.outlineVariant}
            strokeWidth={1}
          />
          <SvgText
            x={width - 6}
            y={tick.y + 4}
            textAnchor="end"
            fontSize={LABEL_SIZE}
            fontFamily={fontFamily.medium}
            fill={colors.onSurfaceVariant}
          >
            {tick.label}
          </SvgText>
        </G>
      ))}

      {model.xTicks.map((tick) => (
        <SvgText
          key={tick.label + tick.x}
          x={Math.min(Math.max(tick.x, plot.left + 14), plot.right - 14)}
          y={plot.bottom + 18}
          textAnchor="middle"
          fontSize={LABEL_SIZE}
          fontFamily={fontFamily.medium}
          fill={colors.onSurfaceVariant}
        >
          {tick.label}
        </SvgText>
      ))}

      <G clipPath={`url(#${CLIP_ID})`}>
        {model.paths.map((path, i) => (
          <Path
            key={i}
            d={path.d}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={path.dashed ? '4 4' : undefined}
          />
        ))}
      </G>

      {model.dots.map((dot) =>
        dot.newHigh ? (
          <G key={dot.index}>
            <Circle cx={dot.x} cy={dot.y} r={HIGH_RING} fill={colors.surface} />
            <Circle cx={dot.x} cy={dot.y} r={HIGH_R} fill={colors.primary} />
          </G>
        ) : (
          <Circle
            key={dot.index}
            cx={dot.x}
            cy={dot.y}
            r={model.markerRadius}
            fill={colors.primary}
            stroke={colors.surface}
            strokeWidth={model.dense ? 0 : 1.5}
          />
        ),
      )}

      {model.labels.map((label) => (
        <SvgText
          key={label.index}
          x={label.left + label.width / 2}
          y={label.y - 11}
          textAnchor="middle"
          fontSize={LABEL_SIZE}
          fontFamily={fontFamily.medium}
          fill={colors.onSurface}
        >
          {label.text}
        </SvgText>
      ))}
    </Svg>
  );
});

type CursorProps = { model: ChartModel; selected: number | null };

/** Vertical line and the enlarged marker of the selected point. */
function CursorLayer({ model, selected }: CursorProps) {
  const { colors } = useTheme();
  const dot = selected === null ? undefined : model.dots.find((d) => d.index === selected);
  if (!dot) return null;
  return (
    <Svg width={model.width} height={model.height} style={styles.layer}>
      <Line x1={dot.x} x2={dot.x} y1={model.plot.top} y2={model.plot.bottom} stroke={colors.outline} strokeWidth={1} />
      <Circle cx={dot.x} cy={dot.y} r={SELECTED_R} fill={colors.primary} stroke={colors.surface} strokeWidth={2} />
    </Svg>
  );
}

/** Legend sample of the marker of a new high. */
function HighSample() {
  const { colors } = useTheme();
  return (
    <Svg width={16} height={16} accessible={false}>
      <Circle cx={8} cy={8} r={7.5} fill={colors.surface} />
      <Circle cx={8} cy={8} r={5.5} fill={colors.primary} />
    </Svg>
  );
}

/**
 * Line chart of one exercise drawn with SVG: a real time axis ending at the right edge of the
 * period, the value axis on the right, new highs as bigger markers, dashed lines over gaps longer
 * than 4 weeks. Touch or drag on the plane picks the nearest point.
 */
export function ProgressChart({ series, view, period, selected, onSelect, onPlaneTouch }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

  const model = useMemo(
    () => (width > 0 ? buildChartModel(series, view, period, width) : null),
    [series, view, period, width],
  );

  // The gesture callbacks are created once; they read the latest model and handlers from refs.
  const dotsRef = useRef<ChartModel['dots']>([]);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const onTouchRef = useRef(onPlaneTouch);
  useEffect(() => {
    dotsRef.current = model?.dots ?? [];
    selectedRef.current = selected;
    onSelectRef.current = onSelect;
    onTouchRef.current = onPlaneTouch;
  });

  const selectAt = useCallback((x: number) => {
    const dots = dotsRef.current;
    const at = nearestIndex(
      dots.map((d) => d.x),
      x,
    );
    if (at < 0) return;
    const index = dots[at].index;
    if (index === selectedRef.current) return;
    selectedRef.current = index;
    haptics.dragStep();
    onSelectRef.current(index);
  }, []);

  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-8, 8],
    failOffsetY: [-12, 12],
    onActivate: (event) => selectAt(event.x),
    onUpdate: (event) => selectAt(event.x),
  });
  const tap = useTapGesture({
    runOnJS: true,
    maxDistance: 10,
    onActivate: (event) => selectAt(event.x),
  });
  const gesture = useCompetingGestures(pan, tap);

  const visible = useMemo(() => series.slice(view.from, view.to), [series, view]);
  const description = useMemo(() => chartLabel(visible), [visible]);

  const markTouch = useCallback(() => {
    onTouchRef.current?.();
    return false;
  }, []);

  const hasHigh = model?.dots.some((d) => d.newHigh) ?? false;
  const dataSet = { selectedIndex: selected ?? '', visibleCount: visible.length };

  return (
    <View>
      <View onLayout={onLayout} style={styles.frame}>
        {model ? (
          <GestureDetector gesture={gesture} touchAction="pan-y">
            <View
              testID="chart-plane"
              accessible
              accessibilityRole="image"
              accessibilityLabel={description}
              accessibilityHint={s.plane}
              onStartShouldSetResponderCapture={markTouch}
              style={[styles.plane, { height: CHART_HEIGHT }, planeWebStyle]}
              {...({ dataSet } as object)}
            >
              <StaticLayer model={model} />
              <CursorLayer model={model} selected={selected} />
            </View>
          </GestureDetector>
        ) : (
          <View style={{ height: CHART_HEIGHT }} />
        )}
      </View>
      <View style={styles.legend}>
        {hasHigh ? (
          <View style={styles.legendItem} testID="chart-legend">
            <HighSample />
            <Text variant="labelSmall" color="onSurfaceVariant">
              {s.newHigh}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%' },
  plane: { width: '100%', overflow: 'hidden' },
  // The layers stack on top of each other and never take touches themselves.
  layer: { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' },
  legend: { height: 24, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'flex-start' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
