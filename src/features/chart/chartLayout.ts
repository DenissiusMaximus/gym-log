// Turns a series and a period into drawable geometry (pixels). Pure, so it can be unit tested.
import { formatWeight } from '../../lib/format';
import {
  dayNumber,
  gapFlags,
  linearScale,
  newHighFlags,
  placeLabels,
  xTicks,
  yDomain,
  type ChartPeriod,
  type ChartPoint,
  type PeriodView,
  type PlacedLabel,
} from './chartMath';

export const CHART_HEIGHT = 240;
/** Width of the right-hand strip that holds the Y axis labels. */
export const Y_GUTTER = 36;
const MARGIN = 16;
/** Room above the plane for value labels of the highest points. */
const TOP = 24;
/** Room under the plane for the X axis labels. */
const BOTTOM = 28;
/**
 * Inner padding of the plane: the markers of the first/last/highest points (ring radius 7.5)
 * must fit inside it instead of being cut by the plane edge. Lines still clip at the plane edge.
 */
export const PAD_X = 8;
export const PAD_Y = 8;
/** More visible points than this and the ordinary markers shrink to avoid a chain of dots. */
export const DENSE_POINTS = 25;

export type Plot = { left: number; right: number; top: number; bottom: number };

export type ChartDot = {
  /** Index into the full series. */
  index: number;
  x: number;
  y: number;
  newHigh: boolean;
};

export type ChartPath = { d: string; dashed: boolean };

export type ChartModel = {
  width: number;
  height: number;
  plot: Plot;
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  dots: ChartDot[];
  /** Lines between points, the incoming segment from before the period included. */
  paths: ChartPath[];
  labels: (PlacedLabel & { y: number })[];
  /** 3.5 normally, 2 when more than 25 points are visible (see `dense`). */
  markerRadius: number;
  /** Dense mode: ordinary markers are small and have no outline; new highs stay large. */
  dense: boolean;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Polylines: consecutive normal segments share a path, every gap segment is a separate dashed path. */
function buildPaths(coords: { x: number; y: number }[], gaps: boolean[]): ChartPath[] {
  const paths: ChartPath[] = [];
  let run = '';
  const flush = () => {
    if (run) paths.push({ d: run, dashed: false });
    run = '';
  };
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    if (gaps[i]) {
      flush();
      paths.push({ d: `M${r1(a.x)} ${r1(a.y)}L${r1(b.x)} ${r1(b.y)}`, dashed: true });
    } else {
      run += run ? `L${r1(b.x)} ${r1(b.y)}` : `M${r1(a.x)} ${r1(a.y)}L${r1(b.x)} ${r1(b.y)}`;
    }
  }
  flush();
  return paths;
}

/** Geometry of the chart for the visible part of `series`. `view.from < view.to` is required. */
export function buildChartModel(
  series: readonly ChartPoint[],
  view: PeriodView,
  period: ChartPeriod,
  width: number,
  height: number = CHART_HEIGHT,
): ChartModel {
  const plot: Plot = { left: MARGIN, right: Math.max(MARGIN + 1, width - Y_GUTTER), top: TOP, bottom: height - BOTTOM };
  const visible = series.slice(view.from, view.to);
  const single = series.length === 1;

  // One point: the marker sits in the middle and there is no time axis to read.
  const domain = yDomain(visible.map((p) => p.avg));
  const y = linearScale(domain.lo, domain.hi, plot.bottom - PAD_Y, plot.top + PAD_Y);
  const startDay = dayNumber(view.start);
  const endDay = dayNumber(view.end);
  const x = single
    ? () => (plot.left + plot.right) / 2
    : linearScale(startDay, endDay, plot.left + PAD_X, plot.right - PAD_X);

  const highs = newHighFlags(series);
  const gaps = gapFlags(series);

  const dots: ChartDot[] = visible.map((p, i) => ({
    index: view.from + i,
    x: x(dayNumber(p.date)),
    y: y(p.avg),
    newHigh: highs[view.from + i],
  }));

  const chainFrom = view.prev >= 0 ? view.prev : view.from;
  const chain = series.slice(chainFrom, view.to).map((p) => ({ x: x(dayNumber(p.date)), y: y(p.avg) }));
  const chainGaps = gaps.slice(chainFrom, view.to);
  const paths = buildPaths(chain, chainGaps);

  const dense = visible.length > DENSE_POINTS;
  const markerRadius = dense ? 2 : 3.5;

  const labels = placeLabels({
    xs: dots.map((d) => d.x),
    values: visible.map((p) => p.avg),
    left: plot.left,
    right: plot.right,
  }).map((label) => ({ ...label, y: dots[label.index].y }));

  return {
    width,
    height,
    plot,
    yTicks: domain.ticks.map((value) => ({ y: y(value), label: formatWeight(value) })),
    xTicks: single
      ? []
      : xTicks(period, view.start, view.end).map((tick) => ({ x: x(dayNumber(tick.date)), label: tick.label })),
    dots,
    paths,
    labels,
    markerRadius,
    dense,
  };
}
