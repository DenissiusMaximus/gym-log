import type { Exercise } from '../../data/types';

export type NameProblem = 'empty' | 'duplicate';

const normalize = (name: string) => name.trim().toLowerCase();

/**
 * Checks an exercise name: it must not be empty and must not repeat the name of another active
 * exercise (case and surrounding spaces are ignored). `selfId` is the exercise being edited.
 */
export function checkExerciseName(
  name: string,
  exercises: Readonly<Record<string, Exercise>>,
  selfId: string | null,
): NameProblem | null {
  const wanted = normalize(name);
  if (wanted === '') return 'empty';
  for (const exercise of Object.values(exercises)) {
    if (exercise.id === selfId || exercise.archivedAt !== null) continue;
    if (normalize(exercise.name) === wanted) return 'duplicate';
  }
  return null;
}
