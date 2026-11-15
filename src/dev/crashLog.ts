import { File, Paths } from 'expo-file-system';

import { logError } from './errorLog';

// Release builds close on a fatal JS error and the in-memory log dies with the process, so the
// fatal error is written to a file synchronously and shown in the developer panel on the next start.
// Everything is wrapped in try: the crash log must never stop the app from starting or hide the
// original error.
const MAX_LENGTH = 4000;

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler(): ErrorHandler; setGlobalHandler(handler: ErrorHandler): void };

let installed = false;

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ''}`.slice(0, MAX_LENGTH);
  return String(error).slice(0, MAX_LENGTH);
}

function reportPreviousCrash(file: File) {
  if (!file.exists) return;
  const raw = file.textSync();
  file.delete();
  const { time, message } = JSON.parse(raw) as { time: string; message: string };
  logError('crash (previous run)', `${time}\n${message}`);
}

/** Native only: remembers the fatal error of a run and logs it at the next start. */
export function installCrashLog(): void {
  if (installed) return;
  installed = true;
  let file: File | null = null;
  try {
    file = new File(Paths.document, 'last-crash.json');
    reportPreviousCrash(file);
  } catch {
    // A broken or unreadable file is not worth a failed start.
  }
  try {
    const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
    if (!errorUtils) return;
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      try {
        logError(isFatal ? 'fatal' : 'uncaught', error);
        if (isFatal && file) {
          file.create({ overwrite: true });
          file.writeSync(JSON.stringify({ time: new Date().toISOString(), message: describeError(error) }));
        }
      } catch {
        // Logging must not replace the original error.
      }
      previous(error, isFatal);
    });
  } catch {
    // ErrorUtils is an undocumented API: without it the log simply stays off.
  }
}
