import { create } from 'zustand';

import { logError } from '../dev/errorLog';
import { isValidDate } from '../lib/date';
import { MAX_WEIGHT, round2 } from '../lib/format';
import { strings } from '../lib/strings';
import { newId } from './ids';
import {
  applyOps,
  emptySnapshot,
  invertOps,
  isEmptySnapshot,
  snapshotFromTables,
  tablesFromSnapshot,
  type Tables,
} from './ops';
import type { Persist } from './persist';
import type { Exercise, Meta, Op, SafetySnapshotStore, Snapshot } from './types';
import { useUi } from './useUi';

export type Undo = () => void;

export type DataActions = {
  /** Loads data from the driver (and the safety mirror on web). Call once at startup. */
  hydrate: () => Promise<void>;

  addExercise: (name: string, groupIds: string[]) => string;
  updateExercise: (id: string, changes: { name?: string; groupIds?: string[] }) => void;
  archiveExercise: (id: string) => void;
  unarchiveExercise: (id: string) => void;
  /** `context` is 'all' or a group id; `orderedIds` is the new order of the active exercises. */
  reorder: (context: string, orderedIds: string[]) => void;

  addGroup: (name: string) => string;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => Undo;
  setGroupMembers: (groupId: string, exerciseIds: string[]) => void;

  /** Returns the id of the new workout, or of the existing one if `date` is already taken. */
  addWorkout: (date: string | null) => string;
  /** Setting a date held by another workout merges this one into it (`merged`, `targetId`). */
  setWorkoutDate: (id: string, date: string | null) => { merged: boolean; targetId: string; undo: Undo };
  deleteWorkout: (id: string) => Undo;

  /** An empty array deletes the entry. */
  setWeights: (workoutId: string, exerciseId: string, weights: number[]) => void;
  clearEntry: (workoutId: string, exerciseId: string) => Undo;

  /** Replaces all data (current `meta` is kept). */
  importSnapshot: (snapshot: Snapshot) => Undo;
  setMeta: (changes: Partial<Omit<Meta, 'rev' | 'schemaVersion'>>) => void;
};

export type DataState = Tables & { hydrated: boolean } & DataActions;

const noop: Undo = () => {};
const now = () => new Date().toISOString();
const cleanWeight = (w: number) => Math.min(MAX_WEIGHT, Math.max(0, round2(w)));

/** Data part of the state as a snapshot (the shape used by drivers and backups). */
export function toSnapshot(state: Tables): Snapshot {
  return snapshotFromTables(state);
}

export type StoreDeps = { persist: Persist; safety: SafetySnapshotStore };

export function createDataStore({ persist, safety }: StoreDeps) {
  const useStore = create<DataState>()((set, get) => {
    const snapshotNow = () => toSnapshot(get());

    function scheduleSafety() {
      safety.schedule(snapshotNow, persist.getStatus() === 'failed' ? 500 : 3000);
    }

    /** Applies operations to memory, queues them for storage and returns an undo closure. */
    function commit(ops: Op[]): Undo {
      if (ops.length === 0) return noop;
      const state = get();
      const inverse = invertOps(state, ops);
      set(applyOps(state, ops));
      persist.enqueue(ops);
      scheduleSafety();
      return () => {
        commit(inverse);
      };
    }

    /** Swaps all data for a snapshot, keeping the live `rev`. */
    function replaceState(snapshot: Snapshot) {
      const next: Snapshot = { ...snapshot, meta: { ...snapshot.meta, rev: get().meta.rev } };
      set(tablesFromSnapshot(next));
      void persist.replaceAll(next);
      safety.writeNow(next);
    }

    persist.setListener({
      onRev: (rev) => set({ meta: { ...get().meta, rev } }),
      onStatus: (status) => {
        useUi.getState().setPersistStatus(status);
        if (status === 'failed') safety.writeNow(snapshotNow());
      },
      onError: (error) => logError('storage', error),
    });

    const nextGroupPosition = (groupId: string) => {
      const positions = Object.values(get().memberships[groupId] ?? {});
      return positions.length ? Math.max(...positions) + 1 : 0;
    };

    const membershipOps = (exerciseId: string, groupIds: string[]): Op[] => {
      const { groups, memberships } = get();
      const wanted = new Set(groupIds.filter((g) => groups[g]));
      const ops: Op[] = [];
      for (const groupId of Object.keys(groups)) {
        const has = memberships[groupId]?.[exerciseId] !== undefined;
        if (has && !wanted.has(groupId)) {
          ops.push({ t: 'del', table: 'memberships', key: [groupId, exerciseId] });
        } else if (!has && wanted.has(groupId)) {
          ops.push({
            t: 'put',
            table: 'memberships',
            row: { groupId, exerciseId, position: nextGroupPosition(groupId) },
          });
        }
      }
      return ops;
    };

    return {
      hydrated: false,
      exercises: {},
      groups: {},
      memberships: {},
      workouts: {},
      entries: {},
      meta: emptySnapshot().meta,

      async hydrate() {
        let db: Snapshot | null = null;
        try {
          db = await persist.open();
        } catch (error) {
          logError('storage-open', error);
        }
        const mirror = safety.read();
        const useMirror =
          mirror !== null &&
          (db === null ||
            (isEmptySnapshot(db) && !isEmptySnapshot(mirror.snapshot)) ||
            mirror.rev > db.meta.rev);

        const source = useMirror && mirror ? mirror.snapshot : db;
        const base = source ?? emptySnapshot();
        const rev = Math.max(db?.meta.rev ?? 0, mirror?.rev ?? 0);
        const snapshot: Snapshot = { ...base, meta: { ...base.meta, rev } };
        persist.init(rev);
        set({ ...tablesFromSnapshot(snapshot), hydrated: true });

        if (db === null) useUi.getState().setPersistStatus('failed');
        if (useMirror) {
          if (db !== null) void persist.replaceAll(snapshot);
          useUi.getState().showSnackbar({ text: strings.data.restoredFromCopy });
        }
        safety.install(snapshotNow);

        const { meta, groups } = get();
        if (meta.activeFilter !== 'all' && !groups[meta.activeFilter]) get().setMeta({ activeFilter: 'all' });
      },

      addExercise(name, groupIds) {
        const id = newId();
        const sortIndexes = Object.values(get().exercises).map((e) => e.sortIndex);
        const exercise: Exercise = {
          id,
          name: name.trim(),
          sortIndex: sortIndexes.length ? Math.max(...sortIndexes) + 1 : 0,
          archivedAt: null,
          createdAt: now(),
        };
        commit([{ t: 'put', table: 'exercises', row: exercise }, ...membershipOps(id, groupIds)]);
        return id;
      },

      updateExercise(id, changes) {
        const exercise = get().exercises[id];
        if (!exercise) return;
        const ops: Op[] = [];
        if (changes.name !== undefined && changes.name.trim() !== exercise.name) {
          ops.push({ t: 'put', table: 'exercises', row: { ...exercise, name: changes.name.trim() } });
        }
        if (changes.groupIds) ops.push(...membershipOps(id, changes.groupIds));
        commit(ops);
      },

      archiveExercise(id) {
        const exercise = get().exercises[id];
        if (!exercise || exercise.archivedAt !== null) return;
        commit([{ t: 'put', table: 'exercises', row: { ...exercise, archivedAt: now() } }]);
      },

      unarchiveExercise(id) {
        const exercise = get().exercises[id];
        if (!exercise || exercise.archivedAt === null) return;
        commit([{ t: 'put', table: 'exercises', row: { ...exercise, archivedAt: null } }]);
      },

      reorder(context, orderedIds) {
        const { exercises, memberships } = get();
        const ops: Op[] = [];
        if (context === 'all') {
          const ordered = orderedIds.filter((id) => exercises[id]);
          const orderedSet = new Set(ordered);
          // Archived exercises go after the active ones so sort indexes never collide.
          const rest = Object.values(exercises)
            .filter((e) => !orderedSet.has(e.id))
            .sort((a, b) => a.sortIndex - b.sortIndex)
            .map((e) => e.id);
          [...ordered, ...rest].forEach((id, index) => {
            if (exercises[id].sortIndex !== index) {
              ops.push({ t: 'put', table: 'exercises', row: { ...exercises[id], sortIndex: index } });
            }
          });
        } else {
          const members = memberships[context] ?? {};
          const ordered = orderedIds.filter((id) => members[id] !== undefined);
          const orderedSet = new Set(ordered);
          const rest = Object.entries(members)
            .filter(([id]) => !orderedSet.has(id))
            .sort((a, b) => a[1] - b[1])
            .map(([id]) => id);
          [...ordered, ...rest].forEach((exerciseId, position) => {
            if (members[exerciseId] !== position) {
              ops.push({ t: 'put', table: 'memberships', row: { groupId: context, exerciseId, position } });
            }
          });
        }
        commit(ops);
      },

      addGroup(name) {
        const id = newId();
        commit([{ t: 'put', table: 'groups', row: { id, name: name.trim(), createdAt: now() } }]);
        return id;
      },

      renameGroup(id, name) {
        const group = get().groups[id];
        if (!group || group.name === name.trim()) return;
        commit([{ t: 'put', table: 'groups', row: { ...group, name: name.trim() } }]);
      },

      deleteGroup(id) {
        const { groups, memberships, meta } = get();
        if (!groups[id]) return noop;
        const ops: Op[] = [{ t: 'del', table: 'groups', key: id }];
        for (const exerciseId of Object.keys(memberships[id] ?? {})) {
          ops.push({ t: 'del', table: 'memberships', key: [id, exerciseId] });
        }
        // The active filter must never point at a missing group.
        if (meta.activeFilter === id) ops.push({ t: 'put', table: 'meta', row: { key: 'activeFilter', value: 'all' } });
        return commit(ops);
      },

      setGroupMembers(groupId, exerciseIds) {
        const { groups, exercises, memberships } = get();
        if (!groups[groupId]) return;
        const current = memberships[groupId] ?? {};
        const wanted = [...new Set(exerciseIds)].filter((id) => exercises[id]);
        const wantedSet = new Set(wanted);
        const ops: Op[] = [];
        for (const exerciseId of Object.keys(current)) {
          if (!wantedSet.has(exerciseId)) ops.push({ t: 'del', table: 'memberships', key: [groupId, exerciseId] });
        }
        let position = nextGroupPosition(groupId);
        for (const exerciseId of wanted) {
          if (current[exerciseId] === undefined) {
            ops.push({ t: 'put', table: 'memberships', row: { groupId, exerciseId, position: position++ } });
          }
        }
        commit(ops);
      },

      addWorkout(date) {
        if (date !== null) {
          if (!isValidDate(date)) throw new Error(`Invalid date: ${date}`);
          const existing = Object.values(get().workouts).find((w) => w.date === date);
          if (existing) return existing.id;
        }
        const id = newId();
        commit([{ t: 'put', table: 'workouts', row: { id, date, createdAt: now() } }]);
        return id;
      },

      setWorkoutDate(id, date) {
        const state = get();
        const workout = state.workouts[id];
        if (!workout || workout.date === date) return { merged: false, targetId: id, undo: noop };
        if (date !== null && !isValidDate(date)) throw new Error(`Invalid date: ${date}`);

        const target = date === null ? undefined : Object.values(state.workouts).find((w) => w.id !== id && w.date === date);
        if (!target) {
          const undo = commit([{ t: 'put', table: 'workouts', row: { ...workout, date } }]);
          return { merged: false, targetId: id, undo };
        }

        // Rule 3: the target keeps its own entries; only missing exercises move over.
        const ops: Op[] = [];
        for (const entry of Object.values(state.entries[id] ?? {})) {
          if (!state.entries[target.id]?.[entry.exerciseId]) {
            ops.push({ t: 'put', table: 'entries', row: { ...entry, workoutId: target.id } });
          }
          ops.push({ t: 'del', table: 'entries', key: [id, entry.exerciseId] });
        }
        ops.push({ t: 'del', table: 'workouts', key: id });
        return { merged: true, targetId: target.id, undo: commit(ops) };
      },

      deleteWorkout(id) {
        const state = get();
        if (!state.workouts[id]) return noop;
        const ops: Op[] = [{ t: 'del', table: 'workouts', key: id }];
        for (const exerciseId of Object.keys(state.entries[id] ?? {})) {
          ops.push({ t: 'del', table: 'entries', key: [id, exerciseId] });
        }
        return commit(ops);
      },

      setWeights(workoutId, exerciseId, weights) {
        const state = get();
        if (!state.workouts[workoutId] || !state.exercises[exerciseId]) return;
        if (weights.length === 0) {
          if (state.entries[workoutId]?.[exerciseId]) {
            commit([{ t: 'del', table: 'entries', key: [workoutId, exerciseId] }]);
          }
          return;
        }
        const cleaned = weights.filter(Number.isFinite).map(cleanWeight);
        if (cleaned.length === 0) return;
        const existing = state.entries[workoutId]?.[exerciseId];
        if (existing && existing.weights.length === cleaned.length && existing.weights.every((w, i) => w === cleaned[i])) {
          return;
        }
        commit([
          { t: 'put', table: 'entries', row: { workoutId, exerciseId, weights: cleaned, updatedAt: now() } },
        ]);
      },

      clearEntry(workoutId, exerciseId) {
        if (!get().entries[workoutId]?.[exerciseId]) return noop;
        return commit([{ t: 'del', table: 'entries', key: [workoutId, exerciseId] }]);
      },

      importSnapshot(snapshot) {
        const previous = toSnapshot(get());
        const { meta } = get();
        const filterOk = meta.activeFilter === 'all' || snapshot.groups.some((g) => g.id === meta.activeFilter);
        replaceState({ ...snapshot, meta: { ...meta, activeFilter: filterOk ? meta.activeFilter : 'all' } });
        return () => replaceState({ ...previous, meta: get().meta });
      },

      setMeta(changes) {
        const meta = get().meta as Record<string, unknown>;
        const ops: Op[] = [];
        for (const [key, value] of Object.entries(changes)) {
          if (value !== undefined && meta[key] !== value) ops.push({ t: 'put', table: 'meta', row: { key, value } });
        }
        commit(ops);
      },
    };
  });
  return useStore;
}
