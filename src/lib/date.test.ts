import {
  addDays,
  diffDays,
  formatColumnDate,
  formatDate,
  formatFullDate,
  formatLongDate,
  formatMonthTitle,
  formatShortDate,
  isValidDate,
  parseDate,
  todayStr,
  weekdayIndex,
} from './date';

describe('parseDate / formatDate', () => {
  it('round-trips a valid date', () => {
    expect(formatDate(parseDate('2026-11-12')!)).toBe('2026-11-12');
  });

  it('rejects malformed and non-existent dates', () => {
    expect(parseDate('2026-1-2')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('2026-02-29')).toBeNull();
    expect(parseDate('2026-04-31')).toBeNull();
    expect(isValidDate('abc')).toBe(false);
  });

  it('accepts a leap day', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2100-02-29')).toBe(false);
  });
});

describe('todayStr', () => {
  it('uses local date parts', () => {
    expect(todayStr(new Date(2026, 10, 14, 23, 59))).toBe('2026-11-14');
    expect(todayStr(new Date(2027, 0, 1, 0, 1))).toBe('2027-01-01');
  });
});

describe('arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('computes differences', () => {
    expect(diffDays('2026-10-21', '2026-11-12')).toBe(22);
    expect(diffDays('2026-11-12', '2026-10-21')).toBe(-22);
    expect(diffDays('2026-05-05', '2026-05-05')).toBe(0);
  });

  it('computes Monday-based weekday index', () => {
    expect(weekdayIndex('2026-11-12')).toBe(3); // Thursday
    expect(weekdayIndex('2026-11-09')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-15')).toBe(6); // Sunday
  });
});

describe('formatting', () => {
  it('formats the column header as DD.MM', () => {
    expect(formatColumnDate('2026-10-21')).toBe('21.10');
    expect(formatColumnDate('2026-03-05')).toBe('05.03');
  });

  it('formats the long date', () => {
    expect(formatLongDate('2026-11-12')).toBe('Thu, 12 Nov 2026');
  });

  it('formats the short date', () => {
    expect(formatShortDate('2026-11-12')).toBe('12 Nov');
    expect(formatShortDate('2026-03-05')).toBe('5 Mar');
  });

  it('formats the full numeric date and month title', () => {
    expect(formatFullDate('2026-10-21')).toBe('21.10.2026');
    expect(formatMonthTitle(2026, 11)).toBe('November 2026');
  });
});
