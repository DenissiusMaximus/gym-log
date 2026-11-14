import { addDays, todayStr } from '../lib/date';
import { round2 } from '../lib/format';
import { newId } from './ids';
import { emptySnapshot } from './ops';
import type { Entry, Exercise, Group, Membership, Snapshot, Workout } from './types';

/** Deterministic PRNG so demo data is reproducible in tests. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  'Bench press',
  'Squat',
  'Deadlift',
  'Overhead press',
  'Barbell row',
  'Pull-up',
  'Dip',
  'Leg press',
  'Incline bench',
  'Romanian deadlift',
  'Lat pulldown',
  'Cable row',
  'Biceps curl',
  'Triceps extension',
  'Lateral raise',
  'Face pull',
  'Leg curl',
  'Leg extension',
  'Calf raise',
  'Hip thrust',
];

/**
 * Generates dated workouts ending today (1-3 days apart), with about half of the cells
 * filled, weights in steps, 10% of entries with 2-4 sets, and 3 groups.
 */
export function generateDemo(exerciseCount = 40, workoutCount = 300, seed = 1): Snapshot {
  const random = mulberry32(seed);
  const pick = (n: number) => Math.floor(random() * n);
  const stamp = new Date().toISOString();

  const exercises: Exercise[] = Array.from({ length: exerciseCount }, (_, i) => ({
    id: newId(),
    name: i < NAMES.length ? NAMES[i] : `${NAMES[i % NAMES.length]} ${Math.floor(i / NAMES.length) + 1}`,
    sortIndex: i,
    archivedAt: null,
    createdAt: stamp,
  }));

  const groups: Group[] = ['Push', 'Pull', 'Legs'].map((name) => ({ id: newId(), name, createdAt: stamp }));
  const memberships: Membership[] = [];
  const counters = groups.map(() => 0);
  exercises.forEach((exercise, i) => {
    const g = i % groups.length;
    memberships.push({ groupId: groups[g].id, exerciseId: exercise.id, position: counters[g]++ });
  });

  // Dates go backwards from today so the newest workout is today.
  const dates: string[] = [];
  let date = todayStr();
  for (let i = 0; i < workoutCount; i++) {
    dates.push(date);
    date = addDays(date, -(1 + pick(3)));
  }
  dates.reverse();
  const workouts: Workout[] = dates.map((d) => ({ id: newId(), date: d, createdAt: stamp }));

  // Each exercise starts at a base weight and grows in 2.5 kg steps over the workouts.
  const base = exercises.map(() => 20 + pick(16) * 5);
  const entries: Entry[] = [];
  workouts.forEach((workout, w) => {
    exercises.forEach((exercise, e) => {
      if (random() >= 0.5) return;
      const top = round2(base[e] + Math.floor((w / workoutCount) * 8) * 2.5);
      const sets = random() < 0.1 ? 2 + pick(3) : 1;
      const weights = Array.from({ length: sets }, (_, s) => round2(top + s * 2.5));
      entries.push({ workoutId: workout.id, exerciseId: exercise.id, weights, updatedAt: stamp });
    });
  });

  return { ...emptySnapshot(), exercises, groups, memberships, workouts, entries };
}
