import { countLabel, plural } from './plural';

describe('plural', () => {
  it('picks singular only for exactly one', () => {
    expect(plural(1, 'set', 'sets')).toBe('set');
    expect(plural(0, 'set', 'sets')).toBe('sets');
    expect(plural(2, 'set', 'sets')).toBe('sets');
    expect(plural(11, 'set', 'sets')).toBe('sets');
  });

  it('builds a count label', () => {
    expect(countLabel(1, 'set', 'sets')).toBe('1 set');
    expect(countLabel(3, 'set', 'sets')).toBe('3 sets');
  });
});
