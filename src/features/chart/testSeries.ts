import { addDays } from '../../lib/date';
import type { ChartPoint } from './chartMath';

// Builders for chart tests.
/** A point from the sets of one day. */
export const pt = (date: string, ...weights: number[]): ChartPoint => ({
  date,
  weights,
  avg: weights.reduce((a, b) => a + b, 0) / weights.length,
  max: Math.max(...weights),
});

/** `count` points every `step` days ending on `end`, values taken from `values` in turn. */
export function make(count: number, end: string, step: number, values: number[]): ChartPoint[] {
  return Array.from({ length: count }, (_, i) => pt(addDays(end, -(count - 1 - i) * step), values[i % values.length]));
}
