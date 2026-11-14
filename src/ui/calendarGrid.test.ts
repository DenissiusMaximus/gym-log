import { buildMonthGrid, GRID_CELLS, shiftMonth } from './calendarGrid';

describe('buildMonthGrid', () => {
  it('always has 6 weeks of 7 days', () => {
    expect(buildMonthGrid(2026, 11)).toHaveLength(GRID_CELLS);
    expect(buildMonthGrid(2026, 2)).toHaveLength(GRID_CELLS);
  });

  it('starts weeks on Monday', () => {
    // 1 Nov 2026 is a Sunday, so the grid starts on Monday 26 Oct.
    const grid = buildMonthGrid(2026, 11);
    expect(grid[0]).toEqual({ date: '2026-10-26', day: 26, inMonth: false });
    expect(grid[6]).toEqual({ date: '2026-11-01', day: 1, inMonth: true });
  });

  it('starts at day 1 when the month begins on Monday', () => {
    // 1 Jun 2026 is a Monday.
    const grid = buildMonthGrid(2026, 6);
    expect(grid[0]).toEqual({ date: '2026-06-01', day: 1, inMonth: true });
  });

  it('marks exactly the days of the month as in-month', () => {
    const grid = buildMonthGrid(2026, 11);
    const inMonth = grid.filter((cell) => cell.inMonth);
    expect(inMonth).toHaveLength(30);
    expect(inMonth[0].date).toBe('2026-11-01');
    expect(inMonth[29].date).toBe('2026-11-30');
  });

  it('handles a leap February', () => {
    expect(buildMonthGrid(2024, 2).filter((cell) => cell.inMonth)).toHaveLength(29);
    expect(buildMonthGrid(2026, 2).filter((cell) => cell.inMonth)).toHaveLength(28);
    expect(buildMonthGrid(2100, 2).filter((cell) => cell.inMonth)).toHaveLength(28);
  });

  it('crosses year boundaries on both sides', () => {
    // 1 Jan 2027 is a Friday.
    const january = buildMonthGrid(2027, 1);
    expect(january[0].date).toBe('2026-12-28');
    expect(january[0].inMonth).toBe(false);
    const december = buildMonthGrid(2026, 12);
    expect(december[0].date).toBe('2026-11-30');
    expect(december[GRID_CELLS - 1].date).toBe('2027-01-10');
  });

  it('has consecutive dates without gaps', () => {
    const grid = buildMonthGrid(2026, 3);
    for (let i = 1; i < grid.length; i++) {
      const prev = new Date(`${grid[i - 1].date}T00:00:00Z`).getTime();
      const next = new Date(`${grid[i].date}T00:00:00Z`).getTime();
      expect(next - prev).toBe(24 * 60 * 60 * 1000);
    }
  });
});

describe('shiftMonth', () => {
  it('moves within a year', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2026, month: 12 });
    expect(shiftMonth(2026, 11, -1)).toEqual({ year: 2026, month: 10 });
  });

  it('wraps across years', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 1, -13)).toEqual({ year: 2024, month: 12 });
  });
});
