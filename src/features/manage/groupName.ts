import type { Group } from '../../data/types';

export type GroupNameProblem = 'empty' | 'duplicate';

const normalize = (name: string) => name.trim().toLowerCase();

/**
 * Checks a group name: it must not be empty and must not repeat another group's name (case and
 * surrounding spaces are ignored). `selfId` is the group being renamed.
 */
export function checkGroupName(
  name: string,
  groups: Readonly<Record<string, Group>>,
  selfId: string | null,
): GroupNameProblem | null {
  const wanted = normalize(name);
  if (wanted === '') return 'empty';
  for (const group of Object.values(groups)) {
    if (group.id !== selfId && normalize(group.name) === wanted) return 'duplicate';
  }
  return null;
}
