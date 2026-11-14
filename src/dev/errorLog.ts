export type ErrorLogEntry = { time: string; source: string; message: string };

const MAX_ENTRIES = 100;

let entries: ErrorLogEntry[] = [];
const listeners = new Set<() => void>();
let installed = false;

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/** Appends to the ring buffer (the newest 100 entries are kept). */
export function logError(source: string, error: unknown): void {
  entries = [...entries, { time: new Date().toISOString(), source, message: describe(error) }].slice(-MAX_ENTRIES);
  listeners.forEach((l) => l());
}

export function clearErrorLog(): void {
  entries = [];
  listeners.forEach((l) => l());
}

/** Snapshot for `useSyncExternalStore`: the array identity changes only when the log changes. */
export function getErrorLog(): ErrorLogEntry[] {
  return entries;
}

export function subscribeErrorLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Captures uncaught errors and unhandled promise rejections (web). */
export function installErrorLog(): void {
  if (installed || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  installed = true;
  window.addEventListener('error', (event) => logError('error', event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => logError('unhandledrejection', event.reason));
}
