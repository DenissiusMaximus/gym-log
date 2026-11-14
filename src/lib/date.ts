// Dates are stored as local-time `YYYY-MM-DD` strings. Names are hand-written
// (no Intl) so output is identical on every platform and JS engine.

export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Week starts on Monday: index 0 = Monday. */
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type DateParts = { year: number; month: number; day: number };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Formats parts as `YYYY-MM-DD`. `month` is 1-12. */
export function formatDate({ year, month, day }: DateParts): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** Parses `YYYY-MM-DD`; returns null for malformed or non-existent dates. */
export function parseDate(value: string): DateParts | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidDate(value: string): boolean {
  return parseDate(value) !== null;
}

/** Today in the device's local time zone. */
export function todayStr(now: Date = new Date()): string {
  return formatDate({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}

/** Days since 1970-01-01 (proleptic Gregorian), independent of time zone and DST. */
export function toDayNumber({ year, month, day }: DateParts): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function fromDayNumber(days: number): DateParts {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

/** Adds (or subtracts) whole days to a `YYYY-MM-DD` string. */
export function addDays(value: string, days: number): string {
  const parts = parseDate(value);
  if (!parts) throw new Error(`Invalid date: ${value}`);
  return formatDate(fromDayNumber(toDayNumber(parts) + days));
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: string, b: string): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  if (!pa || !pb) throw new Error(`Invalid date: ${a} / ${b}`);
  return toDayNumber(pb) - toDayNumber(pa);
}

/** Weekday index with Monday = 0 ... Sunday = 6. */
export function weekdayIndex(value: string): number {
  const parts = parseDate(value);
  if (!parts) throw new Error(`Invalid date: ${value}`);
  // 1970-01-01 was a Thursday (index 3 with Monday = 0).
  return (((toDayNumber(parts) + 3) % 7) + 7) % 7;
}

/** Column header: "21.10" (day.month, two digits each). */
export function formatColumnDate(value: string): string {
  const parts = parseDate(value);
  if (!parts) throw new Error(`Invalid date: ${value}`);
  return `${pad2(parts.day)}.${pad2(parts.month)}`;
}

/** Long form: "Thu, 12 Nov 2026". */
export function formatLongDate(value: string): string {
  const parts = parseDate(value);
  if (!parts) throw new Error(`Invalid date: ${value}`);
  return `${WEEKDAYS_SHORT[weekdayIndex(value)]}, ${parts.day} ${MONTHS_SHORT[parts.month - 1]} ${parts.year}`;
}

/** Short form: "12 Nov". */
export function formatShortDate(value: string): string {
  const parts = parseDate(value);
  if (!parts) throw new Error(`Invalid date: ${value}`);
  return `${parts.day} ${MONTHS_SHORT[parts.month - 1]}`;
}

/** Full form with numeric parts: "21.10.2026". */
export function formatFullDate(value: string): string {
  const parts = parseDate(value);
  if (!parts) throw new Error(`Invalid date: ${value}`);
  return `${pad2(parts.day)}.${pad2(parts.month)}.${parts.year}`;
}

/** Calendar header: "November 2026". `month` is 1-12. */
export function formatMonthTitle(year: number, month: number): string {
  return `${MONTHS_LONG[month - 1]} ${year}`;
}
