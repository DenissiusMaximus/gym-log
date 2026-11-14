import { APP_VERSION } from '../buildInfo.generated';
import { formatFullDate, isValidDate } from '../lib/date';
import { round2 } from '../lib/format';
import { strings } from '../lib/strings';
import { DEFAULT_META } from './meta';
import type { Entry, Exercise, Group, Membership, Snapshot, Workout } from './types';

export const BACKUP_FORMAT = 'gym-log-backup';
export const BACKUP_VERSION = 1;

export type BackupData = Pick<Snapshot, 'exercises' | 'groups' | 'memberships' | 'workouts' | 'entries'>;

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
  data: BackupData;
};

export type BackupSummary = {
  exercises: number;
  workouts: number;
  /** Earliest and latest workout dates, null when no workout has a date. */
  firstDate: string | null;
  lastDate: string | null;
};

export type ParsedBackup = { snapshot: Snapshot; summary: BackupSummary };

/** Thrown for any file that cannot be imported. `message` is user-facing. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export function backupFileName(date: string): string {
  return `gym-log-${date}.json`;
}

export function buildBackup(
  snapshot: Snapshot,
  options: { exportedAt?: string; appVersion?: string } = {},
): BackupFile {
  const { exercises, groups, memberships, workouts, entries } = snapshot;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    appVersion: options.appVersion ?? APP_VERSION,
    data: { exercises, groups, memberships, workouts, entries },
  };
}

export function serialize(
  snapshot: Snapshot,
  options: { exportedAt?: string; appVersion?: string } = {},
): string {
  return JSON.stringify(buildBackup(snapshot, options));
}

/** `backupMigrations[v - 1]` upgrades the raw `data` of version v to version v + 1. */
const backupMigrations: ((data: unknown) => unknown)[] = [];

export function migrateBackup(data: unknown, fromVersion: number): unknown {
  let current = data;
  for (let v = fromVersion; v < BACKUP_VERSION; v++) current = backupMigrations[v - 1](current);
  return current;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function fail(path: string): never {
  throw new BackupError(strings.backup.invalidField(path));
}

function list(data: Obj, name: string): unknown[] {
  const value = data[name];
  if (!Array.isArray(value)) fail(`data.${name}`);
  return value;
}

/** Validates an already-parsed backup object (shared by file import and the safety snapshot). */
export function validateBackup(raw: unknown): ParsedBackup {
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError(strings.backup.invalidFile);
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new BackupError(strings.backup.invalidFile);
  }
  if (version > BACKUP_VERSION) throw new BackupError(strings.backup.newerVersion);

  const migrated = migrateBackup(raw.data, version);
  if (!isObj(migrated)) fail('data');

  const exercises = new Map<string, Exercise>();
  list(migrated, 'exercises').forEach((item, i) => {
    const p = `exercises[${i}]`;
    if (!isObj(item) || !isStr(item.id) || !item.id) fail(p);
    if (!isStr(item.name)) fail(`${p}.name`);
    if (!isNum(item.sortIndex)) fail(`${p}.sortIndex`);
    if (item.archivedAt !== null && !isStr(item.archivedAt)) fail(`${p}.archivedAt`);
    if (!isStr(item.createdAt)) fail(`${p}.createdAt`);
    if (!exercises.has(item.id)) {
      exercises.set(item.id, {
        id: item.id,
        name: item.name,
        sortIndex: item.sortIndex,
        archivedAt: item.archivedAt,
        createdAt: item.createdAt,
      });
    }
  });

  const groups = new Map<string, Group>();
  list(migrated, 'groups').forEach((item, i) => {
    const p = `groups[${i}]`;
    if (!isObj(item) || !isStr(item.id) || !item.id) fail(p);
    if (!isStr(item.name)) fail(`${p}.name`);
    if (!isStr(item.createdAt)) fail(`${p}.createdAt`);
    if (!groups.has(item.id)) groups.set(item.id, { id: item.id, name: item.name, createdAt: item.createdAt });
  });

  // Workouts first: duplicate dates are merged (rule 3), and entries must follow the surviving ids.
  const workouts = new Map<string, Workout>();
  const byDate = new Map<string, string>();
  /** Source workout id -> workout it was merged into. */
  const redirect = new Map<string, string>();
  list(migrated, 'workouts').forEach((item, i) => {
    const p = `workouts[${i}]`;
    if (!isObj(item) || !isStr(item.id) || !item.id) fail(p);
    if (item.date !== null && (!isStr(item.date) || !isValidDate(item.date))) fail(`${p}.date`);
    if (!isStr(item.createdAt)) fail(`${p}.createdAt`);
    if (workouts.has(item.id) || redirect.has(item.id)) return;
    const target = item.date === null ? undefined : byDate.get(item.date);
    if (target) {
      redirect.set(item.id, target);
      return;
    }
    workouts.set(item.id, { id: item.id, date: item.date, createdAt: item.createdAt });
    if (item.date !== null) byDate.set(item.date, item.id);
  });

  const memberships = new Map<string, Membership>();
  list(migrated, 'memberships').forEach((item, i) => {
    const p = `memberships[${i}]`;
    if (!isObj(item) || !isStr(item.groupId) || !isStr(item.exerciseId)) fail(p);
    if (!isNum(item.position)) fail(`${p}.position`);
    if (!groups.has(item.groupId) || !exercises.has(item.exerciseId)) return;
    const key = `${item.groupId}|${item.exerciseId}`;
    if (!memberships.has(key)) {
      memberships.set(key, { groupId: item.groupId, exerciseId: item.exerciseId, position: item.position });
    }
  });

  const entries = new Map<string, Entry>();
  // Entries of workouts merged into another one: the target's own entry wins, so these go last.
  const redirected: Entry[] = [];
  list(migrated, 'entries').forEach((item, i) => {
    const p = `entries[${i}]`;
    if (!isObj(item) || !isStr(item.workoutId) || !isStr(item.exerciseId)) fail(p);
    if (!Array.isArray(item.weights) || item.weights.length === 0) fail(`${p}.weights`);
    const weights: number[] = [];
    for (const w of item.weights) {
      if (!isNum(w) || w < 0) fail(`${p}.weights`);
      weights.push(round2(w));
    }
    if (!isStr(item.updatedAt)) fail(`${p}.updatedAt`);
    if (!exercises.has(item.exerciseId)) return;
    const entry: Entry = {
      workoutId: item.workoutId,
      exerciseId: item.exerciseId,
      weights,
      updatedAt: item.updatedAt,
    };
    const target = redirect.get(item.workoutId);
    if (target) {
      redirected.push({ ...entry, workoutId: target });
      return;
    }
    if (!workouts.has(item.workoutId)) return;
    const key = `${entry.workoutId}|${entry.exerciseId}`;
    if (!entries.has(key)) entries.set(key, entry);
  });
  for (const entry of redirected) {
    const key = `${entry.workoutId}|${entry.exerciseId}`;
    if (!entries.has(key)) entries.set(key, entry);
  }

  const snapshot: Snapshot = {
    exercises: [...exercises.values()],
    groups: [...groups.values()],
    memberships: [...memberships.values()],
    workouts: [...workouts.values()],
    entries: [...entries.values()],
    meta: { ...DEFAULT_META },
  };
  return { snapshot, summary: summarize(snapshot) };
}

export function parseAndValidate(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError(strings.backup.invalidFile);
  }
  return validateBackup(raw);
}

export function summarize(snapshot: Snapshot): BackupSummary {
  const dates = snapshot.workouts
    .map((w) => w.date)
    .filter((d): d is string => d !== null)
    .sort();
  return {
    exercises: snapshot.exercises.length,
    workouts: snapshot.workouts.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

/** Text for the import confirmation dialog. */
export function describeSummary(summary: BackupSummary): string {
  const range =
    summary.firstDate && summary.lastDate
      ? `${formatFullDate(summary.firstDate)} - ${formatFullDate(summary.lastDate)}`
      : null;
  return strings.backup.importSummary(summary.exercises, summary.workouts, range);
}
