import { cellLabel, dotsFor, headerLabel } from './labels';

describe('headerLabel', () => {
  it('shows the weekday for the current year', () => {
    expect(headerLabel('2026-10-21', '2026-11-14')).toEqual({ date: '21.10', sub: 'Wed' });
  });
  it('shows the year for other years', () => {
    expect(headerLabel('2025-10-21', '2026-11-14')).toEqual({ date: '21.10', sub: '2025' });
  });
  it('has no texts without a date', () => {
    expect(headerLabel(null, '2026-11-14')).toEqual({ date: null, sub: null });
  });
});

describe('dotsFor', () => {
  it('maps set counts to dots', () => {
    expect(dotsFor(1)).toEqual({ dots: 0, plus: false });
    expect(dotsFor(2)).toEqual({ dots: 2, plus: false });
    expect(dotsFor(4)).toEqual({ dots: 4, plus: false });
    expect(dotsFor(5)).toEqual({ dots: 3, plus: true });
    expect(dotsFor(9)).toEqual({ dots: 3, plus: true });
  });
});

describe('cellLabel', () => {
  it('describes sets, single values, empty cells and undated workouts', () => {
    expect(cellLabel('Bench press', '2026-10-24', [40, 45, 42.5])).toBe('Bench press, 24 Oct: 45 kg, 3 sets');
    expect(cellLabel('Squat', '2026-10-24', [60])).toBe('Squat, 24 Oct: 60 kg');
    expect(cellLabel('Squat', '2026-10-24', undefined)).toBe('Squat, 24 Oct: empty');
    expect(cellLabel('Squat', null, [60])).toBe('Squat, no date: 60 kg');
  });
});
