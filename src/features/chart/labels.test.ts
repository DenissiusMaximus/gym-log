import { chartLabel, historyLabel, pointValue, relativeDay, setsText, signed } from './labels';
import { pt } from './testSeries';

describe('relativeDay', () => {
  it('says today, yesterday and N days ago', () => {
    expect(relativeDay('2026-11-15', '2026-11-15')).toBe('today');
    expect(relativeDay('2026-11-14', '2026-11-15')).toBe('yesterday');
    expect(relativeDay('2026-11-12', '2026-11-15')).toBe('3 days ago');
  });
  it('handles a future date', () => {
    expect(relativeDay('2026-11-18', '2026-11-15')).toBe('in 3 days');
  });
});

describe('signed', () => {
  it('writes the sign', () => {
    expect(signed(5)).toBe('+5');
    expect(signed(-2.5)).toBe('-2.5');
    expect(signed(0)).toBe('0');
    expect(signed(0.001)).toBe('0');
  });
});

describe('pointValue / setsText', () => {
  it('prefixes avg only for several sets', () => {
    expect(pointValue(pt('2026-11-12', 45))).toEqual({ prefix: null, value: '45' });
    expect(pointValue(pt('2026-11-12', 40, 45))).toEqual({ prefix: 'avg', value: '42.5' });
  });
  it('joins the sets', () => {
    expect(setsText([40, 42.5, 45])).toBe('40 / 42.5 / 45');
  });
});

describe('chartLabel', () => {
  it('describes the visible points', () => {
    const points = [pt('2026-10-21', 40), pt('2026-11-05', 42.5), pt('2026-11-12', 45)];
    expect(chartLabel(points)).toBe('Chart: 3 workouts from 21 Oct to 12 Nov, from 40 to 45 kg');
  });
  it('describes one point', () => {
    expect(chartLabel([pt('2026-11-12', 45)])).toBe('Chart: 1 workout on 12 Nov, 45 kg');
  });
  it('is empty without points', () => {
    expect(chartLabel([])).toBe('');
  });
});

describe('historyLabel', () => {
  it('reads one set', () => {
    expect(historyLabel(pt('2026-11-12', 45))).toBe('Thu, 12 Nov 2026: 45 kg');
  });
  it('reads several sets with the average', () => {
    expect(historyLabel(pt('2026-11-12', 40, 45))).toBe('Thu, 12 Nov 2026: sets: 40 / 45, avg 42.5 kg');
  });
});
