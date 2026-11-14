import { formatWeight, parseWeight, round2 } from './format';

describe('formatWeight', () => {
  it('uses a decimal point and no trailing zeros', () => {
    expect(formatWeight(40)).toBe('40');
    expect(formatWeight(42.5)).toBe('42.5');
    expect(formatWeight(42.25)).toBe('42.25');
    expect(formatWeight(0)).toBe('0');
  });

  it('rounds to two decimals', () => {
    expect(formatWeight(1.005)).toBe('1.01');
    expect(formatWeight(0.1 + 0.2)).toBe('0.3');
  });
});

describe('parseWeight', () => {
  it('accepts both dot and comma', () => {
    expect(parseWeight('42.5')).toBe(42.5);
    expect(parseWeight('42,5')).toBe(42.5);
    expect(parseWeight(' 40 ')).toBe(40);
    expect(parseWeight('0,')).toBe(0);
    expect(parseWeight('.5')).toBe(0.5);
  });

  it('rejects invalid input', () => {
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('abc')).toBeNull();
    expect(parseWeight('1.2.3')).toBeNull();
    expect(parseWeight('-5')).toBeNull();
    expect(parseWeight('1000')).toBeNull();
    expect(parseWeight('.')).toBeNull();
  });

  it('allows the upper bound', () => {
    expect(parseWeight('999.99')).toBe(999.99);
  });
});

describe('round2', () => {
  it('rounds half up at two decimals', () => {
    expect(round2(2.675)).toBe(2.68);
  });
});
