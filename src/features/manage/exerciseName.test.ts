import { createTestStore } from '../../data/testUtils';
import { checkExerciseName } from './exerciseName';

function setup() {
  const { store } = createTestStore();
  const s = () => store.getState();
  const bench = s().addExercise('Bench press', []);
  return { s, bench };
}

describe('checkExerciseName', () => {
  it('rejects an empty or blank name', () => {
    const { s } = setup();
    expect(checkExerciseName('', s().exercises, null)).toBe('empty');
    expect(checkExerciseName('   ', s().exercises, null)).toBe('empty');
  });

  it('rejects a duplicate ignoring case and surrounding spaces', () => {
    const { s } = setup();
    expect(checkExerciseName('Bench press', s().exercises, null)).toBe('duplicate');
    expect(checkExerciseName('  bench PRESS ', s().exercises, null)).toBe('duplicate');
  });

  it('accepts a different name', () => {
    const { s } = setup();
    expect(checkExerciseName('Squat', s().exercises, null)).toBeNull();
    expect(checkExerciseName('Bench  press', s().exercises, null)).toBeNull();
  });

  it('lets an exercise keep its own name', () => {
    const { s, bench } = setup();
    expect(checkExerciseName('bench press', s().exercises, bench)).toBeNull();
  });

  it('ignores archived exercises', () => {
    const { s, bench } = setup();
    s().archiveExercise(bench);
    expect(checkExerciseName('Bench press', s().exercises, null)).toBeNull();
  });
});
