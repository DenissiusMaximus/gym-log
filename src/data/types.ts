export type Exercise = {
  id: string;
  name: string;
  /** Order in the "All" view. */
  sortIndex: number;
  archivedAt: string | null;
  createdAt: string;
};

export type Group = { id: string; name: string; createdAt: string };

/** `position` is the order of the exercise inside the group. */
export type Membership = { groupId: string; exerciseId: string; position: number };

/** `date` is local-time `YYYY-MM-DD`; null means "no date". */
export type Workout = { id: string; date: string | null; createdAt: string };

/** One cell of the table. `weights` is never empty; index 0 is set 1. */
export type Entry = { workoutId: string; exerciseId: string; weights: number[]; updatedAt: string };

export type ThemeMode = 'system' | 'light' | 'dark';

export type Meta = {
  schemaVersion: number;
  rev: number;
  themeMode: ThemeMode;
  /** 'all' or a group id. */
  activeFilter: string;
  lastBackupAt: string | null;
  backupNudgeAt: string | null;
};

export type Snapshot = {
  exercises: Exercise[];
  groups: Group[];
  memberships: Membership[];
  workouts: Workout[];
  entries: Entry[];
  meta: Meta;
};

export type MetaRow = { key: string; value: unknown };

export type Table = 'exercises' | 'groups' | 'memberships' | 'workouts' | 'entries' | 'meta';

export type PutOp =
  | { t: 'put'; table: 'exercises'; row: Exercise }
  | { t: 'put'; table: 'groups'; row: Group }
  | { t: 'put'; table: 'memberships'; row: Membership }
  | { t: 'put'; table: 'workouts'; row: Workout }
  | { t: 'put'; table: 'entries'; row: Entry }
  | { t: 'put'; table: 'meta'; row: MetaRow };

export type DelOp =
  | { t: 'del'; table: 'exercises' | 'groups' | 'workouts' | 'meta'; key: string }
  | { t: 'del'; table: 'memberships' | 'entries'; key: [string, string] };

export type Op = PutOp | DelOp;

export type PersistStatus = 'ok' | 'failed';

/** Narrow storage interface implemented by `driver.ts` (SQLite) and `driver.web.ts` (IndexedDB). */
export interface StorageDriver {
  open(): Promise<void>;
  loadAll(): Promise<Snapshot>;
  /** Applies all operations atomically. Operations are idempotent. */
  commit(ops: Op[]): Promise<void>;
  /** Atomically replaces the whole database content. */
  replaceAll(snapshot: Snapshot): Promise<void>;
  close(): Promise<void>;
}

/** Mirror of the data in `localStorage` (web only; a no-op on native). */
export interface SafetySnapshotStore {
  /** The stored mirror, or null if there is none or it is unreadable. */
  read(): { rev: number; snapshot: Snapshot } | null;
  writeNow(snapshot: Snapshot): void;
  /** Writes after `delayMs` of quiet; a newer call replaces the pending one. */
  schedule(getSnapshot: () => Snapshot, delayMs: number): void;
  /** Writes when the page becomes hidden. */
  install(getSnapshot: () => Snapshot): void;
}
