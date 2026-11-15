import { selectColumnIds, selectPrevious, selectRowIds, selectSeries } from './selectors';
import { createTestStore } from './testUtils';

const drafts = { today: 'DT', undated: 'DU' };

function setup() {
  const { store } = createTestStore();
  const s = () => store.getState();
  return { s };
}

describe('selectRowIds', () => {
  it('lists active exercises by sortIndex and group members by position', () => {
    const { s } = setup();
    const g = s().addGroup('G');
    const a = s().addExercise('A', []);
    const b = s().addExercise('B', [g]);
    const c = s().addExercise('C', [g]);
    s().archiveExercise(a);
    expect(selectRowIds(s(), 'all')).toEqual([b, c]);
    s().reorder(g, [c, b]);
    expect(selectRowIds(s(), g)).toEqual([c, b]);
    expect(selectRowIds(s(), 'missing')).toEqual([]);
  });

  it('returns the same array while the result is element-wise equal', () => {
    const { s } = setup();
    const a = s().addExercise('A', []);
    const first = selectRowIds(s(), 'all');
    expect(selectRowIds(s(), 'all')).toBe(first);
    s().updateExercise(a, { name: 'A2' }); // exercises changed identity, result did not
    expect(selectRowIds(s(), 'all')).toBe(first);
    s().addExercise('B', []);
    expect(selectRowIds(s(), 'all')).not.toBe(first);
  });
});

describe('selectColumnIds', () => {
  it('orders dated workouts ascending, then undated by creation', () => {
    const { s } = setup();
    const late = s().addWorkout('2026-11-10');
    const undated = s().addWorkout(null);
    const early = s().addWorkout('2026-11-01');
    expect(selectColumnIds(s(), 'all', '2026-11-14', drafts)).toEqual([early, late, 'DT', undated]);
  });

  it('in a group shows workouts with a group entry, empty workouts and today', () => {
    const { s } = setup();
    const g = s().addGroup('Push');
    const push = s().addExercise('Bench', [g]);
    const legs = s().addExercise('Squat', []);
    const withPush = s().addWorkout('2026-11-01');
    const legsOnly = s().addWorkout('2026-11-02');
    const empty = s().addWorkout('2026-11-03');
    const today = s().addWorkout('2026-11-14');
    s().setWeights(withPush, push, [50]);
    s().setWeights(legsOnly, legs, [100]);
    s().setWeights(today, legs, [100]); // today has no group entry but is still shown

    expect(selectColumnIds(s(), g, '2026-11-14', drafts)).toEqual([withPush, empty, today, 'DU']);
    expect(selectColumnIds(s(), g, '2026-11-14', drafts)).not.toContain(legsOnly);
    expect(selectColumnIds(s(), 'all', '2026-11-14', drafts)).toHaveLength(5);
  });

  it('with no data shows only the two virtual columns', () => {
    const { s } = setup();
    expect(selectColumnIds(s(), 'all', '2026-11-14', drafts)).toEqual(['DT', 'DU']);
  });

  it('puts the virtual today between past and future or undated columns', () => {
    const { s } = setup();
    const past = s().addWorkout('2026-11-01');
    const future = s().addWorkout('2026-11-20');
    const undated = s().addWorkout(null);
    expect(selectColumnIds(s(), 'all', '2026-11-14', drafts)).toEqual([past, 'DT', future, undated]);
  });

  it('does not add a draft twice once a workout holds its id or date', () => {
    const { s } = setup();
    const real = s().addWorkout('2026-11-14');
    expect(selectColumnIds(s(), 'all', '2026-11-14', drafts)).toEqual([real, 'DU']);
    expect(selectColumnIds(s(), 'all', '2026-11-14', { today: real, undated: 'DU' })).toEqual([real, 'DU']);
  });

  it('in a group shows the virtual columns and undated workouts, not dated ones with foreign entries only', () => {
    const { s } = setup();
    const g = s().addGroup('Push');
    s().addExercise('Bench', [g]);
    const legs = s().addExercise('Squat', []);
    const undatedForeign = s().addWorkout(null);
    const datedForeign = s().addWorkout('2026-11-02');
    s().setWeights(undatedForeign, legs, [100]);
    s().setWeights(datedForeign, legs, [100]);
    const ids = selectColumnIds(s(), g, '2026-11-14', drafts);
    expect(ids).toEqual(['DT', undatedForeign]);
  });

  it('returns the same array until the drafts change', () => {
    const { s } = setup();
    const first = selectColumnIds(s(), 'all', '2026-11-14', drafts);
    expect(selectColumnIds(s(), 'all', '2026-11-14', { ...drafts })).toBe(first);
    expect(selectColumnIds(s(), 'all', '2026-11-14', { today: 'DT2', undated: 'DU' })).not.toBe(first);
  });

  it('keeps array identity when unrelated data changes', () => {
    const { s } = setup();
    const e = s().addExercise('A', []);
    const w = s().addWorkout('2026-11-01');
    const first = selectColumnIds(s(), 'all', '2026-11-14', drafts);
    s().setWeights(w, e, [10]);
    expect(selectColumnIds(s(), 'all', '2026-11-14', drafts)).toBe(first);
  });
});

describe('selectPrevious', () => {
  it('finds the latest earlier dated workout with an entry', () => {
    const { s } = setup();
    const e = s().addExercise('A', []);
    const w1 = s().addWorkout('2026-11-01');
    const w2 = s().addWorkout('2026-11-05');
    const w3 = s().addWorkout('2026-11-09');
    const none = s().addWorkout('2026-11-07');
    s().setWeights(w1, e, [40]);
    s().setWeights(w2, e, [45, 47.5]);
    s().setWeights(w3, e, [50]);
    expect(selectPrevious(s(), e, w3)).toEqual({ weights: [45, 47.5], date: '2026-11-05' });
    expect(selectPrevious(s(), e, none)).toEqual({ weights: [45, 47.5], date: '2026-11-05' });
    expect(selectPrevious(s(), e, w1)).toBeNull();
  });

  it('for an undated workout uses the latest dated one', () => {
    const { s } = setup();
    const e = s().addExercise('A', []);
    const w1 = s().addWorkout('2026-11-01');
    const w2 = s().addWorkout('2026-11-05');
    const undated = s().addWorkout(null);
    s().setWeights(w1, e, [40]);
    s().setWeights(w2, e, [45]);
    s().setWeights(undated, e, [99]);
    expect(selectPrevious(s(), e, undated)).toEqual({ weights: [45], date: '2026-11-05' });
  });
});

describe('selectPrevious with a virtual column', () => {
  it('uses the fallback date when the workout does not exist yet', () => {
    const { s } = setup();
    const e = s().addExercise('A', []);
    const w1 = s().addWorkout('2026-11-01');
    const w2 = s().addWorkout('2026-11-20');
    s().setWeights(w1, e, [40]);
    s().setWeights(w2, e, [60]);
    expect(selectPrevious(s(), e, 'DT', '2026-11-14')).toEqual({ weights: [40], date: '2026-11-01' });
    expect(selectPrevious(s(), e, 'DU')).toEqual({ weights: [60], date: '2026-11-20' });
  });
});

describe('selectSeries', () => {
  it('returns dated points ascending with avg and max', () => {
    const { s } = setup();
    const e = s().addExercise('A', []);
    const w2 = s().addWorkout('2026-11-05');
    const w1 = s().addWorkout('2026-11-01');
    const undated = s().addWorkout(null);
    s().setWeights(w2, e, [40, 50]);
    s().setWeights(w1, e, [30]);
    s().setWeights(undated, e, [70]);
    expect(selectSeries(s(), e)).toEqual([
      { date: '2026-11-01', avg: 30, max: 30, weights: [30] },
      { date: '2026-11-05', avg: 45, max: 50, weights: [40, 50] },
    ]);
  });
});
