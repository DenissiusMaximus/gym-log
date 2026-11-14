import {
  createNumpadState,
  numpadDisplay,
  numpadReduce,
  previousValue,
  sameWeights,
  type NumpadAction,
  type NumpadState,
} from './numpad';

const run = (state: NumpadState, ...actions: NumpadAction[]) => actions.reduce(numpadReduce, state);
const digits = (text: string): NumpadAction[] =>
  [...text].map((ch): NumpadAction => (ch === '.' ? { type: 'point' } : { type: 'digit', digit: ch }));
const step = (delta: 1 | -1): NumpadAction => ({ type: 'step', delta });

describe('open', () => {
  it('starts in replace mode on the first set', () => {
    const state = createNumpadState([40, 42.5], 30);
    expect(state).toEqual({ weights: [40, 42.5], active: 0, buf: null, previous: 30 });
  });

  it('does not alias the entry weights', () => {
    const source = [40];
    const state = createNumpadState(source, null);
    expect(state.weights).not.toBe(source);
  });
});

describe('digits', () => {
  it('start a new number in replace mode and are saved at once', () => {
    const state = run(createNumpadState([40], null), { type: 'digit', digit: '5' });
    expect(state.buf).toBe('5');
    expect(state.weights).toEqual([5]);
  });

  it('create the entry when there is none', () => {
    const state = run(createNumpadState([], 40), { type: 'digit', digit: '7' });
    expect(state.weights).toEqual([7]);
  });

  it('append to the buffer', () => {
    const state = run(createNumpadState([40], null), ...digits('425'));
    expect(state.buf).toBe('425');
    expect(state.weights).toEqual([425]);
  });

  it('allow at most 3 integer digits', () => {
    const state = run(createNumpadState([], null), ...digits('12345'));
    expect(state.buf).toBe('123');
    expect(state.weights).toEqual([123]);
  });

  it('allow at most 2 fraction digits', () => {
    const state = run(createNumpadState([], null), ...digits('12.3456'));
    expect(state.buf).toBe('12.34');
    expect(state.weights).toEqual([12.34]);
  });

  it('allow the maximum 999.99', () => {
    expect(run(createNumpadState([], null), ...digits('999.99')).weights).toEqual([999.99]);
  });

  it('never produce a leading zero', () => {
    expect(run(createNumpadState([], null), ...digits('05')).buf).toBe('5');
    expect(run(createNumpadState([], null), ...digits('00')).buf).toBe('0');
    expect(run(createNumpadState([], null), ...digits('0.5')).buf).toBe('0.5');
  });

  it('write to the active set only', () => {
    const state = run(createNumpadState([40, 50, 60], null), { type: 'selectSet', index: 1 }, ...digits('55'));
    expect(state.weights).toEqual([40, 55, 60]);
  });

  it('ignore a rejected digit without touching the weights', () => {
    const full = run(createNumpadState([], null), ...digits('123'));
    expect(numpadReduce(full, { type: 'digit', digit: '4' })).toBe(full);
  });
});

describe('decimal point', () => {
  it('gives "0." in replace mode and saves nothing', () => {
    const state = run(createNumpadState([40], null), { type: 'point' });
    expect(state.buf).toBe('0.');
    expect(state.weights).toEqual([40]);
  });

  it('does not create an entry', () => {
    const state = run(createNumpadState([], 40), { type: 'point' });
    expect(state.weights).toEqual([]);
  });

  it('is accepted once', () => {
    const state = run(createNumpadState([], null), ...digits('4.'), { type: 'point' });
    expect(state.buf).toBe('4.');
  });

  it('turns an empty buffer into "0."', () => {
    const state = run(createNumpadState([5], null), { type: 'backspace' }, { type: 'point' });
    expect(state.buf).toBe('0.');
  });

  it('keeps the value while "42." is typed', () => {
    const state = run(createNumpadState([], null), ...digits('42.'));
    expect(state.buf).toBe('42.');
    expect(state.weights).toEqual([42]);
  });

  it('continues with fraction digits', () => {
    const state = run(createNumpadState([], null), { type: 'point' }, { type: 'digit', digit: '5' });
    expect(state.buf).toBe('0.5');
    expect(state.weights).toEqual([0.5]);
  });
});

describe('backspace', () => {
  it('removes the last typed character and saves the rest', () => {
    const state = run(createNumpadState([], null), ...digits('42.5'), { type: 'backspace' });
    expect(state.buf).toBe('42.');
    expect(state.weights).toEqual([42]);
  });

  it('in replace mode edits the saved number text', () => {
    const state = run(createNumpadState([42.5], null), { type: 'backspace' });
    expect(state.buf).toBe('42.');
    expect(state.weights).toEqual([42]);
  });

  it('leaves the last valid value when the buffer becomes empty', () => {
    const state = run(createNumpadState([], null), { type: 'digit', digit: '7' }, { type: 'backspace' });
    expect(state.buf).toBe('');
    expect(state.weights).toEqual([7]);
  });

  it('on an empty buffer keeps everything', () => {
    const state = run(createNumpadState([7], null), { type: 'backspace' }, { type: 'backspace' });
    expect(state.buf).toBe('');
    expect(state.weights).toEqual([7]);
  });

  it('does nothing without an entry in replace mode', () => {
    const state = createNumpadState([], 40);
    expect(numpadReduce(state, { type: 'backspace' })).toBe(state);
  });

  it('saves zero when only the point is removed from "0."', () => {
    const state = run(createNumpadState([], null), ...digits('0.'), { type: 'backspace' });
    expect(state.buf).toBe('0');
    expect(state.weights).toEqual([0]);
  });

  it('does not create an entry from a point typed without one', () => {
    const state = run(createNumpadState([], 40), { type: 'point' }, { type: 'backspace' });
    expect(state.buf).toBe('0');
    expect(state.weights).toEqual([]);
  });
});

describe('plus and minus', () => {
  it('step the active set by one and return to replace mode', () => {
    const typed = run(createNumpadState([40], null), ...digits('42'));
    const state = run(typed, step(1));
    expect(state.weights).toEqual([43]);
    expect(state.buf).toBeNull();
  });

  it('keep the fraction', () => {
    expect(run(createNumpadState([42.5], null), step(1)).weights).toEqual([43.5]);
    expect(run(createNumpadState([42.25], null), step(-1)).weights).toEqual([41.25]);
  });

  it('never go below zero', () => {
    expect(run(createNumpadState([0.5], null), step(-1)).weights).toEqual([0]);
    expect(run(createNumpadState([0], null), step(-1)).weights).toEqual([0]);
  });

  it('never exceed the maximum', () => {
    expect(run(createNumpadState([999.5], null), step(1)).weights).toEqual([999.99]);
  });

  it('use the previous value as the base when there is no entry', () => {
    expect(run(createNumpadState([], 40), step(1)).weights).toEqual([41]);
    expect(run(createNumpadState([], 40), step(-1)).weights).toEqual([39]);
  });

  it('use zero as the base without an entry and without a previous value', () => {
    expect(run(createNumpadState([], null), step(1)).weights).toEqual([1]);
    expect(run(createNumpadState([], null), step(-1)).weights).toEqual([0]);
  });

  it('change only the active set', () => {
    const state = run(createNumpadState([40, 50], null), { type: 'selectSet', index: 1 }, step(1));
    expect(state.weights).toEqual([40, 51]);
  });

  it('round float noise', () => {
    expect(run(createNumpadState([0.1], null), step(1), step(1)).weights).toEqual([2.1]);
  });
});

describe('sets', () => {
  it('"+ set" copies the active weight, activates the new set and enters replace mode', () => {
    const state = run(createNumpadState([40], null), { type: 'addSet' });
    expect(state.weights).toEqual([40, 40]);
    expect(state.active).toBe(1);
    expect(state.buf).toBeNull();
  });

  it('"+ set" copies the active set, not the last one', () => {
    const state = run(createNumpadState([40, 50], null), { type: 'addSet' });
    expect(state.weights).toEqual([40, 50, 40]);
    expect(state.active).toBe(2);
  });

  it('"+ set" without an entry does nothing', () => {
    const state = createNumpadState([], 40);
    expect(numpadReduce(state, { type: 'addSet' })).toBe(state);
  });

  it('selecting a set enters replace mode', () => {
    const typed = run(createNumpadState([40, 50], null), ...digits('45'));
    const state = run(typed, { type: 'selectSet', index: 1 });
    expect(state.active).toBe(1);
    expect(state.buf).toBeNull();
  });

  it('ignores an unknown set', () => {
    const state = createNumpadState([40], null);
    expect(numpadReduce(state, { type: 'selectSet', index: 3 })).toBe(state);
  });

  it('removes the active set and keeps the active index valid', () => {
    const last = run(createNumpadState([40, 50, 60], null), { type: 'selectSet', index: 2 }, { type: 'removeSet' });
    expect(last.weights).toEqual([40, 50]);
    expect(last.active).toBe(1);
    const middle = run(createNumpadState([40, 50, 60], null), { type: 'selectSet', index: 1 }, { type: 'removeSet' });
    expect(middle.weights).toEqual([40, 60]);
    expect(middle.active).toBe(1);
  });

  it('never removes the only set', () => {
    const state = createNumpadState([40], null);
    expect(numpadReduce(state, { type: 'removeSet' })).toBe(state);
  });
});

describe('same as last time and clear', () => {
  it('copies all sets of the previous workout', () => {
    const state = run(createNumpadState([], 45), { type: 'copyPrevious', weights: [40, 42.5, 45] });
    expect(state.weights).toEqual([40, 42.5, 45]);
    expect(state.active).toBe(0);
    expect(state.buf).toBeNull();
  });

  it('clear removes the entry and returns to replace mode', () => {
    const typed = run(createNumpadState([40, 50], 30), { type: 'selectSet', index: 1 }, ...digits('4'));
    const state = run(typed, { type: 'clear' });
    expect(state).toEqual({ weights: [], active: 0, buf: null, previous: 30 });
  });
});

describe('display', () => {
  it('shows the previous value as a ghost while there is no entry', () => {
    expect(numpadDisplay(createNumpadState([], 40))).toEqual({ text: '40', ghost: true, replace: false });
    expect(numpadDisplay(createNumpadState([], null))).toEqual({ text: '0', ghost: true, replace: false });
  });

  it('marks replace mode of a saved value', () => {
    expect(numpadDisplay(createNumpadState([42.5], null))).toEqual({ text: '42.5', ghost: false, replace: true });
  });

  it('shows the typed text', () => {
    const state = run(createNumpadState([], null), ...digits('4.'));
    expect(numpadDisplay(state)).toEqual({ text: '4.', ghost: false, replace: false });
  });

  it('shows an empty buffer as a ghost zero', () => {
    const state = run(createNumpadState([5], null), { type: 'backspace' });
    expect(numpadDisplay(state)).toEqual({ text: '0', ghost: true, replace: false });
  });
});

describe('helpers', () => {
  it('previousValue is the heaviest set', () => {
    expect(previousValue([40, 45, 42.5])).toBe(45);
    expect(previousValue([])).toBeNull();
    expect(previousValue(undefined)).toBeNull();
  });

  it('sameWeights compares element-wise', () => {
    expect(sameWeights([1, 2], [1, 2])).toBe(true);
    expect(sameWeights([1, 2], [1, 3])).toBe(false);
    expect(sameWeights([1], [1, 1])).toBe(false);
  });
});
