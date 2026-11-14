// Pure state machine of the weight entry panel (plan 8.5). The panel component only feeds it key
// presses and writes `weights` to the store whenever they change.
import { formatWeight, MAX_WEIGHT, parseWeight, round2 } from '../../lib/format';

export type NumpadState = {
  /** Weights of the entry as saved; an empty array means there is no entry yet. */
  weights: number[];
  /** Index of the active set. */
  active: number;
  /** Typed text. `null` is replace mode: the next digit starts a new number. */
  buf: string | null;
  /** Value of the previous workout, the base for +/- and the ghost value while there is no entry. */
  previous: number | null;
};

export type NumpadAction =
  | { type: 'digit'; digit: string }
  | { type: 'point' }
  | { type: 'backspace' }
  | { type: 'step'; delta: 1 | -1 }
  | { type: 'addSet' }
  | { type: 'removeSet' }
  | { type: 'selectSet'; index: number }
  | { type: 'copyPrevious'; weights: readonly number[] }
  | { type: 'clear' };

export const MAX_INT_DIGITS = 3;
export const MAX_FRACTION_DIGITS = 2;

/** State right after the panel opens (or switches to another cell): replace mode, first set. */
export function createNumpadState(weights: readonly number[], previous: number | null): NumpadState {
  return { weights: [...weights], active: 0, buf: null, previous };
}

/** The single number that stands for a previous workout with several sets: the heaviest, as in the table. */
export function previousValue(weights: readonly number[] | undefined): number | null {
  return weights && weights.length > 0 ? Math.max(...weights) : null;
}

function withActive(state: NumpadState, value: number): number[] {
  if (state.weights.length === 0) return [value];
  return state.weights.map((w, i) => (i === state.active ? value : w));
}

/** Text after pressing a digit, or null when the limits (3 integer, 2 fraction digits) reject it. */
function appendDigit(buf: string | null, digit: string): string | null {
  if (buf === null) return digit;
  const point = buf.indexOf('.');
  if (point === -1) {
    // A lone zero is replaced, so "0" then "5" gives "5" and never "05".
    if (buf === '0') return digit;
    return buf.length >= MAX_INT_DIGITS ? null : buf + digit;
  }
  return buf.length - point - 1 >= MAX_FRACTION_DIGITS ? null : buf + digit;
}

export function numpadReduce(state: NumpadState, action: NumpadAction): NumpadState {
  const { weights, active, buf, previous } = state;
  const hasEntry = weights.length > 0;

  switch (action.type) {
    case 'digit': {
      const next = appendDigit(buf, action.digit);
      if (next === null) return state;
      const value = parseWeight(next);
      if (value === null) return state;
      return { ...state, buf: next, weights: withActive(state, value) };
    }
    case 'point': {
      // The decimal point alone never saves anything: "0." is still the old value.
      if (buf === null || buf === '') return { ...state, buf: '0.' };
      if (buf.includes('.')) return state;
      return { ...state, buf: `${buf}.` };
    }
    case 'backspace': {
      // With no entry and nothing typed there is nothing to erase (and nothing may be created).
      if (buf === null && !hasEntry) return state;
      const source = buf ?? formatWeight(weights[active]);
      const next = source.slice(0, -1);
      const value = parseWeight(next);
      // An empty buffer saves and deletes nothing: the last valid value stays.
      if (value === null || !hasEntry) return { ...state, buf: next };
      return { ...state, buf: next, weights: withActive(state, value) };
    }
    case 'step': {
      const base = hasEntry ? weights[active] : (previous ?? 0);
      const value = Math.min(MAX_WEIGHT, Math.max(0, round2(base + action.delta)));
      return { ...state, buf: null, weights: withActive(state, value) };
    }
    case 'addSet': {
      if (!hasEntry) return state;
      return { ...state, buf: null, weights: [...weights, weights[active]], active: weights.length };
    }
    case 'removeSet': {
      if (weights.length < 2) return state;
      return {
        ...state,
        buf: null,
        weights: weights.filter((_, i) => i !== active),
        active: Math.min(active, weights.length - 2),
      };
    }
    case 'selectSet': {
      if (action.index < 0 || action.index >= weights.length) return state;
      return { ...state, active: action.index, buf: null };
    }
    case 'copyPrevious': {
      if (action.weights.length === 0) return state;
      return { ...state, weights: [...action.weights], active: 0, buf: null };
    }
    case 'clear':
      return { ...state, weights: [], active: 0, buf: null };
  }
}

export type NumpadDisplay = {
  text: string;
  /** Not saved: the previous value or "0" shown while there is no entry (or the buffer is empty). */
  ghost: boolean;
  /** The next digit replaces the number (the value sits on a highlighted pill). */
  replace: boolean;
};

export function numpadDisplay({ weights, active, buf, previous }: NumpadState): NumpadDisplay {
  if (buf !== null) return { text: buf === '' ? '0' : buf, ghost: buf === '', replace: false };
  if (weights.length > 0) return { text: formatWeight(weights[active]), ghost: false, replace: true };
  return { text: formatWeight(previous ?? 0), ghost: true, replace: false };
}

export function sameWeights(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((w, i) => w === b[i]);
}
