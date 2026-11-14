import type { DataSlice } from '../../data/selectors';

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Names of the groups an exercise belongs to, in chip order (creation time), joined for one line.
 * Returns a string, so it can be used directly as a `useData` selector.
 */
export function groupNamesFor(state: Pick<DataSlice, 'groups' | 'memberships'>, exerciseId: string): string {
  return Object.values(state.groups)
    .filter((group) => state.memberships[group.id]?.[exerciseId] !== undefined)
    .sort((a, b) => cmp(a.createdAt, b.createdAt) || cmp(a.id, b.id))
    .map((group) => group.name)
    .join(', ');
}
