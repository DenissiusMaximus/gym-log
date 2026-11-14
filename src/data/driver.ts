import * as SQLite from 'expo-sqlite';

import { parseMeta } from './meta';
import { snapshotToOps } from './ops';
import type { Entry, Exercise, Group, Membership, Op, Snapshot, StorageDriver, Workout } from './types';

// No indexes beyond primary keys on purpose: the only read is a full load at startup.
// No foreign keys / unique date index either: integrity is kept by the store, so both
// drivers behave identically and a constraint failure can never desync memory and disk.
const SCHEMA = `
CREATE TABLE exercises (id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_index INTEGER NOT NULL, archived_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE memberships (group_id TEXT NOT NULL, exercise_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY (group_id, exercise_id)) WITHOUT ROWID;
CREATE TABLE workouts (id TEXT PRIMARY KEY, date TEXT, created_at TEXT NOT NULL);
CREATE TABLE entries (workout_id TEXT NOT NULL, exercise_id TEXT NOT NULL, weights TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (workout_id, exercise_id)) WITHOUT ROWID;
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

const TABLES = ['exercises', 'groups', 'memberships', 'workouts', 'entries', 'meta'] as const;

/** `migrations[i]` upgrades the schema from version i to i + 1. */
const migrations: ((db: SQLite.SQLiteDatabase) => Promise<void>)[] = [(db) => db.execAsync(SCHEMA)];

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const from = row?.user_version ?? 0;
  for (let version = from; version < migrations.length; version++) {
    await db.withTransactionAsync(async () => {
      await migrations[version](db);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

function toSql(op: Op): { sql: string; params: SQLite.SQLiteBindValue[] } {
  if (op.t === 'del') {
    switch (op.table) {
      case 'memberships':
        return { sql: 'DELETE FROM memberships WHERE group_id = ? AND exercise_id = ?', params: [...op.key] };
      case 'entries':
        return { sql: 'DELETE FROM entries WHERE workout_id = ? AND exercise_id = ?', params: [...op.key] };
      case 'meta':
        return { sql: 'DELETE FROM meta WHERE key = ?', params: [op.key] };
      default:
        return { sql: `DELETE FROM ${op.table} WHERE id = ?`, params: [op.key] };
    }
  }
  switch (op.table) {
    case 'exercises': {
      const r = op.row;
      return {
        sql: 'INSERT OR REPLACE INTO exercises (id, name, sort_index, archived_at, created_at) VALUES (?, ?, ?, ?, ?)',
        params: [r.id, r.name, r.sortIndex, r.archivedAt, r.createdAt],
      };
    }
    case 'groups':
      return {
        sql: 'INSERT OR REPLACE INTO groups (id, name, created_at) VALUES (?, ?, ?)',
        params: [op.row.id, op.row.name, op.row.createdAt],
      };
    case 'memberships':
      return {
        sql: 'INSERT OR REPLACE INTO memberships (group_id, exercise_id, position) VALUES (?, ?, ?)',
        params: [op.row.groupId, op.row.exerciseId, op.row.position],
      };
    case 'workouts':
      return {
        sql: 'INSERT OR REPLACE INTO workouts (id, date, created_at) VALUES (?, ?, ?)',
        params: [op.row.id, op.row.date, op.row.createdAt],
      };
    case 'entries':
      return {
        sql: 'INSERT OR REPLACE INTO entries (workout_id, exercise_id, weights, updated_at) VALUES (?, ?, ?, ?)',
        params: [op.row.workoutId, op.row.exerciseId, JSON.stringify(op.row.weights), op.row.updatedAt],
      };
    case 'meta':
      return {
        sql: 'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
        params: [op.row.key, JSON.stringify(op.row.value)],
      };
  }
}

/** Runs operations with one prepared statement per distinct SQL text. Call inside a transaction. */
async function run(db: SQLite.SQLiteDatabase, ops: Op[]) {
  const statements = new Map<string, SQLite.SQLiteStatement>();
  try {
    for (const op of ops) {
      const { sql, params } = toSql(op);
      let statement = statements.get(sql);
      if (!statement) {
        statement = await db.prepareAsync(sql);
        statements.set(sql, statement);
      }
      await statement.executeAsync(params);
    }
  } finally {
    for (const statement of statements.values()) await statement.finalizeAsync();
  }
}

/** expo-sqlite driver (Android / native), WAL journal. */
export function createDriver(name = 'gym-log.db'): StorageDriver {
  let db: SQLite.SQLiteDatabase | null = null;

  async function openDb() {
    if (db) return db;
    const opened = await SQLite.openDatabaseAsync(name);
    await opened.execAsync('PRAGMA journal_mode = WAL;');
    await migrate(opened);
    db = opened;
    return opened;
  }

  return {
    async open() {
      await openDb();
    },

    async loadAll(): Promise<Snapshot> {
      const database = await openDb();
      const exercises = (
        await database.getAllAsync<{
          id: string;
          name: string;
          sort_index: number;
          archived_at: string | null;
          created_at: string;
        }>('SELECT * FROM exercises')
      ).map(
        (r): Exercise => ({
          id: r.id,
          name: r.name,
          sortIndex: r.sort_index,
          archivedAt: r.archived_at,
          createdAt: r.created_at,
        }),
      );
      const groups = (
        await database.getAllAsync<{ id: string; name: string; created_at: string }>('SELECT * FROM groups')
      ).map((r): Group => ({ id: r.id, name: r.name, createdAt: r.created_at }));
      const memberships = (
        await database.getAllAsync<{ group_id: string; exercise_id: string; position: number }>(
          'SELECT * FROM memberships',
        )
      ).map((r): Membership => ({ groupId: r.group_id, exerciseId: r.exercise_id, position: r.position }));
      const workouts = (
        await database.getAllAsync<{ id: string; date: string | null; created_at: string }>(
          'SELECT * FROM workouts',
        )
      ).map((r): Workout => ({ id: r.id, date: r.date, createdAt: r.created_at }));
      const entries = (
        await database.getAllAsync<{
          workout_id: string;
          exercise_id: string;
          weights: string;
          updated_at: string;
        }>('SELECT * FROM entries')
      ).map(
        (r): Entry => ({
          workoutId: r.workout_id,
          exerciseId: r.exercise_id,
          weights: JSON.parse(r.weights) as number[],
          updatedAt: r.updated_at,
        }),
      );
      const raw: Record<string, unknown> = {};
      for (const r of await database.getAllAsync<{ key: string; value: string }>('SELECT * FROM meta')) {
        raw[r.key] = JSON.parse(r.value);
      }
      return { exercises, groups, memberships, workouts, entries, meta: parseMeta(raw) };
    },

    async commit(ops) {
      const database = await openDb();
      await database.withTransactionAsync(() => run(database, ops));
    },

    async replaceAll(snapshot) {
      const database = await openDb();
      await database.withTransactionAsync(async () => {
        for (const table of TABLES) await database.runAsync(`DELETE FROM ${table}`);
        await run(database, snapshotToOps(snapshot));
      });
    },

    async close() {
      const database = db;
      db = null;
      await database?.closeAsync();
    },
  };
}
