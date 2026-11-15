import { createTestStore } from './testUtils';
import type { SafetySnapshotStore, Snapshot } from './types';
import { useUi } from './useUi';

beforeEach(() => {
  useUi.setState({ today: '2026-11-15', draftIds: { today: 'DT', undated: 'DU' }, selectedCell: null, snackbar: null });
});

function setup() {
  const ctx = createTestStore();
  const s = () => ctx.store.getState();
  return { ...ctx, s };
}

describe('exercises and groups', () => {
  it('adds exercises with increasing sort index and group membership', () => {
    const { s } = setup();
    const g = s().addGroup('Push');
    const a = s().addExercise('  Bench  ', [g]);
    const b = s().addExercise('Squat', [g]);
    expect(s().exercises[a].name).toBe('Bench');
    expect(s().exercises[b].sortIndex).toBe(s().exercises[a].sortIndex + 1);
    expect(s().memberships[g]).toEqual({ [a]: 0, [b]: 1 });
  });

  it('archives instead of deleting and keeps entries', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    const w = s().addWorkout('2026-11-01');
    s().setWeights(w, e, [50]);
    s().archiveExercise(e);
    expect(s().exercises[e].archivedAt).not.toBeNull();
    expect(s().entries[w][e].weights).toEqual([50]);
    s().unarchiveExercise(e);
    expect(s().exercises[e].archivedAt).toBeNull();
  });

  it('updateExercise renames and rewrites group membership', () => {
    const { s } = setup();
    const g1 = s().addGroup('A');
    const g2 = s().addGroup('B');
    const e = s().addExercise('Old', [g1]);
    s().updateExercise(e, { name: 'New', groupIds: [g2] });
    expect(s().exercises[e].name).toBe('New');
    expect(s().memberships[g1]).toBeUndefined();
    expect(s().memberships[g2][e]).toBe(0);
  });

  it('reorder in "all" writes sortIndex and keeps archived ones after the active ones', () => {
    const { s } = setup();
    const a = s().addExercise('A', []);
    const b = s().addExercise('B', []);
    const c = s().addExercise('C', []);
    s().archiveExercise(b);
    s().reorder('all', [c, a]);
    expect(s().exercises[c].sortIndex).toBe(0);
    expect(s().exercises[a].sortIndex).toBe(1);
    expect(s().exercises[b].sortIndex).toBe(2);
  });

  it('reorder in a group writes position only for that group', () => {
    const { s } = setup();
    const g = s().addGroup('G');
    const h = s().addGroup('H');
    const a = s().addExercise('A', [g, h]);
    const b = s().addExercise('B', [g, h]);
    s().reorder(g, [b, a]);
    expect(s().memberships[g]).toEqual({ [b]: 0, [a]: 1 });
    expect(s().memberships[h]).toEqual({ [a]: 0, [b]: 1 });
  });

  it('deleteGroup removes memberships, resets the filter and undo restores them', () => {
    const { s } = setup();
    const g = s().addGroup('G');
    const e = s().addExercise('A', [g]);
    s().setMeta({ activeFilter: g });
    const undo = s().deleteGroup(g);
    expect(s().groups[g]).toBeUndefined();
    expect(s().memberships[g]).toBeUndefined();
    expect(s().exercises[e]).toBeDefined();
    expect(s().meta.activeFilter).toBe('all');
    undo();
    expect(s().groups[g]).toBeDefined();
    expect(s().memberships[g][e]).toBe(0);
    expect(s().meta.activeFilter).toBe(g);
  });

  it('setGroupMembers adds and removes members, keeping existing positions', () => {
    const { s } = setup();
    const g = s().addGroup('G');
    const a = s().addExercise('A', [g]);
    const b = s().addExercise('B', []);
    const c = s().addExercise('C', []);
    s().setGroupMembers(g, [c, a, b]);
    expect(s().memberships[g]).toEqual({ [a]: 0, [c]: 1, [b]: 2 });
    s().setGroupMembers(g, [b]);
    expect(Object.keys(s().memberships[g])).toEqual([b]);
  });
});

describe('workouts', () => {
  it('keeps one workout per date', () => {
    const { s } = setup();
    const a = s().addWorkout('2026-11-14');
    const b = s().addWorkout('2026-11-14');
    expect(b).toBe(a);
    expect(Object.keys(s().workouts)).toHaveLength(1);
    const u1 = s().addWorkout(null);
    const u2 = s().addWorkout(null);
    expect(u1).not.toBe(u2);
  });

  it('merges into a workout that already has the date, target entries win, undo restores everything', () => {
    const { s } = setup();
    const bench = s().addExercise('Bench', []);
    const squat = s().addExercise('Squat', []);
    const row = s().addExercise('Row', []);
    const target = s().addWorkout('2026-11-14');
    const source = s().addWorkout(null);
    s().setWeights(target, bench, [60]);
    s().setWeights(source, bench, [10]);
    s().setWeights(source, squat, [80]);

    const result = s().setWorkoutDate(source, '2026-11-14');
    expect(result.merged).toBe(true);
    expect(result.targetId).toBe(target);
    expect(s().workouts[source]).toBeUndefined();
    expect(s().entries[source]).toBeUndefined();
    expect(s().entries[target][bench].weights).toEqual([60]);
    expect(s().entries[target][squat].weights).toEqual([80]);
    expect(s().entries[target][row]).toBeUndefined();

    result.undo();
    expect(s().workouts[source]).toMatchObject({ id: source, date: null });
    expect(s().entries[source][bench].weights).toEqual([10]);
    expect(s().entries[source][squat].weights).toEqual([80]);
    expect(s().entries[target][bench].weights).toEqual([60]);
    expect(s().entries[target][squat]).toBeUndefined();
  });

  it('sets a free date without merging, and clearing it to null works', () => {
    const { s } = setup();
    const w = s().addWorkout(null);
    const r = s().setWorkoutDate(w, '2027-01-02');
    expect(r.merged).toBe(false);
    expect(s().workouts[w].date).toBe('2027-01-02');
    r.undo();
    expect(s().workouts[w].date).toBeNull();
    expect(() => s().setWorkoutDate(w, '2027-13-40')).toThrow();
  });

  it('deleteWorkout removes its entries and undo brings them back', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    const w = s().addWorkout('2026-11-01');
    s().setWeights(w, e, [40, 42.5]);
    const undo = s().deleteWorkout(w);
    expect(s().workouts[w]).toBeUndefined();
    expect(s().entries[w]).toBeUndefined();
    undo();
    expect(s().workouts[w]).toBeDefined();
    expect(s().entries[w][e].weights).toEqual([40, 42.5]);
  });

  it('undo does not discard unrelated later edits', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    const w1 = s().addWorkout('2026-11-01');
    const w2 = s().addWorkout('2026-11-02');
    s().setWeights(w1, e, [40]);
    const undo = s().deleteWorkout(w1);
    s().setWeights(w2, e, [50]);
    undo();
    expect(s().entries[w1][e].weights).toEqual([40]);
    expect(s().entries[w2][e].weights).toEqual([50]);
  });
});

describe('entries', () => {
  it('rounds and clamps weights, and an empty array deletes the entry', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    const w = s().addWorkout('2026-11-01');
    s().setWeights(w, e, [42.456, -5, 5000]);
    expect(s().entries[w][e].weights).toEqual([42.46, 0, 999.99]);
    s().setWeights(w, e, []);
    expect(s().entries[w]).toBeUndefined();
  });

  it('ignores unknown workouts and exercises', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    s().setWeights('nope', e, [10]);
    expect(s().entries).toEqual({});
  });

  it('changing one cell replaces only that workout branch', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    const w1 = s().addWorkout('2026-11-01');
    const w2 = s().addWorkout('2026-11-02');
    s().setWeights(w1, e, [40]);
    s().setWeights(w2, e, [50]);
    const before = s().entries;
    s().setWeights(w1, e, [45]);
    expect(s().entries[w2]).toBe(before[w2]);
    expect(s().entries[w1]).not.toBe(before[w1]);
  });

  it('clearEntry returns an undo', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    const w = s().addWorkout('2026-11-01');
    s().setWeights(w, e, [40]);
    const undo = s().clearEntry(w, e);
    expect(s().entries[w]).toBeUndefined();
    undo();
    expect(s().entries[w][e].weights).toEqual([40]);
  });
});

describe('persistence wiring', () => {
  it('writes changes to the driver and reflects rev in meta', async () => {
    const { s, persist, driver } = setup();
    const e = s().addExercise('Bench', []);
    const w = s().addWorkout('2026-11-01');
    s().setWeights(w, e, [40]);
    await persist.whenIdle();
    expect(driver.tables.entries[w][e].weights).toEqual([40]);
    expect(s().meta.rev).toBeGreaterThan(0);
    expect(driver.tables.meta.rev).toBe(s().meta.rev);
  });

  it('hydrate loads what was written and sets hydrated', async () => {
    const first = setup();
    const e = first.s().addExercise('Bench', []);
    first.s().setMeta({ themeMode: 'dark' });
    await first.persist.whenIdle();

    const second = createTestStore();
    second.driver.tables = first.driver.tables;
    await second.store.getState().hydrate();
    expect(second.store.getState().hydrated).toBe(true);
    expect(second.store.getState().exercises[e].name).toBe('Bench');
    expect(second.store.getState().meta.themeMode).toBe('dark');
    expect(second.persist.getRev()).toBe(first.s().meta.rev);
  });

  it('importSnapshot replaces data, keeps theme, and undo restores the previous data', async () => {
    const { s, persist, driver } = setup();
    s().setMeta({ themeMode: 'light' });
    const old = s().addExercise('Old', []);
    const other = createTestStore();
    const fresh = other.store.getState().addExercise('Fresh', []);
    const snapshot: Snapshot = {
      ...structuredCloneSnapshot(other.store.getState()),
    };
    const undo = s().importSnapshot(snapshot);
    await persist.whenIdle();
    expect(s().exercises[old]).toBeUndefined();
    expect(s().exercises[fresh]).toBeDefined();
    expect(s().meta.themeMode).toBe('light');
    expect(driver.tables.exercises[fresh]).toBeDefined();

    undo();
    await persist.whenIdle();
    expect(s().exercises[old]).toBeDefined();
    expect(s().exercises[fresh]).toBeUndefined();
    expect(driver.tables.exercises[old]).toBeDefined();
  });

  it('restores from the safety mirror when the database is empty', async () => {
    const mirrorSnapshot: Snapshot = {
      exercises: [{ id: 'm', name: 'Mirror', sortIndex: 0, archivedAt: null, createdAt: 'x' }],
      groups: [],
      memberships: [],
      workouts: [],
      entries: [],
      meta: { schemaVersion: 1, rev: 9, themeMode: 'dark', activeFilter: 'all', lastBackupAt: null, backupNudgeAt: null },
    };
    const safety: SafetySnapshotStore = {
      read: () => ({ rev: 9, snapshot: mirrorSnapshot }),
      writeNow: () => {},
      schedule: () => {},
      install: () => {},
    };
    const { store, persist, driver } = createTestStore(safety);
    await store.getState().hydrate();
    await persist.whenIdle();
    expect(store.getState().exercises.m.name).toBe('Mirror');
    expect(driver.tables.exercises.m).toBeDefined();
    expect(store.getState().meta.rev).toBeGreaterThanOrEqual(9);
  });
});

describe('virtual columns', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 15, 12));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates the workout and the entry in one commit from the today draft', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    s().setWeights('DT', e, [50]);
    expect(s().workouts.DT).toMatchObject({ id: 'DT', date: '2026-11-15' });
    expect(s().entries.DT[e].weights).toEqual([50]);
    expect(useUi.getState().draftIds.today).not.toBe('DT');
    expect(useUi.getState().draftIds.undated).toBe('DU');
  });

  it('writes both rows in a single commit', () => {
    const { s, persist } = setup();
    const e = s().addExercise('Bench', []);
    const enqueue = jest.spyOn(persist, 'enqueue');
    s().setWeights('DT', e, [50]);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toHaveLength(2);
  });

  it('creates an undated workout from the undated draft', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    s().setWeights('DU', e, [20]);
    expect(s().workouts.DU).toMatchObject({ id: 'DU', date: null });
    expect(useUi.getState().draftIds.undated).not.toBe('DU');
  });

  it('creates nothing for empty or invalid weights', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    s().setWeights('DT', e, []);
    s().setWeights('DT', e, [NaN]);
    expect(s().workouts).toEqual({});
    expect(useUi.getState().draftIds.today).toBe('DT');
  });

  it('creates nothing when today already has a workout or the id is unknown', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    s().addWorkout('2026-11-15');
    s().setWeights('DT', e, [50]);
    s().setWeights('unknown', e, [50]);
    expect(Object.keys(s().workouts)).toHaveLength(1);
    expect(s().entries).toEqual({});
  });

  it('pruneEmptyWorkouts removes empty past and undated workouts only', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    const past = s().addWorkout('2026-11-01');
    const undated = s().addWorkout(null);
    const today = s().addWorkout('2026-11-15');
    const future = s().addWorkout('2026-11-20');
    const filled = s().addWorkout('2026-11-02');
    const open = s().addWorkout('2026-11-03');
    s().setWeights(filled, e, [10]);
    useUi.setState({ selectedCell: { workoutId: open, exerciseId: e } });
    s().pruneEmptyWorkouts('2026-11-15');
    expect(Object.keys(s().workouts).sort()).toEqual([today, future, filled, open].sort());
    expect(s().workouts[past]).toBeUndefined();
    expect(s().workouts[undated]).toBeUndefined();
  });

  it('hydrate prunes an empty past workout', async () => {
    const first = setup();
    first.s().addWorkout('2026-11-01');
    const keep = first.s().addWorkout('2026-11-16');
    await first.persist.whenIdle();
    const second = createTestStore();
    second.driver.tables = first.driver.tables;
    await second.store.getState().hydrate();
    expect(Object.keys(second.store.getState().workouts)).toEqual([keep]);
  });

  it('importSnapshot drops empty workouts and renews the draft ids', () => {
    const { s } = setup();
    const other = createTestStore();
    const o = other.store.getState();
    const e = o.addExercise('Bench', []);
    const empty = o.addWorkout('2026-11-01');
    const filled = o.addWorkout('2026-11-02');
    const future = o.addWorkout('2026-11-30');
    o.setWeights(filled, e, [10]);
    const state = other.store.getState();
    s().importSnapshot({
      exercises: Object.values(state.exercises),
      groups: [],
      memberships: [],
      workouts: Object.values(state.workouts),
      entries: Object.values(state.entries).flatMap((byExercise) => Object.values(byExercise)),
      meta: state.meta,
    });
    expect(Object.keys(s().workouts).sort()).toEqual([filled, future].sort());
    expect(s().workouts[empty]).toBeUndefined();
    expect(useUi.getState().draftIds.today).not.toBe('DT');
  });

  it('refuses to undo a delete when the date has been taken, with a message', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    const w = s().addWorkout('2026-11-15');
    s().setWeights(w, e, [40]);
    const undo = s().deleteWorkout(w);
    s().setWeights('DT', e, [50]); // the virtual today becomes a new workout
    undo();
    expect(s().workouts[w]).toBeUndefined();
    expect(Object.values(s().workouts).filter((x) => x.date === '2026-11-15')).toHaveLength(1);
    expect(useUi.getState().snackbar?.text).toContain('already has a workout');
  });

  it('refuses to undo a date change when the old date has been taken', () => {
    const { s } = setup();
    const w = s().addWorkout('2026-11-10');
    const result = s().setWorkoutDate(w, '2026-11-12');
    s().addWorkout('2026-11-10');
    result.undo();
    expect(s().workouts[w].date).toBe('2026-11-12');
    expect(useUi.getState().snackbar?.text).toContain('already has a workout');
  });

  it('clearEntry undo does nothing when the workout is gone', () => {
    const { s } = setup();
    const e = s().addExercise('Bench', []);
    const w = s().addWorkout('2026-11-01');
    s().setWeights(w, e, [40]);
    const undo = s().clearEntry(w, e);
    s().pruneEmptyWorkouts('2026-11-15');
    expect(s().workouts[w]).toBeUndefined();
    undo();
    expect(s().entries[w]).toBeUndefined();
  });
});

function structuredCloneSnapshot(state: ReturnType<ReturnType<typeof createTestStore>['store']['getState']>): Snapshot {
  return {
    exercises: Object.values(state.exercises),
    groups: [],
    memberships: [],
    workouts: [],
    entries: [],
    meta: state.meta,
  };
}
