// Texts of the chart screen that are built from data.
import { diffDays, formatLongDate, formatShortDate } from '../../lib/date';
import { formatWeight } from '../../lib/format';
import { countLabel } from '../../lib/plural';
import { strings } from '../../lib/strings';
import type { ChartPoint } from './chartMath';

const s = strings.chart;

/** "today", "yesterday", "5 days ago"; a date in the future reads "in 3 days". */
export function relativeDay(date: string, today: string): string {
  const days = diffDays(date, today);
  if (days === 0) return s.today;
  if (days === 1) return s.yesterday;
  if (days < 0) return s.inDays(-days);
  return s.daysAgo(days);
}

/** "+5", "-2.5", "0": a signed difference without the unit. */
export function signed(delta: number): string {
  const text = formatWeight(Math.abs(delta));
  if (text === '0') return '0';
  return `${delta > 0 ? '+' : '-'}${text}`;
}

/** "40 / 42.5 / 45" */
export function setsText(weights: readonly number[]): string {
  return weights.map(formatWeight).join(' / ');
}

/** Value of a point: the average of its sets, written "avg 42.5" when there are several. */
export function pointValue(point: ChartPoint): { prefix: string | null; value: string } {
  return { prefix: point.weights.length > 1 ? s.avg : null, value: formatWeight(point.avg) };
}

/** Spoken description of the plane for the visible points. */
export function chartLabel(points: readonly ChartPoint[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return s.chartLabel(
    countLabel(points.length, 'workout', 'workouts'),
    formatShortDate(first.date),
    formatShortDate(last.date),
    formatWeight(first.avg),
    formatWeight(last.avg),
  );
}

/** One history row in words: "Thu, 12 Nov 2026: 45 kg" or with sets and the average. */
export function historyLabel(point: ChartPoint): string {
  const date = formatLongDate(point.date);
  if (point.weights.length === 1) return `${date}: ${formatWeight(point.avg)} ${s.unit}`;
  return `${date}: ${s.sets(setsText(point.weights))}, ${s.avg} ${formatWeight(point.avg)} ${s.unit}`;
}
