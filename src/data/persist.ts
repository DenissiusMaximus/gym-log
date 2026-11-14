import { opKey } from './ops';
import type { Op, PersistStatus, Snapshot, StorageDriver } from './types';

/** Pauses before each retry of a failed commit (ms). */
export const RETRY_DELAYS = [200, 500, 1000];

export type PersistListener = {
  /** Called after every successful commit with the new revision. */
  onRev?: (rev: number) => void;
  onStatus?: (status: PersistStatus) => void;
  /** Called when a batch could not be written after all retries. */
  onError?: (error: unknown) => void;
};

export type PersistOptions = {
  retryDelays?: number[];
  sleep?: (ms: number) => Promise<void>;
};

export type Persist = {
  /** Opens the database and reads everything. Throws if the database cannot be opened. */
  open(): Promise<Snapshot>;
  /** Sets the revision that the next commit increments (call after loading). */
  init(rev: number): void;
  enqueue(ops: Op[]): void;
  /** Replaces the whole database; pending operations are dropped as superseded. */
  replaceAll(snapshot: Snapshot): Promise<void>;
  /** Resolves when nothing is queued or being written. Never rejects. */
  whenIdle(): Promise<void>;
  getRev(): number;
  getStatus(): PersistStatus;
  setListener(listener: PersistListener): void;
  /** Developer tool: while on, every write attempt fails. */
  simulateFailure(on: boolean): void;
};

const metaRev = (rev: number): Op => ({ t: 'put', table: 'meta', row: { key: 'rev', value: rev } });

/**
 * Serial write queue on top of a driver. Operations on the same key are merged (the later
 * one wins); a flush starts immediately when idle, or right after the running commit ends.
 */
export function createPersist(driver: StorageDriver, options: PersistOptions = {}): Persist {
  const retryDelays = options.retryDelays ?? RETRY_DELAYS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let pending = new Map<string, Op>();
  let pendingReplace: Snapshot | null = null;
  let running = false;
  let rev = 0;
  let status: PersistStatus = 'ok';
  let failing = false;
  let listener: PersistListener = {};
  let idleWaiters: (() => void)[] = [];

  function setStatus(next: PersistStatus) {
    if (status === next) return;
    status = next;
    listener.onStatus?.(next);
  }

  /** Runs `attempt`, reopening the database and retrying on failure. */
  async function withRetries(attempt: () => Promise<void>): Promise<void> {
    const run = async () => {
      if (failing) throw new Error('Simulated write failure');
      await attempt();
    };
    try {
      await run();
      return;
    } catch (first) {
      let last = first;
      for (const delay of retryDelays) {
        await sleep(delay);
        try {
          await driver.close();
        } catch {
          // The connection may already be dead; reopening is what matters.
        }
        try {
          await driver.open();
          await run();
          return;
        } catch (error) {
          last = error;
        }
      }
      throw last;
    }
  }

  async function flush(): Promise<void> {
    if (running) return;
    running = true;
    try {
      while (pendingReplace || pending.size > 0) {
        if (pendingReplace) {
          const snapshot = pendingReplace;
          pendingReplace = null;
          const nextRev = rev + 1;
          const replacement: Snapshot = { ...snapshot, meta: { ...snapshot.meta, rev: nextRev } };
          try {
            await withRetries(() => driver.replaceAll(replacement));
            rev = nextRev;
            setStatus('ok');
            listener.onRev?.(rev);
          } catch (error) {
            setStatus('failed');
            listener.onError?.(error);
            // Keep the data for a later attempt unless something newer superseded it.
            if (!pendingReplace && pending.size === 0) pendingReplace = replacement;
            break;
          }
          continue;
        }

        const batch = pending;
        pending = new Map();
        const nextRev = rev + 1;
        const ops = [...batch.values(), metaRev(nextRev)];
        try {
          await withRetries(() => driver.commit(ops));
          rev = nextRev;
          setStatus('ok');
          listener.onRev?.(rev);
        } catch (error) {
          setStatus('failed');
          listener.onError?.(error);
          // Put the batch back; operations enqueued meanwhile are newer and win.
          for (const [key, op] of batch) if (!pending.has(key)) pending.set(key, op);
          break;
        }
      }
    } finally {
      running = false;
      // Also after a failed flush (the queue then still holds data): waiters must not hang.
      const waiters = idleWaiters;
      idleWaiters = [];
      for (const resolve of waiters) resolve();
    }
  }

  function whenIdle(): Promise<void> {
    // enqueue() starts a flush synchronously, so "not running" also covers a failed state.
    if (!running) return Promise.resolve();
    return new Promise<void>((resolve) => {
      idleWaiters.push(resolve);
    });
  }

  return {
    async open() {
      await driver.open();
      return driver.loadAll();
    },
    init(value) {
      rev = value;
    },
    enqueue(ops) {
      for (const op of ops) pending.set(opKey(op), op);
      void flush();
    },
    replaceAll(snapshot) {
      pendingReplace = snapshot;
      pending = new Map();
      void flush();
      return whenIdle();
    },
    whenIdle,
    getRev: () => rev,
    getStatus: () => status,
    setListener(next) {
      listener = next;
    },
    simulateFailure(on) {
      failing = on;
    },
  };
}
