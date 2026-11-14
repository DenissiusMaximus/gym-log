import { selectColumnIds, selectPrevious, selectRowIds, selectSeries } from './selectors';
import { createTestStore } from './testUtils';

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
    expect(selectColumnIds(s(), 'all', '2026-11-14')).toEqual([early, late, undated]);
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

    expect(selectColumnIds(s(), g, '2026-11-14')).toEqual([withPush, empty, today]);
    expect(selectColumnIds(s(), g, '2026-11-14')).not.toContain(legsOnly);
    expect(selectColumnIds(s(), 'all', '2026-11-14')).toHaveLength(4);
  });

  it('keeps array identity when unrelated data changes', () => {
    const { s } = setup();
    const e = s().addExercise('A', []);
    const w = s().addWorkout('2026-11-01');
    const first = selectColumnIds(s(), 'all', '2026-11-14');
    s().setWeights(w, e, [10]);
    expect(selectColumnIds(s(), 'all', '2026-11-14')).toBe(first);
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
