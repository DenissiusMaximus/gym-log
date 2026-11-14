import { buildBackup, validateBackup } from './backup';
import { parseMeta } from './meta';
import type { SafetySnapshotStore, Snapshot } from './types';

export const SNAPSHOT_KEY = 'gymlog.snapshot';
/** Longer strings are skipped silently: localStorage is limited to about 5 MB. */
export const MAX_SNAPSHOT_LENGTH = 4_000_000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Backup-format JSON plus `rev` and `meta`, kept in localStorage as a recovery copy. */
export function createSafetySnapshot(storage: StorageLike | null): SafetySnapshotStore {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function writeNow(snapshot: Snapshot) {
    if (!storage) return;
    try {
      const record = { ...buildBackup(snapshot), rev: snapshot.meta.rev, meta: snapshot.meta };
      const text = JSON.stringify(record);
      if (text.length > MAX_SNAPSHOT_LENGTH) return;
      storage.setItem(SNAPSHOT_KEY, text);
    } catch {
      // QuotaExceededError or storage unavailable: the mirror is best-effort.
    }
  }

  return {
    read() {
      if (!storage) return null;
      try {
        const text = storage.getItem(SNAPSHOT_KEY);
        if (!text) return null;
        const raw = JSON.parse(text) as { rev?: unknown; meta?: unknown };
        const { snapshot } = validateBackup(raw);
        const rev = typeof raw.rev === 'number' && Number.isFinite(raw.rev) ? raw.rev : 0;
        const meta = parseMeta({
          ...(typeof raw.meta === 'object' && raw.meta !== null ? raw.meta : {}),
          rev,
        });
        return { rev, snapshot: { ...snapshot, meta } };
      } catch {
        return null;
      }
    },

    writeNow(snapshot) {
      if (timer) clearTimeout(timer);
      timer = null;
      writeNow(snapshot);
    },

    schedule(getSnapshot, delayMs) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        writeNow(getSnapshot());
      }, delayMs);
    },

    install(getSnapshot) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'hidden') return;
        if (timer) clearTimeout(timer);
        timer = null;
        writeNow(getSnapshot());
      });
    },
  };
}

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export const safetySnapshot = createSafetySnapshot(browserStorage());
