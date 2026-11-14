import { DEFAULT_META, metaToRows, parseMeta } from './meta';
import type { Entry, Exercise, Group, Meta, Op, PutOp, Snapshot, Workout } from './types';

/** Normalized in-memory form of the data (the part of the store that is persisted). */
export type Tables = {
  exercises: Record<string, Exercise>;
  groups: Record<string, Group>;
  /** groupId -> exerciseId -> position */
  memberships: Record<string, Record<string, number>>;
  workouts: Record<string, Workout>;
  /** workoutId -> exerciseId -> entry */
  entries: Record<string, Record<string, Entry>>;
  meta: Meta;
};

export function emptySnapshot(): Snapshot {
  return {
    exercises: [],
    groups: [],
    memberships: [],
    workouts: [],
    entries: [],
    meta: { ...DEFAULT_META },
  };
}

export function isEmptySnapshot(s: Snapshot): boolean {
  return (
    s.exercises.length === 0 &&
    s.groups.length === 0 &&
    s.memberships.length === 0 &&
    s.workouts.length === 0 &&
    s.entries.length === 0
  );
}

export function tablesFromSnapshot(s: Snapshot): Tables {
  const tables: Tables = {
    exercises: {},
    groups: {},
    memberships: {},
    workouts: {},
    entries: {},
    meta: s.meta,
  };
  for (const e of s.exercises) tables.exercises[e.id] = e;
  for (const g of s.groups) tables.groups[g.id] = g;
  for (const m of s.memberships) (tables.memberships[m.groupId] ??= {})[m.exerciseId] = m.position;
  for (const w of s.workouts) tables.workouts[w.id] = w;
  for (const e of s.entries) (tables.entries[e.workoutId] ??= {})[e.exerciseId] = e;
  return tables;
}

export function snapshotFromTables(t: Tables): Snapshot {
  const memberships: Snapshot['memberships'] = [];
  for (const [groupId, members] of Object.entries(t.memberships)) {
    for (const [exerciseId, position] of Object.entries(members)) {
      memberships.push({ groupId, exerciseId, position });
    }
  }
  return {
    exercises: Object.values(t.exercises),
    groups: Object.values(t.groups),
    memberships,
    workouts: Object.values(t.workouts),
    entries: Object.values(t.entries).flatMap((byExercise) => Object.values(byExercise)),
    meta: t.meta,
  };
}

/** Every row of a snapshot as `put` operations (meta included). */
export function snapshotToOps(s: Snapshot): Op[] {
  const ops: Op[] = [];
  for (const row of s.exercises) ops.push({ t: 'put', table: 'exercises', row });
  for (const row of s.groups) ops.push({ t: 'put', table: 'groups', row });
  for (const row of s.memberships) ops.push({ t: 'put', table: 'memberships', row });
  for (const row of s.workouts) ops.push({ t: 'put', table: 'workouts', row });
  for (const row of s.entries) ops.push({ t: 'put', table: 'entries', row });
  for (const row of metaToRows(s.meta)) ops.push({ t: 'put', table: 'meta', row });
  return ops;
}

type Key = string | [string, string];

function putKey(op: PutOp): Key {
  switch (op.table) {
    case 'memberships':
      return [op.row.groupId, op.row.exerciseId];
    case 'entries':
      return [op.row.workoutId, op.row.exerciseId];
    case 'meta':
      return op.row.key;
    default:
      return op.row.id;
  }
}

export function keyOf(op: Op): Key {
  return op.t === 'put' ? putKey(op) : op.key;
}

/** Identity of the row an operation touches, e.g. `entries|w1|e1`. */
export function opKey(op: Op): string {
  const key = keyOf(op);
  return `${op.table}|${Array.isArray(key) ? key.join('|') : key}`;
}

/**
 * Applies operations to the tables. Only the branches on the path to a change get new
 * objects, so unrelated subscribers keep their references.
 */
export function applyOps(tables: Tables, ops: Op[]): Tables {
  const next: Tables = { ...tables };
  // Maps already copied during this call (safe to mutate).
  const fresh = new Set<object>();
  const mutable = <T extends object>(obj: T): T => {
    if (fresh.has(obj)) return obj;
    const copy = { ...obj };
    fresh.add(copy);
    return copy;
  };

  for (const op of ops) {
    switch (op.table) {
      case 'exercises':
      case 'groups':
      case 'workouts': {
        const map = mutable(next[op.table]) as Record<string, unknown>;
        (next as Record<string, unknown>)[op.table] = map;
        if (op.t === 'put') map[(op.row as { id: string }).id] = op.row;
        else delete map[op.key as string];
        break;
      }
      case 'memberships': {
        const [outer, inner] = keyOf(op) as [string, string];
        next.memberships = mutable(next.memberships);
        const members = (next.memberships[outer] = mutable(next.memberships[outer] ?? {}));
        if (op.t === 'put') members[inner] = (op.row as { position: number }).position;
        else {
          delete members[inner];
          if (Object.keys(members).length === 0) delete next.memberships[outer];
        }
        break;
      }
      case 'entries': {
        const [outer, inner] = keyOf(op) as [string, string];
        next.entries = mutable(next.entries);
        const byExercise = (next.entries[outer] = mutable(next.entries[outer] ?? {}));
        if (op.t === 'put') byExercise[inner] = op.row as Entry;
        else {
          delete byExercise[inner];
          if (Object.keys(byExercise).length === 0) delete next.entries[outer];
        }
        break;
      }
      case 'meta':
        next.meta =
          op.t === 'put'
            ? parseMeta({ ...next.meta, [op.row.key]: op.row.value })
            : parseMeta({ ...next.meta, [op.key]: undefined });
        break;
    }
  }
  return next;
}

function current(tables: Tables, op: Op): unknown {
  const key = keyOf(op);
  switch (op.table) {
    case 'memberships': {
      const [groupId, exerciseId] = key as [string, string];
      const position = tables.memberships[groupId]?.[exerciseId];
      return position === undefined ? undefined : { groupId, exerciseId, position };
    }
    case 'entries': {
      const [workoutId, exerciseId] = key as [string, string];
      return tables.entries[workoutId]?.[exerciseId];
    }
    case 'meta':
      return { key, value: (tables.meta as Record<string, unknown>)[key as string] };
    default:
      return tables[op.table][key as string];
  }
}

/**
 * Operations that restore the current content of every row the given operations touch.
 * Used for undo: it reverts only those rows, so unrelated later edits survive.
 */
export function invertOps(tables: Tables, ops: Op[]): Op[] {
  const inverse = new Map<string, Op>();
  for (const op of ops) {
    const id = opKey(op);
    if (inverse.has(id)) continue;
    const before = current(tables, op);
    inverse.set(
      id,
      before !== undefined
        ? ({ t: 'put', table: op.table, row: before } as Op)
        : ({ t: 'del', table: op.table, key: keyOf(op) } as Op),
    );
  }
  return [...inverse.values()];
}
