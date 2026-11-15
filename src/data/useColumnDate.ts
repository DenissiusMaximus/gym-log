import { useData } from './useData';
import { useUi } from './useUi';

/** Date of a table column; works for virtual columns too ("today" draft -> today, otherwise no date). */
export function useColumnDate(id: string): string | null {
  const stored = useData((s) => {
    const workout = s.workouts[id];
    return workout ? workout.date : undefined;
  });
  const draft = useUi((s) => (s.draftIds.today === id ? s.today : null));
  return stored !== undefined ? stored : draft;
}
