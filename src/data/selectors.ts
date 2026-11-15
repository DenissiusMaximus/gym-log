import type { Tables } from './ops';
import type { DraftIds } from './useUi';
import { activeDraftDate } from './virtualColumns';

export type DataSlice = Pick<Tables, 'exercises' | 'groups' | 'memberships' | 'workouts' | 'entries'>;

export type Previous = { weights: number[]; date: string };
export type SeriesPoint = { date: string; avg: number; max: number; weights: number[] };

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

type CacheEntry<T> = { deps: unknown[]; result: T };

/**
 * Recomputes only when an input branch changed identity, and even then returns the previous
 * array when the new one is element-wise equal, so React sees a stable reference.
 */
function memo<T extends string[]>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  deps: unknown[],
  compute: () => T,
): T {
  const hit = cache.get(key);
  if (hit && hit.deps.length === deps.length && hit.deps.every((d, i) => d === deps[i])) {
    return hit.result;
  }
  const next = compute();
  const result =
    hit && hit.result.length === next.length && hit.result.every((v, i) => v === next[i])
      ? hit.result
      : next;
  cache.set(key, { deps, result });
  return result;
}

const rowCache = new Map<string, CacheEntry<string[]>>();
const columnCache = new Map<string, CacheEntry<string[]>>();

/** Active exercises: by `sortIndex` for 'all', by group position for a group. */
export function selectRowIds(state: DataSlice, filter: string): string[] {
  return memo(rowCache, filter, [state.exercises, state.memberships], () => {
    const exercises = state.exercises;
    if (filter === 'all') {
      return Object.values(exercises)
        .filter((e) => e.archivedAt === null)
        .sort((a, b) => a.sortIndex - b.sortIndex || cmp(a.createdAt, b.createdAt) || cmp(a.id, b.id))
        .map((e) => e.id);
    }
    const members = state.memberships[filter] ?? {};
    return Object.entries(members)
      .filter(([exerciseId]) => exercises[exerciseId] && exercises[exerciseId].archivedAt === null)
      .sort((a, b) => a[1] - b[1] || cmp(a[0], b[0]))
      .map(([exerciseId]) => exerciseId);
  });
}

/** Dated workouts ascending by date, then undated ones by creation time. */
function orderedWorkoutIds(state: DataSlice): string[] {
  const all = Object.values(state.workouts);
  const byCreated = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
    cmp(a.createdAt, b.createdAt) || cmp(a.id, b.id);
  const dated = all
    .filter((w) => w.date !== null)
    .sort((a, b) => cmp(a.date as string, b.date as string) || byCreated(a, b));
  const undated = all.filter((w) => w.date === null).sort(byCreated);
  return [...dated, ...undated].map((w) => w.id);
}

/**
 * Table columns. For a group a workout is shown if it has an entry for one of the group's
 * exercises, or no entries at all (a fresh column must be visible), or is dated today, or has
 * no date. The two virtual columns (`draftIds`) are added while they are active: "today" goes
 * before the first column with no date or a later date, "no date" goes last.
 */
export function selectColumnIds(state: DataSlice, filter: string, today: string, draftIds: DraftIds): string[] {
  return memo(
    columnCache,
    `${filter}|${today}`,
    [state.workouts, state.entries, state.exercises, state.memberships, draftIds.today, draftIds.undated],
    () => {
      const ids = orderedWorkoutIds(state);
      const real =
        filter === 'all'
          ? ids
          : ids.filter((id) => {
              const workout = state.workouts[id];
              if (workout.date === null || workout.date === today) return true;
              const byExercise = state.entries[id];
              if (!byExercise) return true;
              const rowIds = selectRowIds(state, filter);
              return rowIds.some((exerciseId) => byExercise[exerciseId] !== undefined);
            });
      const result = [...real];
      if (activeDraftDate(state.workouts, draftIds, today, draftIds.today) !== undefined) {
        const at = result.findIndex((id) => {
          const date = state.workouts[id].date;
          return date === null || date > today;
        });
        result.splice(at === -1 ? result.length : at, 0, draftIds.today);
      }
      if (activeDraftDate(state.workouts, draftIds, today, draftIds.undated) !== undefined) {
        result.push(draftIds.undated);
      }
      return result;
    },
  );
}

/**
 * Latest dated workout before the current one that has an entry for the exercise. A virtual
 * column has no workout yet, so its date is passed as `fallbackDate`.
 */
export function selectPrevious(
  state: DataSlice,
  exerciseId: string,
  workoutId: string,
  fallbackDate: string | null = null,
): Previous | null {
  const currentDate = state.workouts[workoutId] ? state.workouts[workoutId].date : fallbackDate;
  let best: Previous | null = null;
  for (const workout of Object.values(state.workouts)) {
    if (workout.date === null || workout.id === workoutId) continue;
    if (currentDate !== null && workout.date >= currentDate) continue;
    const entry = state.entries[workout.id]?.[exerciseId];
    if (!entry) continue;
    if (!best || workout.date > best.date) best = { weights: entry.weights, date: workout.date };
  }
  return best;
}

/** One point per dated workout with an entry, ascending by date. */
export function selectSeries(state: DataSlice, exerciseId: string): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const workout of Object.values(state.workouts)) {
    if (workout.date === null) continue;
    const entry = state.entries[workout.id]?.[exerciseId];
    if (!entry) continue;
    const sum = entry.weights.reduce((a, b) => a + b, 0);
    points.push({
      date: workout.date,
      avg: sum / entry.weights.length,
      max: Math.max(...entry.weights),
      weights: entry.weights,
    });
  }
  return points.sort((a, b) => cmp(a.date, b.date));
}

/** What a table cell shows: the heaviest set. */
export function cellValue(weights: number[]): number {
  return Math.max(...weights);
}
