import { bucketIndex, computeWindow, poolSize, revealOffset } from './window';

const base = { viewportW: 266, colW: 60, total: 300, overscan: 6, bucket: 2 };

describe('computeWindow', () => {
  it('starts at column 0 with no negative overscan', () => {
    expect(computeWindow({ ...base, scrollX: 0 })).toEqual({ first: 0, last: 2 + 5 - 1 + 6 });
  });

  it('keeps overscan columns before the visible range', () => {
    // scrollX 1200 = column 20, bucket start 20
    const w = computeWindow({ ...base, scrollX: 1200 });
    expect(w.first).toBe(14);
    expect(w.last).toBe(20 + 2 + 5 - 1 + 6);
  });

  it('clamps the end to the last column', () => {
    const w = computeWindow({ ...base, scrollX: 300 * 60 - 266 });
    expect(w.last).toBe(299);
    expect(w.first).toBeLessThanOrEqual(299);
  });

  it('quantizes by bucket: offsets in one bucket give the same window', () => {
    const a = computeWindow({ ...base, scrollX: 1200 });
    const b = computeWindow({ ...base, scrollX: 1319 });
    const c = computeWindow({ ...base, scrollX: 1320 });
    expect(b).toEqual(a);
    expect(c.first).toBe(a.first + 2);
  });

  it('covers every visible column for any offset inside the bucket', () => {
    for (let x = 1200; x < 1320; x += 7) {
      const w = computeWindow({ ...base, scrollX: x });
      const firstVisible = Math.floor(x / 60);
      const lastVisible = Math.min(299, Math.ceil((x + 266) / 60) - 1);
      expect(w.first).toBeLessThanOrEqual(firstVisible);
      expect(w.last).toBeGreaterThanOrEqual(lastVisible);
    }
  });

  it('shows everything when the window is wider than the column count', () => {
    expect(computeWindow({ ...base, total: 3, scrollX: 0 })).toEqual({ first: 0, last: 2 });
    expect(computeWindow({ ...base, total: 3, scrollX: 5000 })).toEqual({ first: 2, last: 2 });
  });

  it('returns an empty window for zero columns', () => {
    const w = computeWindow({ ...base, total: 0, scrollX: 0 });
    expect(w.last).toBeLessThan(w.first);
  });

  it('treats a negative offset (overscroll) as the start', () => {
    expect(computeWindow({ ...base, scrollX: -50 })).toEqual(computeWindow({ ...base, scrollX: 0 }));
  });

  it('never needs more slots than poolSize', () => {
    const pool = poolSize(base.viewportW, base.overscan, base.colW, base.bucket);
    for (let x = 0; x <= 300 * 60; x += 13) {
      const w = computeWindow({ ...base, scrollX: x });
      expect(w.last - w.first + 1).toBeLessThanOrEqual(pool);
    }
  });
});

describe('bucketIndex', () => {
  it('floors by bucket width and clamps negatives', () => {
    expect(bucketIndex(0, 60, 2)).toBe(0);
    expect(bucketIndex(119, 60, 2)).toBe(0);
    expect(bucketIndex(120, 60, 2)).toBe(1);
    expect(bucketIndex(-10, 60, 2)).toBe(0);
  });
});

describe('poolSize', () => {
  it('is 19 slots for a 390 px phone with the web defaults', () => {
    expect(poolSize(390 - 124)).toBe(19);
  });

  it('grows with the viewport and with overscan', () => {
    expect(poolSize(600)).toBeGreaterThan(poolSize(300));
    expect(poolSize(300, 8)).toBe(poolSize(300, 6) + 4);
  });

  it('handles a zero or negative viewport', () => {
    expect(poolSize(0)).toBe(2 + 12);
    expect(poolSize(-5)).toBe(2 + 12);
  });
});

describe('revealOffset', () => {
  it('keeps the offset when the item is visible', () => {
    expect(revealOffset(100, 60, 80, 200)).toBe(80);
  });
  it('scrolls back so the item starts at the edge', () => {
    expect(revealOffset(100, 60, 150, 200)).toBe(100);
  });
  it('scrolls forward so the item ends at the edge', () => {
    expect(revealOffset(400, 60, 100, 200)).toBe(260);
  });
  it('never returns a negative offset', () => {
    expect(revealOffset(0, 60, 30, 200)).toBe(0);
  });
  it('ignores a zero-size view', () => {
    expect(revealOffset(400, 60, 100, 0)).toBe(100);
  });
});
