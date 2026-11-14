import { addDays } from '../../lib/date';
import {
  defaultPeriod,
  filterPeriod,
  gapFlags,
  labelWidth,
  linearScale,
  nearestIndex,
  newHighFlags,
  niceTicks,
  periodChange,
  placeLabels,
  plateau,
  record,
  xTicks,
  yDomain,
} from './chartMath';
import { make, pt } from './testSeries';

describe('linearScale', () => {
  it('maps the domain onto the range, also inverted', () => {
    expect(linearScale(0, 10, 100, 200)(5)).toBe(150);
    expect(linearScale(0, 10, 200, 100)(10)).toBe(100);
  });
  it('maps a zero-width domain to the middle', () => {
    expect(linearScale(3, 3, 0, 100)(3)).toBe(50);
  });
});

describe('niceTicks', () => {
  it('uses a step from the series and 3 to 5 ticks', () => {
    expect(niceTicks(40, 45)).toEqual({ lo: 40, hi: 46, ticks: [40, 42, 44, 46] });
    for (const [a, b] of [
      [1, 2],
      [9, 10],
      [27, 40],
      [32, 47],
      [0, 200],
      [100, 137],
    ]) {
      const { ticks } = niceTicks(a, b);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(5);
    }
  });
  it('covers the data with the nearest ticks', () => {
    expect(niceTicks(27, 40)).toEqual({ lo: 25, hi: 40, ticks: [25, 30, 35, 40] });
    expect(niceTicks(32, 47)).toEqual({ lo: 30, hi: 50, ticks: [30, 35, 40, 45, 50] });
  });
  it('supports the 2.5 step', () => {
    expect(niceTicks(10, 20).ticks).toEqual([10, 12.5, 15, 17.5, 20]);
  });
  it('never goes under zero', () => {
    expect(niceTicks(0.5, 2).lo).toBe(0);
    expect(niceTicks(0, 0)).toEqual({ lo: 0, hi: 2, ticks: [0, 1, 2] });
  });
  it('pads a single value up to 3 ticks', () => {
    expect(niceTicks(10, 10).ticks).toEqual([9, 10, 11]);
  });
  it('handles a wide range', () => {
    expect(niceTicks(0, 200).ticks).toEqual([0, 50, 100, 150, 200]);
  });
});

describe('yDomain', () => {
  it('is a neutral axis without values', () => {
    expect(yDomain([]).lo).toBe(0);
  });
  it('is not anchored at zero', () => {
    const d = yDomain([40, 42.5, 45]);
    expect(d.lo).toBe(40);
    expect(d.hi).toBeGreaterThanOrEqual(45);
  });
  it('spreads equal values by 5', () => {
    expect(yDomain([40, 40, 40])).toEqual({ lo: 35, hi: 45, ticks: [35, 37.5, 40, 42.5, 45] });
  });
  it('spreads equal small values by 2.5 and stops at zero', () => {
    const d = yDomain([5]);
    expect(d.lo).toBeLessThanOrEqual(2.5);
    expect(d.hi).toBeGreaterThanOrEqual(7.5);
    const zero = yDomain([0, 0]);
    expect(zero.lo).toBe(0);
    expect(zero.hi).toBeGreaterThanOrEqual(2.5);
  });
});

describe('filterPeriod', () => {
  const today = '2026-11-15';
  const series = [pt('2026-06-01', 30), pt('2026-09-10', 35), pt('2026-10-21', 40), pt('2026-11-12', 45)];

  it('counts the window back from today and keeps the neighbour on the left', () => {
    const view = filterPeriod(series, '3M', today);
    expect(view.end).toBe(today);
    expect(view.start).toBe(addDays(today, -91));
    expect(view.from).toBe(1);
    expect(view.to).toBe(4);
    expect(view.prev).toBe(0);
  });
  it('has no neighbour when the window reaches the first point', () => {
    const view = filterPeriod(series, '1Y', today);
    expect(view.from).toBe(0);
    expect(view.prev).toBe(-1);
  });
  it('uses 30, 182 and 365 days', () => {
    expect(filterPeriod(series, '1M', today).start).toBe(addDays(today, -30));
    expect(filterPeriod(series, '6M', today).start).toBe(addDays(today, -182));
    expect(filterPeriod(series, '1Y', today).start).toBe(addDays(today, -365));
  });
  it('All runs from the first point to today', () => {
    const view = filterPeriod(series, 'All', today);
    expect(view.start).toBe('2026-06-01');
    expect(view.from).toBe(0);
  });
  it('All spans at least 14 days', () => {
    const view = filterPeriod([pt('2026-11-14', 40)], 'All', today);
    expect(view.start).toBe(addDays(today, -14));
    expect(view.from).toBe(0);
  });
  it('reports an empty period while data exists', () => {
    const view = filterPeriod(series, '1M', '2027-03-01');
    expect(view.from).toBe(view.to);
    expect(view.prev).toBe(3);
  });
  it('stretches the right edge to a future point', () => {
    expect(filterPeriod([pt('2026-11-20', 40)], '1M', today).end).toBe('2026-11-20');
  });
  it('handles an empty series', () => {
    expect(filterPeriod([], '3M', today)).toMatchObject({ from: 0, to: 0, prev: -1 });
  });
  it('handles 30 points', () => {
    const many = make(30, '2026-11-12', 7, [40, 40, 42.5]);
    const view = filterPeriod(many, '3M', today);
    expect(view.to - view.from).toBe(13);
    expect(view.prev).toBe(view.from - 1);
  });
});

describe('defaultPeriod', () => {
  const today = '2026-11-15';
  it('is 3M with two points in the last 91 days', () => {
    expect(defaultPeriod([pt('2026-10-01', 1), pt('2026-11-01', 1)], today)).toBe('3M');
  });
  it('is All otherwise', () => {
    expect(defaultPeriod([pt('2026-01-01', 1), pt('2026-11-01', 1)], today)).toBe('All');
    expect(defaultPeriod([], today)).toBe('All');
  });
});

describe('xTicks', () => {
  const labels = (ticks: { label: string }[]) => ticks.map((t) => t.label);

  it('1M: Mondays as "3 Nov"', () => {
    const ticks = xTicks('1M', '2026-10-16', '2026-11-15');
    expect(ticks.map((t) => t.date)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
    expect(labels(ticks)[2]).toBe('2 Nov');
  });
  it('3M: month starts', () => {
    expect(labels(xTicks('3M', addDays('2026-11-15', -91), '2026-11-15'))).toEqual(['Sep', 'Oct', 'Nov']);
  });
  it('6M: thinned to at most 5 labels', () => {
    expect(labels(xTicks('6M', addDays('2026-11-15', -182), '2026-11-15'))).toEqual(['Jul', 'Sep', 'Nov']);
  });
  it('1Y: quarter starts', () => {
    expect(labels(xTicks('1Y', addDays('2026-11-15', -365), '2026-11-15'))).toEqual(['Jan', 'Apr', 'Jul', 'Oct']);
  });
  it('All over a year labels months with the year', () => {
    const ticks = xTicks('All', '2025-03-02', '2026-11-15');
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks[0].label).toMatch(/^[A-Z][a-z]{2} '\d\d$/);
  });
  it('All over several years uses years', () => {
    const ticks = xTicks('All', '2019-02-01', '2026-11-15');
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every((t) => /^\d{4}$/.test(t.label))).toBe(true);
  });
  it('short All uses Mondays', () => {
    expect(xTicks('All', '2026-11-01', '2026-11-15').map((t) => t.date)).toEqual(['2026-11-02', '2026-11-09']);
  });
  it('never exceeds 5 and stays inside the window', () => {
    const end = '2026-11-15';
    for (const span of [14, 30, 36, 60, 91, 182, 365, 500, 900, 3000]) {
      const start = addDays(end, -span);
      const ticks = xTicks(span === 30 ? '1M' : 'All', start, end);
      expect(ticks.length).toBeLessThanOrEqual(5);
      for (const t of ticks) expect(t.date >= start && t.date <= end).toBe(true);
    }
  });
});

describe('record', () => {
  it('is null for an empty series', () => {
    expect(record([])).toBeNull();
  });
  it('is the heaviest single set and its first date', () => {
    const series = [pt('2026-01-01', 40), pt('2026-02-01', 30, 45), pt('2026-03-01', 45), pt('2026-04-01', 40)];
    expect(record(series)).toEqual({ value: 45, date: '2026-02-01', index: 1 });
  });
});

describe('newHighFlags', () => {
  it('marks strict increases over everything before, never the first point', () => {
    const series = [
      pt('2026-01-01', 40),
      pt('2026-01-08', 40),
      pt('2026-01-15', 42.5),
      pt('2026-01-22', 40),
      pt('2026-01-29', 42.5),
      pt('2026-02-05', 45),
    ];
    expect(newHighFlags(series)).toEqual([false, false, true, false, false, true]);
  });
  it('is empty for an empty series', () => {
    expect(newHighFlags([])).toEqual([]);
  });
});

describe('gapFlags', () => {
  it('flags segments longer than 28 days', () => {
    const series = [pt('2026-01-01', 1), pt('2026-01-29', 1), pt('2026-02-27', 1), pt('2026-03-01', 1)];
    expect(gapFlags(series)).toEqual([false, false, true, false]);
  });
});

describe('plateau', () => {
  it('is null for an empty series', () => {
    expect(plateau([])).toBeNull();
  });
  it('counts the run of equal values at the end', () => {
    const series = [pt('2026-10-01', 40), pt('2026-10-22', 45), pt('2026-10-29', 45), pt('2026-11-05', 45)];
    expect(plateau(series)).toEqual({ count: 3, since: '2026-10-22', value: 45, isNew: false });
  });
  it('reports a new weight when the last point differs', () => {
    const series = [pt('2026-10-01', 40), pt('2026-10-22', 45)];
    expect(plateau(series)).toEqual({ count: 1, since: '2026-10-22', value: 45, isNew: true });
  });
  it('a single point is neither a run nor a change', () => {
    expect(plateau([pt('2026-10-01', 40)])).toEqual({ count: 1, since: '2026-10-01', value: 40, isNew: false });
  });
  it('runs through the whole series when all values are equal', () => {
    expect(plateau(make(30, '2026-11-12', 3, [40]))).toMatchObject({ count: 30, since: '2026-08-17' });
  });
});

describe('periodChange', () => {
  it('needs two points', () => {
    expect(periodChange([])).toBeNull();
    expect(periodChange([pt('2026-10-01', 40)])).toBeNull();
  });
  it('compares the first and the last point', () => {
    expect(periodChange([pt('2026-10-01', 40), pt('2026-10-07', 38), pt('2026-10-13', 45)])).toEqual({
      from: 40,
      to: 45,
      delta: 5,
      days: 12,
    });
  });
});

describe('nearestIndex', () => {
  it('is -1 without positions', () => {
    expect(nearestIndex([], 10)).toBe(-1);
  });
  it('picks the nearest position', () => {
    const xs = [10, 20, 50, 100];
    expect(nearestIndex(xs, -5)).toBe(0);
    expect(nearestIndex(xs, 14)).toBe(0);
    expect(nearestIndex(xs, 16)).toBe(1);
    expect(nearestIndex(xs, 40)).toBe(2);
    expect(nearestIndex(xs, 90)).toBe(3);
    expect(nearestIndex(xs, 999)).toBe(3);
  });
  it('picks the only position', () => {
    expect(nearestIndex([50], 0)).toBe(0);
  });
});

describe('placeLabels', () => {
  const left = 16;
  const right = 300;

  it('labels every point when there are 6 or fewer and room', () => {
    const labels = placeLabels({ xs: [20, 80, 140, 200, 260], values: [40, 40, 42.5, 45, 45], left, right });
    expect(labels.map((l) => l.text)).toEqual(['40', '40', '42.5', '45', '45']);
  });
  it('labels only the last and the highest point with more than 6', () => {
    const xs = [20, 60, 100, 140, 180, 220, 260];
    const labels = placeLabels({ xs, values: [40, 45, 42, 41, 40, 41, 43], left, right });
    expect(labels.map((l) => l.index)).toEqual([1, 6]);
  });
  it('labels just the last point when it is also the highest', () => {
    const xs = [20, 60, 100, 140, 180, 220, 260];
    const labels = placeLabels({ xs, values: [40, 41, 42, 43, 44, 45, 46], left, right });
    expect(labels.map((l) => l.index)).toEqual([6]);
  });
  it('shifts labels inside the plane at both edges', () => {
    const labels = placeLabels({ xs: [left, right], values: [40, 42.5], left, right });
    expect(labels[0].left).toBeGreaterThanOrEqual(left);
    expect(labels[1].left + labels[1].width).toBeLessThanOrEqual(right);
  });
  it('hides the lower-priority label of two that overlap', () => {
    const labels = placeLabels({ xs: [100, 104], values: [40, 45], left, right });
    expect(labels).toHaveLength(1);
    expect(labels[0].index).toBe(1);
  });
  it('keeps labels apart when several points are crowded', () => {
    const xs = [100, 106, 112, 118, 124, 130];
    const labels = placeLabels({ xs, values: [40, 41, 42, 43, 44, 45], left, right });
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i].left).toBeGreaterThanOrEqual(labels[i - 1].left + labels[i - 1].width);
    }
    expect(labels.some((l) => l.index === 5)).toBe(true);
  });
  it('handles no points and estimates widths by length', () => {
    expect(placeLabels({ xs: [], values: [], left, right })).toEqual([]);
    expect(labelWidth('42.5')).toBeGreaterThan(labelWidth('45'));
  });
});
