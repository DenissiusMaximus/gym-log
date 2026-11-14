import { addDays, formatDate, weekdayIndex } from '../lib/date';

export type GridCell = {
  /** `YYYY-MM-DD`. */
  date: string;
  day: number;
  /** False for the leading and trailing days of the neighbouring months. */
  inMonth: boolean;
};

export const GRID_WEEKS = 6;
export const GRID_CELLS = GRID_WEEKS * 7;

/** 6 weeks x 7 days of a month, weeks start on Monday. `month` is 1-12. */
export function buildMonthGrid(year: number, month: number): GridCell[] {
  const first = formatDate({ year, month, day: 1 });
  const start = addDays(first, -weekdayIndex(first));
  const cells: GridCell[] = [];
  for (let i = 0; i < GRID_CELLS; i++) {
    const date = addDays(start, i);
    cells.push({ date, day: Number(date.slice(8, 10)), inMonth: Number(date.slice(5, 7)) === month });
  }
  return cells;
}

/** Moves a month by `delta` months across year boundaries. `month` is 1-12. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
