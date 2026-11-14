import { applyOps, emptySnapshot, snapshotFromTables, tablesFromSnapshot, type Tables } from './ops';
import { createPersist, type Persist } from './persist';
import { createDataStore } from './store';
import type { Op, SafetySnapshotStore, Snapshot, StorageDriver } from './types';

export type FakeDriver = StorageDriver & {
  tables: Tables;
  commits: Op[][];
  /** Number of upcoming `commit` calls that throw. */
  failNext: number;
  opens: number;
  closes: number;
};

/** In-memory driver that records every commit and can be told to fail. */
export function createFakeDriver(): FakeDriver {
  const driver: FakeDriver = {
    tables: tablesFromSnapshot(emptySnapshot()),
    commits: [],
    failNext: 0,
    opens: 0,
    closes: 0,
    async open() {
      driver.opens++;
    },
    async close() {
      driver.closes++;
    },
    async loadAll() {
      return snapshotFromTables(driver.tables);
    },
    async commit(ops) {
      if (driver.failNext > 0) {
        driver.failNext--;
        throw new Error('commit failed');
      }
      driver.commits.push(ops);
      driver.tables = applyOps(driver.tables, ops);
    },
    async replaceAll(snapshot) {
      driver.tables = tablesFromSnapshot(snapshot);
    },
  };
  return driver;
}

export const noSleep = () => Promise.resolve();

export const noSafety: SafetySnapshotStore = {
  read: () => null,
  writeNow: () => {},
  schedule: () => {},
  install: () => {},
};

/** A fresh store on a fake driver, with instant retries. */
export function createTestStore(safety: SafetySnapshotStore = noSafety): {
  store: ReturnType<typeof createDataStore>;
  persist: Persist;
  driver: FakeDriver;
} {
  const driver = createFakeDriver();
  const persist = createPersist(driver, { sleep: noSleep });
  const store = createDataStore({ persist, safety });
  return { store, persist, driver };
}

export type { Snapshot };
