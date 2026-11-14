import { createPersist } from './persist';
import { createFakeDriver, noSleep } from './testUtils';
import { emptySnapshot } from './ops';
import type { Op } from './types';

const putExercise = (id: string, name: string): Op => ({
  t: 'put',
  table: 'exercises',
  row: { id, name, sortIndex: 0, archivedAt: null, createdAt: 'x' },
});

describe('persist', () => {
  it('merges operations on the same key while a commit is running', async () => {
    const driver = createFakeDriver();
    const persist = createPersist(driver, { sleep: noSleep });
    persist.enqueue([putExercise('a', 'first')]); // starts committing right away
    persist.enqueue([putExercise('b', 'one')]);
    persist.enqueue([putExercise('b', 'two')]); // replaces the previous op for b
    await persist.whenIdle();

    expect(driver.commits).toHaveLength(2);
    const second = driver.commits[1].filter((op) => op.table === 'exercises');
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ row: { id: 'b', name: 'two' } });
    expect(driver.tables.exercises.b.name).toBe('two');
  });

  it('keeps ordering: later ops on a key win and deletes apply', async () => {
    const driver = createFakeDriver();
    const persist = createPersist(driver, { sleep: noSleep });
    persist.enqueue([putExercise('a', 'x')]);
    persist.enqueue([putExercise('a', 'y'), { t: 'del', table: 'exercises', key: 'a' }]);
    await persist.whenIdle();
    expect(driver.tables.exercises.a).toBeUndefined();
  });

  it('writes meta.rev + 1 in every commit and reports it', async () => {
    const driver = createFakeDriver();
    const persist = createPersist(driver, { sleep: noSleep });
    const revs: number[] = [];
    persist.setListener({ onRev: (r) => revs.push(r) });
    persist.init(5);
    persist.enqueue([putExercise('a', 'x')]);
    await persist.whenIdle();
    persist.enqueue([putExercise('a', 'y')]);
    await persist.whenIdle();

    expect(revs).toEqual([6, 7]);
    expect(driver.tables.meta.rev).toBe(7);
    expect(persist.getRev()).toBe(7);
  });

  it('retries a failed commit with the same batch after reopening the database', async () => {
    const driver = createFakeDriver();
    const delays: number[] = [];
    const persist = createPersist(driver, { sleep: async (ms) => void delays.push(ms) });
    driver.failNext = 2;
    persist.enqueue([putExercise('a', 'x')]);
    await persist.whenIdle();

    expect(delays).toEqual([200, 500]);
    expect(driver.closes).toBe(2);
    expect(driver.opens).toBe(2);
    expect(driver.tables.exercises.a.name).toBe('x');
    expect(persist.getStatus()).toBe('ok');
  });

  it('goes to failed after three retries, keeps the data and recovers on the next write', async () => {
    const driver = createFakeDriver();
    const delays: number[] = [];
    const persist = createPersist(driver, { sleep: async (ms) => void delays.push(ms) });
    const statuses: string[] = [];
    persist.setListener({ onStatus: (s) => statuses.push(s) });

    driver.failNext = 4; // first attempt + 3 retries
    persist.enqueue([putExercise('a', 'x')]);
    await persist.whenIdle();
    expect(delays).toEqual([200, 500, 1000]);
    expect(persist.getStatus()).toBe('failed');
    expect(driver.tables.exercises.a).toBeUndefined();

    persist.enqueue([putExercise('b', 'y')]);
    await persist.whenIdle();
    expect(persist.getStatus()).toBe('ok');
    expect(statuses).toEqual(['failed', 'ok']);
    // The failed batch was put back, so nothing was lost.
    expect(driver.tables.exercises.a.name).toBe('x');
    expect(driver.tables.exercises.b.name).toBe('y');
  });

  it('simulateFailure makes writes fail until switched off', async () => {
    const driver = createFakeDriver();
    const persist = createPersist(driver, { sleep: noSleep });
    persist.simulateFailure(true);
    persist.enqueue([putExercise('a', 'x')]);
    await persist.whenIdle();
    expect(persist.getStatus()).toBe('failed');
    persist.simulateFailure(false);
    await persist.replaceAll({ ...emptySnapshot() });
    expect(persist.getStatus()).toBe('ok');
  });

  it('replaceAll supersedes pending operations and bumps rev', async () => {
    const driver = createFakeDriver();
    const persist = createPersist(driver, { sleep: noSleep });
    persist.init(3);
    persist.enqueue([putExercise('a', 'x')]);
    persist.enqueue([putExercise('stale', 'dropped')]);
    await persist.replaceAll({
      ...emptySnapshot(),
      exercises: [{ id: 'n', name: 'new', sortIndex: 0, archivedAt: null, createdAt: 'x' }],
    });
    expect(Object.keys(driver.tables.exercises)).toEqual(['n']);
    expect(persist.getRev()).toBeGreaterThanOrEqual(5);
    expect(driver.tables.meta.rev).toBe(persist.getRev());
  });

  it('whenIdle resolves immediately when nothing is queued', async () => {
    const persist = createPersist(createFakeDriver(), { sleep: noSleep });
    await expect(persist.whenIdle()).resolves.toBeUndefined();
  });
});
