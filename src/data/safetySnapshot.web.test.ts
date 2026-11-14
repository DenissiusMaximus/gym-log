import { generateDemo } from './demo';
import { emptySnapshot } from './ops';
import { createSafetySnapshot, MAX_SNAPSHOT_LENGTH, SNAPSHOT_KEY } from './safetySnapshot.web';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('safetySnapshot.web', () => {
  it('writes in backup format with rev and reads it back', () => {
    const storage = memoryStorage();
    const safety = createSafetySnapshot(storage);
    const demo = generateDemo(3, 5);
    safety.writeNow({ ...demo, meta: { ...demo.meta, rev: 12, themeMode: 'dark' } });

    const raw = JSON.parse(storage.map.get(SNAPSHOT_KEY) as string);
    expect(raw.format).toBe('gym-log-backup');
    expect(raw.rev).toBe(12);

    const read = safety.read();
    expect(read?.rev).toBe(12);
    expect(read?.snapshot.exercises).toHaveLength(3);
    expect(read?.snapshot.meta).toMatchObject({ rev: 12, themeMode: 'dark' });
  });

  it('returns null for missing or corrupt data', () => {
    const storage = memoryStorage();
    const safety = createSafetySnapshot(storage);
    expect(safety.read()).toBeNull();
    storage.map.set(SNAPSHOT_KEY, '{broken');
    expect(safety.read()).toBeNull();
    expect(createSafetySnapshot(null).read()).toBeNull();
  });

  it('skips silently when too large or when storage throws', () => {
    const big = memoryStorage();
    const huge = { ...emptySnapshot(), exercises: [{ id: 'x', name: 'a'.repeat(MAX_SNAPSHOT_LENGTH), sortIndex: 0, archivedAt: null, createdAt: 'x' }] };
    createSafetySnapshot(big).writeNow(huge);
    expect(big.map.size).toBe(0);

    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };
    expect(() => createSafetySnapshot(throwing).writeNow(emptySnapshot())).not.toThrow();
  });

  it('debounces scheduled writes and keeps only the latest', () => {
    jest.useFakeTimers();
    try {
      const storage = memoryStorage();
      const safety = createSafetySnapshot(storage);
      const first = { ...emptySnapshot(), meta: { ...emptySnapshot().meta, rev: 1 } };
      const second = { ...emptySnapshot(), meta: { ...emptySnapshot().meta, rev: 2 } };
      safety.schedule(() => first, 3000);
      jest.advanceTimersByTime(2000);
      safety.schedule(() => second, 3000);
      jest.advanceTimersByTime(2999);
      expect(storage.map.size).toBe(0);
      jest.advanceTimersByTime(1);
      expect(JSON.parse(storage.map.get(SNAPSHOT_KEY) as string).rev).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('writes when the page becomes hidden', () => {
    // The RN jest environment has no DOM, so a minimal document stands in for it.
    const listeners: Record<string, () => void> = {};
    const fakeDocument = {
      visibilityState: 'visible',
      addEventListener: (type: string, fn: () => void) => void (listeners[type] = fn),
    };
    const globals = globalThis as unknown as { document?: unknown };
    const previous = globals.document;
    globals.document = fakeDocument;
    try {
      const storage = memoryStorage();
      createSafetySnapshot(storage).install(() => emptySnapshot());
      listeners.visibilitychange();
      expect(storage.map.has(SNAPSHOT_KEY)).toBe(false);
      fakeDocument.visibilityState = 'hidden';
      listeners.visibilitychange();
      expect(storage.map.has(SNAPSHOT_KEY)).toBe(true);
    } finally {
      globals.document = previous;
    }
  });
});
