import type { DraftIds } from './useUi';

type WorkoutsById = Record<string, { date: string | null }>;

/**
 * Date of the virtual column `id`, or `undefined` if `id` is not an active draft. A draft is
 * active while no workout with its id exists and no workout already holds its date: "today"
 * is `today`, "no date" is `null`.
 */
export function activeDraftDate(
  workouts: WorkoutsById,
  draftIds: DraftIds,
  today: string,
  id: string,
): string | null | undefined {
  if (workouts[id]) return undefined;
  let date: string | null;
  if (id === draftIds.today) date = today;
  else if (id === draftIds.undated) date = null;
  else return undefined;
  for (const workout of Object.values(workouts)) if (workout.date === date) return undefined;
  return date;
}

/** Date of a column: the workout's own, `today` for the "today" draft, otherwise `null`. */
export function columnDate(workouts: WorkoutsById, draftIds: DraftIds, today: string, id: string): string | null {
  const workout = workouts[id];
  if (workout) return workout.date;
  return draftIds.today === id ? today : null;
}
