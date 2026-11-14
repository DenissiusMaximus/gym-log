// Pure chart math: scales, ticks, periods, records, plateaus, gaps and value labels.
// Nothing here touches React, so it is covered by plain unit tests.
import {
  MONTHS_SHORT,
  addDays,
  diffDays,
  formatDate,
  formatShortDate,
  parseDate,
  toDayNumber,
  weekdayIndex,
} from '../../lib/date';
import { formatWeight } from '../../lib/format';

export type ChartPeriod = '1M' | '3M' | '6M' | '1Y' | 'All';

/** The part of a series point the chart needs. */
export type ChartPoint = { date: string; avg: number; max: number; weights: number[] };

export const PERIODS: readonly ChartPeriod[] = ['1M', '3M', '6M', '1Y', 'All'];

const PERIOD_DAYS: Record<Exclude<ChartPeriod, 'All'>, number> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365 };

/** "All" never spans fewer days than this, so a young series does not stretch over the whole plane. */
export const MIN_ALL_DAYS = 14;
/** A segment between points further apart than this is drawn dashed. */
export const GAP_DAYS = 28;
/** Up to this many visible points every point gets a value label. */
export const LABEL_ALL_MAX = 6;
const MAX_X_TICKS = 5;
const EPS = 1e-9;

const dayOf = (date: string): number => {
  const parts = parseDate(date);
  if (!parts) throw new Error(`Invalid date: ${date}`);
  return toDayNumber(parts);
};

/** Day number (days since 1970-01-01) of a `YYYY-MM-DD` string. */
export const dayNumber = dayOf;

/** Linear map from a domain to a range; a zero-width domain maps to the range middle. */
export function linearScale(d0: number, d1: number, r0: number, r1: number): (value: number) => number {
  if (d1 === d0) return () => (r0 + r1) / 2;
  const k = (r1 - r0) / (d1 - d0);
  return (value) => r0 + (value - d0) * k;
}

// ---------------------------------------------------------------------------------------------
// Y axis

export type YDomain = { lo: number; hi: number; ticks: number[] };

const MIN_TICKS = 3;
const MAX_TICKS = 5;

const STEPS = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

const clean = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * Tick values and the domain they span for data in [min, max]. The step comes from
 * 1, 2, 2.5, 5, 10, 20, 25, 50 (and their decades); the domain runs from the nearest tick under
 * the minimum to the nearest tick over the maximum, 3 to 5 ticks, never under 0.
 */
export function niceTicks(min: number, max: number): YDomain {
  const low = Math.max(0, Math.min(min, max));
  const high = Math.max(min, max);
  let chosen = STEPS[STEPS.length - 1];
  for (const step of STEPS) {
    const lo = Math.max(0, Math.floor(low / step + EPS) * step);
    const hi = Math.ceil(high / step - EPS) * step;
    if (Math.round((hi - lo) / step) + 1 <= MAX_TICKS) {
      chosen = step;
      break;
    }
  }
  let lo = Math.max(0, Math.floor(low / chosen + EPS) * chosen);
  let hi = Math.ceil(high / chosen - EPS) * chosen;
  // Fewer than 3 ticks: widen alternately upwards and downwards (downwards only while above 0).
  let count = Math.round((hi - lo) / chosen) + 1;
  let up = true;
  while (count < MIN_TICKS) {
    if (up || lo - chosen < 0) hi += chosen;
    else lo -= chosen;
    up = !up;
    count++;
  }
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) ticks.push(clean(lo + i * chosen));
  return { lo: ticks[0], hi: ticks[ticks.length - 1], ticks };
}

/**
 * Y domain for the plotted values. Not anchored at zero. All values equal: the value +/- 5
 * (+/- 2.5 under 10); the lower bound never goes under 0. No values: a neutral 0-10 axis.
 */
export function yDomain(values: readonly number[]): YDomain {
  if (values.length === 0) return niceTicks(0, 10);
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max - min < EPS) {
    const pad = min < 10 ? 2.5 : 5;
    return niceTicks(Math.max(0, min - pad), max + pad);
  }
  return niceTicks(min, max);
}

// ---------------------------------------------------------------------------------------------
// Period

export type PeriodView = {
  /** Left edge of the plane, `YYYY-MM-DD`. */
  start: string;
  /** Right edge: today (or the last point when that one lies in the future). */
  end: string;
  /** Visible points are `series[from]` .. `series[to - 1]`; `from === to` means none. */
  from: number;
  to: number;
  /** Index of the point just before the period (for the incoming segment), or -1. */
  prev: number;
};

/** Window of the period counted back from today; "All" runs from the first point. */
export function filterPeriod(series: readonly { date: string }[], period: ChartPeriod, today: string): PeriodView {
  const last = series.length > 0 ? series[series.length - 1].date : today;
  const end = last > today ? last : today;
  let start: string;
  if (period === 'All') {
    const first = series.length > 0 ? series[0].date : today;
    const floor = addDays(end, -MIN_ALL_DAYS);
    start = first < floor ? first : floor;
  } else {
    start = addDays(end, -PERIOD_DAYS[period]);
  }
  let from = series.length;
  for (let i = 0; i < series.length; i++) {
    if (series[i].date >= start) {
      from = i;
      break;
    }
  }
  return { start, end, from, to: series.length, prev: from - 1 };
}

/** Default period: 3M when the last 91 days hold at least 2 points, otherwise All. */
export function defaultPeriod(series: readonly { date: string }[], today: string): ChartPeriod {
  const view = filterPeriod(series, '3M', today);
  return view.to - view.from >= 2 ? '3M' : 'All';
}

// ---------------------------------------------------------------------------------------------
// X axis

export type XTick = { date: string; label: string };

/** First days of the months inside [start, end]. */
function monthStarts(start: string, end: string): { year: number; month: number }[] {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return [];
  const out: { year: number; month: number }[] = [];
  let year = s.year;
  let month = s.month;
  if (s.day > 1) {
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  while (year < e.year || (year === e.year && month <= e.month)) {
    out.push({ year, month });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
}

function mondays(start: string, end: string): string[] {
  const offset = (7 - weekdayIndex(start)) % 7;
  const out: string[] = [];
  for (let d = addDays(start, offset); d <= end; d = addDays(d, 7)) out.push(d);
  return out;
}

function everyNth<T>(items: T[], n: number): T[] {
  return items.filter((_, i) => i % n === 0);
}

/**
 * Up to 5 labelled ticks on the time axis. 1M (and a short "All"): Mondays, "3 Nov". Longer
 * windows: month starts "Oct", aligned to every 1st, 2nd, 3rd or 6th month so they land on
 * quarters and half-years; beyond that, years. A span over a year adds the year to month labels.
 */
export function xTicks(period: ChartPeriod, start: string, end: string): XTick[] {
  const span = diffDays(start, end);
  if (period === '1M' || (period === 'All' && span <= 35)) {
    let days = mondays(start, end);
    if (days.length > MAX_X_TICKS) days = everyNth(days, Math.ceil(days.length / MAX_X_TICKS));
    return days.map((date) => ({ date, label: formatShortDate(date) }));
  }

  const months = monthStarts(start, end);
  const withYear = span > 400;
  for (const step of [1, 2, 3, 6]) {
    const picked = months.filter((m) => (m.month - 1) % step === 0);
    if (picked.length <= MAX_X_TICKS) {
      return picked.map(({ year, month }) => ({
        date: formatDate({ year, month, day: 1 }),
        label: withYear ? `${MONTHS_SHORT[month - 1]} '${String(year % 100).padStart(2, '0')}` : MONTHS_SHORT[month - 1],
      }));
    }
  }

  const years = months.filter((m) => m.month === 1);
  for (const step of [1, 2, 5, 10, 20, 50]) {
    const picked = years.filter((m) => m.year % step === 0);
    if (picked.length <= MAX_X_TICKS) {
      return picked.map(({ year }) => ({ date: formatDate({ year, month: 1, day: 1 }), label: String(year) }));
    }
  }
  return [];
}

// ---------------------------------------------------------------------------------------------
// Records, plateaus, gaps

export type RecordInfo = { value: number; date: string; index: number };

/** Heaviest single set of all time and the first day it was reached; null for an empty series. */
export function record(series: readonly ChartPoint[]): RecordInfo | null {
  let best: RecordInfo | null = null;
  series.forEach((point, index) => {
    if (best === null || point.max > best.value + EPS) best = { value: point.max, date: point.date, index };
  });
  return best;
}

/** True for each point whose value is strictly above every earlier point (the first one is not). */
export function newHighFlags(series: readonly ChartPoint[]): boolean[] {
  let top = -Infinity;
  return series.map((point, i) => {
    const high = i > 0 && point.avg > top + EPS;
    if (point.avg > top) top = point.avg;
    return high;
  });
}

/** For each point: is the segment from the previous point longer than 28 days. */
export function gapFlags(series: readonly { date: string }[], maxDays: number = GAP_DAYS): boolean[] {
  return series.map((point, i) => i > 0 && diffDays(series[i - 1].date, point.date) > maxDays);
}

export type PlateauInfo = {
  /** Workouts in a row on the current value (1 when the last point differs from the one before). */
  count: number;
  /** Date of the first workout of the run. */
  since: string;
  value: number;
  /** The last point differs from the previous one. */
  isNew: boolean;
};

/** Current run of equal values at the end of the series; null for an empty series. */
export function plateau(series: readonly ChartPoint[]): PlateauInfo | null {
  if (series.length === 0) return null;
  const last = series[series.length - 1];
  let i = series.length - 1;
  while (i > 0 && Math.abs(series[i - 1].avg - last.avg) < EPS) i--;
  const count = series.length - i;
  return { count, since: series[i].date, value: last.avg, isNew: count === 1 && series.length > 1 };
}

export type PeriodChange = {
  from: number;
  to: number;
  delta: number;
  days: number;
};

/** First-to-last difference of the visible points; null with fewer than two. */
export function periodChange(points: readonly ChartPoint[]): PeriodChange | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return { from: first.avg, to: last.avg, delta: last.avg - first.avg, days: diffDays(first.date, last.date) };
}

/** Index of the position nearest to `x` (positions ascending); -1 when there are none. */
export function nearestIndex(xs: readonly number[], x: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && x - xs[lo - 1] <= xs[lo] - x) return lo - 1;
  return lo;
}

// ---------------------------------------------------------------------------------------------
// Value labels

export type LabelInput = {
  /** Point x positions (px) of the visible points, ascending. */
  xs: readonly number[];
  /** Point values of the visible points. */
  values: readonly number[];
  left: number;
  right: number;
};

export type PlacedLabel = {
  /** Index into the visible points. */
  index: number;
  text: string;
  /** Left edge and width of the label box (px), already shifted into the plane. */
  left: number;
  width: number;
};

const CHAR_WIDTH = 6.4;
const LABEL_PAD = 2;

/** Rough width of a label-small number. */
export const labelWidth = (text: string): number => text.length * CHAR_WIDTH + LABEL_PAD;

/**
 * Which points get a value label and where. With up to 6 visible points all of them are labelled;
 * with more, only the last point and the highest one. Labels are shifted inward at the plane edges
 * and a label that would touch a more important one is dropped (priority: last, highest, then
 * the most recent).
 */
export function placeLabels({ xs, values, left, right }: LabelInput): PlacedLabel[] {
  const n = xs.length;
  if (n === 0) return [];
  let top = 0;
  for (let i = 1; i < n; i++) if (values[i] > values[top] + EPS) top = i;

  const wanted: number[] = [];
  if (n <= LABEL_ALL_MAX) {
    for (let i = 0; i < n; i++) wanted.push(i);
  } else {
    wanted.push(n - 1);
    if (top !== n - 1) wanted.push(top);
  }
  const priority = (i: number) => (i === n - 1 ? 0 : i === top ? 1 : 2 + (n - 1 - i));
  wanted.sort((a, b) => priority(a) - priority(b));

  const placed: PlacedLabel[] = [];
  for (const index of wanted) {
    const text = formatWeight(values[index]);
    const width = labelWidth(text);
    const boxLeft = Math.min(Math.max(xs[index] - width / 2, left), Math.max(left, right - width));
    const clash = placed.some((p) => boxLeft < p.left + p.width + 2 && p.left < boxLeft + width + 2);
    if (!clash) placed.push({ index, text, left: boxLeft, width });
  }
  return placed.sort((a, b) => a.index - b.index);
}
