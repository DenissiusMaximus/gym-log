import { createTestStore } from '../../data/testUtils';
import { groupNamesFor } from './groupLabels';

describe('groupNamesFor', () => {
  it('lists the groups of an exercise and is empty without groups', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    const a = s().addGroup('Push');
    const b = s().addGroup('Legs');
    const press = s().addExercise('Bench press', [b, a]);
    const squat = s().addExercise('Squat', [b]);
    const curl = s().addExercise('Curl', []);

    expect(groupNamesFor(s(), press)).toBe('Push, Legs');
    expect(groupNamesFor(s(), squat)).toBe('Legs');
    expect(groupNamesFor(s(), curl)).toBe('');
  });
});
