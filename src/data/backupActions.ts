// The one place that turns "make a backup" / "restore from a file" into data-layer calls and
// user feedback. Settings, the write-failure banner, the reminder and the developer panel share it.
import { logError } from '../dev/errorLog';
import { strings } from '../lib/strings';
import { BackupError, backupFileName, parseAndValidate, serialize, type ParsedBackup } from './backup';
import { exportBackupFile, pickBackupFile } from './backupIO';
import { toSnapshot } from './store';
import { useData } from './useData';
import { useUi } from './useUi';

const UNDO_DURATION_MS = 10_000;
const ERROR_DURATION_MS = 8_000;

/**
 * Saves a backup file. Call it directly from a tap handler: the text is built and the share
 * call is started synchronously (no `await` first), otherwise Safari refuses to open the share sheet.
 * `lastBackupAt` changes only after a successful export, not when the user closes the sheet.
 * Resolves true if a file was saved.
 */
export function saveBackup(): Promise<boolean> {
  const ui = useUi.getState();
  let started: Promise<boolean>;
  try {
    started = exportBackupFile(serialize(toSnapshot(useData.getState())), backupFileName(ui.today));
  } catch (error) {
    started = Promise.reject(error);
  }
  return started.then(
    (saved) => {
      if (saved) {
        useData.getState().setMeta({ lastBackupAt: new Date().toISOString() });
        useUi.getState().showSnackbar({ text: strings.backup.saved });
      }
      return saved;
    },
    (error) => {
      logError('export', error);
      useUi.getState().showSnackbar({ text: strings.backup.exportFailed, duration: ERROR_DURATION_MS });
      return false;
    },
  );
}

/**
 * Lets the user pick a file and validates it. Returns null if cancelled or if the file is not
 * usable; in that case the reason is shown in a snackbar and the data is untouched.
 */
export async function chooseBackupToRestore(): Promise<ParsedBackup | null> {
  try {
    const text = await pickBackupFile();
    return text === null ? null : parseAndValidate(text);
  } catch (error) {
    if (!(error instanceof BackupError)) logError('import', error);
    const text = error instanceof BackupError ? error.message : strings.backup.importFailed;
    useUi.getState().showSnackbar({ text, duration: ERROR_DURATION_MS });
    return null;
  }
}

/** Replaces all data with the file's content and offers "Undo" for 10 s (the old data stays in memory). */
export function applyBackup(parsed: ParsedBackup): void {
  const undo = useData.getState().importSnapshot(parsed.snapshot);
  useUi.getState().showSnackbar({
    text: strings.data.replaced,
    actionLabel: strings.common.undo,
    onAction: undo,
    duration: UNDO_DURATION_MS,
  });
}
