import 'fake-indexeddb/auto';

import { generateDemo } from './demo';
import { createDriver } from './driver.web';
import { createPersist } from './persist';
import { emptySnapshot } from './ops';
import type { Exercise, Snapshot } from './types';

let counter = 0;
const freshName = () => `test-db-${++counter}`;

const exercise = (id: string, name = id): Exercise => ({
  id,
  name,
  sortIndex: 0,
  archivedAt: null,
  createdAt: 'x',
});

const sortById = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));

describe('driver.web (IndexedDB)', () => {
  it('opens an empty database with default meta', async () => {
    const driver = createDriver(freshName());
    await driver.open();
    const snapshot = await driver.loadAll();
    expect(snapshot.exercises).toEqual([]);
    expect(snapshot.meta.rev).toBe(0);
    expect(snapshot.meta.themeMode).toBe('system');
  });

  it('commits puts and deletes for every table, including compound keys', async () => {
    const driver = createDriver(freshName());
    await driver.open();
    await driver.commit([
      { t: 'put', table: 'exercises', row: exercise('e1') },
      { t: 'put', table: 'groups', row: { id: 'g1', name: 'Push', createdAt: 'x' } },
      { t: 'put', table: 'memberships', row: { groupId: 'g1', exerciseId: 'e1', position: 0 } },
      { t: 'put', table: 'workouts', row: { id: 'w1', date: '2026-11-14', createdAt: 'x' } },
      { t: 'put', table: 'entries', row: { workoutId: 'w1', exerciseId: 'e1', weights: [40, 42.5], updatedAt: 'x' } },
      { t: 'put', table: 'meta', row: { key: 'themeMode', value: 'dark' } },
      { t: 'put', table: 'meta', row: { key: 'rev', value: 3 } },
    ]);
    let s = await driver.loadAll();
    expect(s.exercises).toHaveLength(1);
    expect(s.memberships).toEqual([{ groupId: 'g1', exerciseId: 'e1', position: 0 }]);
    expect(s.entries[0].weights).toEqual([40, 42.5]);
    expect(s.meta).toMatchObject({ themeMode: 'dark', rev: 3 });

    await driver.commit([
      { t: 'put', table: 'exercises', row: exercise('e1', 'renamed') },
      { t: 'del', table: 'entries', key: ['w1', 'e1'] },
      { t: 'del', table: 'memberships', key: ['g1', 'e1'] },
    ]);
    s = await driver.loadAll();
    expect(s.exercises[0].name).toBe('renamed');
    expect(s.entries).toEqual([]);
    expect(s.memberships).toEqual([]);
  });

  it('commit is idempotent', async () => {
    const driver = createDriver(freshName());
    const ops = [
      { t: 'put', table: 'exercises', row: exercise('e1') },
      { t: 'del', table: 'groups', key: 'missing' },
    ] as const;
    await driver.commit([...ops]);
    await driver.commit([...ops]);
    expect((await driver.loadAll()).exercises).toHaveLength(1);
  });

  it('replaceAll swaps all content', async () => {
    const driver = createDriver(freshName());
    await driver.commit([{ t: 'put', table: 'exercises', row: exercise('old') }]);
    const demo = generateDemo(5, 20);
    await driver.replaceAll({ ...demo, meta: { ...demo.meta, rev: 7 } });
    const s = await driver.loadAll();
    expect(sortById(s.exercises)).toEqual(sortById(demo.exercises));
    expect(s.entries).toHaveLength(demo.entries.length);
    expect(s.meta.rev).toBe(7);
  });

  it('persists across driver instances (same database name)', async () => {
    const name = freshName();
    const a = createDriver(name);
    await a.commit([{ t: 'put', table: 'exercises', row: exercise('keep') }]);
    await a.close();
    const b = createDriver(name);
    expect((await b.loadAll()).exercises.map((e) => e.id)).toEqual(['keep']);
  });

  it('recovers after the connection is closed behind its back', async () => {
    const driver = createDriver(freshName());
    await driver.commit([{ t: 'put', table: 'exercises', row: exercise('a') }]);
    await driver.close();
    // The next commit reopens lazily.
    await driver.commit([{ t: 'put', table: 'exercises', row: exercise('b') }]);
    expect((await driver.loadAll()).exercises).toHaveLength(2);
  });

  it('works under the persist queue and writes rev', async () => {
    const driver = createDriver(freshName());
    const persist = createPersist(driver);
    persist.enqueue([{ t: 'put', table: 'exercises', row: exercise('a') }]);
    persist.enqueue([{ t: 'put', table: 'exercises', row: exercise('b') }]);
    await persist.whenIdle();
    const s: Snapshot = await driver.loadAll();
    expect(s.exercises).toHaveLength(2);
    expect(s.meta.rev).toBe(persist.getRev());
    expect(persist.getRev()).toBeGreaterThan(0);
    await driver.replaceAll(emptySnapshot());
  });
});
