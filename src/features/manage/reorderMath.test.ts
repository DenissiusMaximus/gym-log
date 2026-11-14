import {
  autoScrollRatio,
  clampIndex,
  indexFromTop,
  moveBy,
  orderFromPositions,
  positionsFromOrder,
  shiftPositions,
} from './reorderMath';

describe('clampIndex / indexFromTop', () => {
  it('keeps the index inside the list', () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(2, 5)).toBe(2);
    expect(clampIndex(1, 0)).toBe(0);
  });

  it('rounds the row top to the nearest slot and clamps it', () => {
    expect(indexFromTop(0, 56, 4)).toBe(0);
    expect(indexFromTop(27, 56, 4)).toBe(0);
    expect(indexFromTop(29, 56, 4)).toBe(1);
    expect(indexFromTop(-100, 56, 4)).toBe(0);
    expect(indexFromTop(10_000, 56, 4)).toBe(3);
  });
});

describe('positions', () => {
  it('round-trips an order', () => {
    const ids = ['a', 'b', 'c'];
    expect(positionsFromOrder(ids)).toEqual({ a: 0, b: 1, c: 2 });
    expect(orderFromPositions(positionsFromOrder(ids))).toEqual(ids);
  });

  it('moves a row down and shifts the rows in between up', () => {
    const next = shiftPositions(positionsFromOrder(['a', 'b', 'c', 'd']), 'a', 2);
    expect(orderFromPositions(next)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a row up and shifts the rows in between down', () => {
    const next = shiftPositions(positionsFromOrder(['a', 'b', 'c', 'd']), 'd', 1);
    expect(orderFromPositions(next)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the same object when nothing moves or the id is unknown', () => {
    const positions = positionsFromOrder(['a', 'b']);
    expect(shiftPositions(positions, 'a', 0)).toBe(positions);
    expect(shiftPositions(positions, 'x', 1)).toBe(positions);
  });

  it('does not mutate its input', () => {
    const positions = positionsFromOrder(['a', 'b', 'c']);
    shiftPositions(positions, 'a', 2);
    expect(positions).toEqual({ a: 0, b: 1, c: 2 });
  });
});

describe('autoScrollRatio', () => {
  it('is zero away from the edges', () => {
    expect(autoScrollRatio(300, 600, 72)).toBe(0);
    expect(autoScrollRatio(72, 600, 72)).toBe(0);
    expect(autoScrollRatio(528, 600, 72)).toBe(0);
  });

  it('scrolls up near the top, faster closer to the border', () => {
    expect(autoScrollRatio(36, 600, 72)).toBeCloseTo(-0.5);
    expect(autoScrollRatio(0, 600, 72)).toBe(-1);
    expect(autoScrollRatio(-40, 600, 72)).toBe(-1);
  });

  it('scrolls down near the bottom', () => {
    expect(autoScrollRatio(564, 600, 72)).toBeCloseTo(0.5);
    expect(autoScrollRatio(600, 600, 72)).toBe(1);
    expect(autoScrollRatio(700, 600, 72)).toBe(1);
  });
});

describe('moveBy', () => {
  const ids = ['a', 'b', 'c'];

  it('moves an id one place either way', () => {
    expect(moveBy(ids, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveBy(ids, 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('refuses to move past the ends or an absent id', () => {
    expect(moveBy(ids, 'a', -1)).toBeNull();
    expect(moveBy(ids, 'c', 1)).toBeNull();
    expect(moveBy(ids, 'x', 1)).toBeNull();
  });

  it('does not mutate its input', () => {
    moveBy(ids, 'a', 1);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});
