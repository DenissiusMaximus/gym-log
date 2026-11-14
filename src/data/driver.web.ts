import { metaToRows, parseMeta } from './meta';
import type { MetaRow, Op, Snapshot, StorageDriver } from './types';

const DB_VERSION = 1;
const STORES = ['exercises', 'groups', 'memberships', 'workouts', 'entries', 'meta'] as const;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Resolves on `complete` (data durably written); rejects on abort or error. */
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function upgrade(db: IDBDatabase, oldVersion: number) {
  // Migrations: each case upgrades from that version and falls through to the next.
  switch (oldVersion) {
    case 0:
      db.createObjectStore('exercises', { keyPath: 'id' });
      db.createObjectStore('groups', { keyPath: 'id' });
      db.createObjectStore('workouts', { keyPath: 'id' });
      db.createObjectStore('memberships', { keyPath: ['groupId', 'exerciseId'] });
      db.createObjectStore('entries', { keyPath: ['workoutId', 'exerciseId'] });
      db.createObjectStore('meta', { keyPath: 'key' });
  }
}

function writeOp(tx: IDBTransaction, op: Op) {
  const store = tx.objectStore(op.table);
  if (op.t === 'put') store.put(op.row);
  else store.delete(op.key);
}

/** IndexedDB driver (web). The connection is reopened lazily after the browser drops it. */
export function createDriver(name = 'gym-log'): StorageDriver {
  let db: IDBDatabase | null = null;
  let opening: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    if (db) return Promise.resolve(db);
    if (opening) return opening;
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, DB_VERSION);
      request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
      request.onblocked = () => reject(new Error('IndexedDB open is blocked'));
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onsuccess = () => {
        const opened = request.result;
        const drop = () => {
          opened.close();
          if (db === opened) db = null;
        };
        // Browser killed the connection (e.g. WebKit bug 273827) or a newer version wants to upgrade.
        opened.onclose = drop;
        opened.onversionchange = drop;
        db = opened;
        resolve(opened);
      };
    }).finally(() => {
      opening = null;
    });
    return opening;
  }

  return {
    async open() {
      await openDb();
    },

    async loadAll(): Promise<Snapshot> {
      const database = await openDb();
      const tx = database.transaction([...STORES], 'readonly');
      const [exercises, groups, memberships, workouts, entries, metaRows] = await Promise.all(
        STORES.map((store) => requestToPromise(tx.objectStore(store).getAll())),
      );
      const raw: Record<string, unknown> = {};
      for (const row of metaRows as MetaRow[]) raw[row.key] = row.value;
      return {
        exercises,
        groups,
        memberships,
        workouts,
        entries,
        meta: parseMeta(raw),
      } as Snapshot;
    },

    async commit(ops) {
      const database = await openDb();
      const tx = database.transaction([...STORES], 'readwrite', { durability: 'strict' });
      const done = transactionDone(tx);
      for (const op of ops) writeOp(tx, op);
      await done;
    },

    async replaceAll(snapshot) {
      const database = await openDb();
      const tx = database.transaction([...STORES], 'readwrite', { durability: 'strict' });
      const done = transactionDone(tx);
      for (const store of STORES) tx.objectStore(store).clear();
      for (const row of snapshot.exercises) tx.objectStore('exercises').put(row);
      for (const row of snapshot.groups) tx.objectStore('groups').put(row);
      for (const row of snapshot.memberships) tx.objectStore('memberships').put(row);
      for (const row of snapshot.workouts) tx.objectStore('workouts').put(row);
      for (const row of snapshot.entries) tx.objectStore('entries').put(row);
      for (const row of metaToRows(snapshot.meta)) tx.objectStore('meta').put(row);
      await done;
    },

    async close() {
      if (db) {
        db.close();
        db = null;
      }
    },
  };
}
