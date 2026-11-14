import { createTestStore } from '../../data/testUtils';
import { checkGroupName } from './groupName';

function setup() {
  const { store } = createTestStore();
  const s = () => store.getState();
  const day1 = s().addGroup('Day 1: chest + triceps');
  return { s, day1 };
}

describe('checkGroupName', () => {
  it('rejects an empty or blank name', () => {
    const { s } = setup();
    expect(checkGroupName('', s().groups, null)).toBe('empty');
    expect(checkGroupName('   ', s().groups, null)).toBe('empty');
  });

  it('rejects a duplicate ignoring case and surrounding spaces', () => {
    const { s } = setup();
    expect(checkGroupName('day 1: CHEST + triceps', s().groups, null)).toBe('duplicate');
    expect(checkGroupName('  Day 1: chest + triceps ', s().groups, null)).toBe('duplicate');
  });

  it('accepts a different name', () => {
    const { s } = setup();
    expect(checkGroupName('Day 2: back', s().groups, null)).toBeNull();
  });

  it('lets a group keep its own name when renaming', () => {
    const { s, day1 } = setup();
    expect(checkGroupName('DAY 1: chest + triceps', s().groups, day1)).toBeNull();
  });
});
