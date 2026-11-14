import { buildChartModel, CHART_HEIGHT } from './chartLayout';
import { filterPeriod } from './chartMath';
import { make, pt } from './testSeries';

const today = '2026-11-15';
const build = (series: ReturnType<typeof make>, period: Parameters<typeof filterPeriod>[1], width = 390) =>
  buildChartModel(series, filterPeriod(series, period, today), period, width);

describe('buildChartModel', () => {
  it('puts the right edge of the plane on today and keeps points inside', () => {
    const series = [pt('2026-10-21', 40), pt('2026-11-12', 45)];
    const model = build(series, 'All');
    expect(model.height).toBe(CHART_HEIGHT);
    expect(model.plot.right).toBe(390 - 36);
    const last = model.dots[1];
    expect(last.x).toBeLessThan(model.plot.right);
    expect(model.dots[0].x).toBeCloseTo(model.plot.left, 5);
    for (const dot of model.dots) {
      expect(dot.y).toBeGreaterThanOrEqual(model.plot.top);
      expect(dot.y).toBeLessThanOrEqual(model.plot.bottom);
    }
  });

  it('draws higher values higher up', () => {
    const model = build([pt('2026-10-21', 40), pt('2026-11-12', 45)], 'All');
    expect(model.dots[1].y).toBeLessThan(model.dots[0].y);
  });

  it('centres a single point and has no time axis', () => {
    const model = build([pt('2026-11-12', 40)], 'All');
    expect(model.dots).toHaveLength(1);
    expect(model.dots[0].x).toBe((model.plot.left + model.plot.right) / 2);
    expect(model.xTicks).toEqual([]);
    expect(model.paths).toEqual([]);
    expect(model.labels.map((l) => l.text)).toEqual(['40']);
  });

  it('centres the line when all values are equal', () => {
    const model = build(make(5, '2026-11-12', 7, [40]), 'All');
    const ys = new Set(model.dots.map((d) => d.y));
    expect(ys.size).toBe(1);
    const mid = (model.plot.top + model.plot.bottom) / 2;
    expect(model.dots[0].y).toBeCloseTo(mid, 5);
    expect(model.yTicks.length).toBeGreaterThanOrEqual(3);
  });

  it('dashes segments over 28 days and joins the rest into one path', () => {
    const series = [pt('2026-08-01', 40), pt('2026-08-08', 40), pt('2026-10-01', 42.5), pt('2026-10-08', 45)];
    const model = build(series, 'All');
    expect(model.paths.map((p) => p.dashed)).toEqual([false, true, false]);
  });

  it('adds the incoming segment from the point before the period', () => {
    const series = [pt('2026-07-01', 35), pt('2026-10-01', 40), pt('2026-11-12', 45)];
    const model = build(series, '1M');
    expect(model.dots).toHaveLength(1);
    expect(model.paths).toHaveLength(1);
    // The incoming segment (42 days, so dashed) starts left of the plane.
    expect(model.paths[0].dashed).toBe(true);
    const first = model.paths[0].d.match(/^M(-?[\d.]+)/);
    expect(Number(first?.[1])).toBeLessThan(model.plot.left);
  });

  it('flags new highs on the dots, also against points before the period', () => {
    const series = [pt('2026-06-01', 50), pt('2026-10-01', 40), pt('2026-11-05', 45), pt('2026-11-12', 52)];
    const model = build(series, '1M');
    expect(model.dots.map((d) => d.newHigh)).toEqual([false, true]);
    expect(model.dots.map((d) => d.index)).toEqual([2, 3]);
  });

  it('shrinks markers when points are crowded', () => {
    const crowded = build(make(60, '2026-11-12', 1, [40, 41, 42]), 'All');
    expect(crowded.markerRadius).toBe(2);
    expect(build(make(5, '2026-11-12', 7, [40, 41]), 'All').markerRadius).toBe(3.5);
  });

  it('labels all points with 6 or fewer and two with 30', () => {
    expect(build(make(4, '2026-11-12', 14, [40, 42.5, 45, 45]), 'All').labels.length).toBeGreaterThan(0);
    const thirty = build(make(30, '2026-11-12', 3, [40, 40, 42.5, 45, 45, 45]), 'All');
    expect(thirty.labels.length).toBeLessThanOrEqual(2);
    expect(thirty.dots).toHaveLength(30);
  });

  it('keeps every label inside the plane', () => {
    const model = build(make(6, '2026-11-15', 2, [40, 41, 42, 43, 44, 45]), '1M', 360);
    for (const label of model.labels) {
      expect(label.left).toBeGreaterThanOrEqual(model.plot.left);
      expect(label.left + label.width).toBeLessThanOrEqual(model.plot.right);
    }
  });

  it('fits the plane on a 360 wide screen', () => {
    const model = build(make(10, '2026-11-12', 7, [40, 42.5]), '3M', 360);
    expect(model.plot.right - model.plot.left).toBeGreaterThan(250);
  });
});
