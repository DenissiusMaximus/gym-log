import { WEEKDAYS_SHORT, formatShortDate, parseDate, weekdayIndex } from '../../lib/date';
import { formatWeight } from '../../lib/format';
import { strings } from '../../lib/strings';

export type HeaderLabel = {
  /** "21.10"; null for a workout without a date. */
  date: string | null;
  /** Weekday, or the year when it differs from the current one; null without a date. */
  sub: string | null;
};

/** Header texts of a column. `today` decides whether the year replaces the weekday. */
export function headerLabel(date: string | null, today: string): HeaderLabel {
  if (date === null) return { date: null, sub: null };
  const parts = parseDate(date);
  const current = parseDate(today);
  if (!parts) return { date: null, sub: null };
  const sameYear = current !== null && current.year === parts.year;
  return {
    date: `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}`,
    sub: sameYear ? WEEKDAYS_SHORT[weekdayIndex(date)] : String(parts.year),
  };
}

/** Number shown in a cell and how many dots go under it. */
export type Dots = { dots: number; plus: boolean };

/** Dots under the number: one per set up to 4; from 5 sets - 3 dots and "+". One set: none. */
export function dotsFor(setCount: number): Dots {
  if (setCount <= 1) return { dots: 0, plus: false };
  if (setCount <= 4) return { dots: setCount, plus: false };
  return { dots: 3, plus: true };
}

/** Spoken label: "Bench press, 24 Oct: 45 kg, 3 sets". */
export function cellLabel(name: string, date: string | null, weights: number[] | undefined): string {
  const when = date === null ? strings.table.noDate : formatShortDate(date);
  if (!weights || weights.length === 0) return `${name}, ${when}: ${strings.table.empty}`;
  const value = `${formatWeight(Math.max(...weights))} kg`;
  return weights.length === 1
    ? `${name}, ${when}: ${value}`
    : `${name}, ${when}: ${value}, ${weights.length} sets`;
}
