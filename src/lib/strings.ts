// All user-facing text lives here, grouped by feature. Later stages add their own sections.
import { countLabel } from './plural';

export const strings = {
  app: {
    name: 'Gym Log',
  },
  common: {
    undo: 'Undo',
    cancel: 'Cancel',
  },
  update: {
    available: 'New version available',
    action: 'Update',
  },
  data: {
    restoredFromCopy: 'Data restored from local copy',
    replaced: 'Data replaced',
    merged: (date: string) => `Merged with the workout of ${date}`,
  },
  persist: {
    failedBanner:
      'Cannot save data. Restart the app; if that does not help, restart the phone. Save a backup copy.',
    saveCopy: 'Save copy',
  },
  backup: {
    invalidFile: 'This is not a Gym Log backup file',
    newerVersion: 'This file was created by a newer version of the app',
    invalidField: (path: string) => `The backup file is damaged: invalid ${path}`,
    importSummary: (exercises: number, workouts: number, range: string | null) =>
      `The file contains ${countLabel(exercises, 'exercise', 'exercises')}, ` +
      `${countLabel(workouts, 'workout', 'workouts')}` +
      `${range ? `, ${range}` : ''}. Current data will be replaced.`,
    replace: 'Replace data',
    exportFailed: 'Could not save the backup file',
    importFailed: 'Could not read the file',
    saved: 'Backup saved',
  },
  dev: {
    title: 'Developer panel',
    storage: 'Storage',
    rev: 'rev',
    rows: 'Rows',
    persistStatus: 'persistStatus',
    storagePersisted: 'storage.persisted()',
    standalone: 'navigator.standalone',
    serviceWorker: 'Service worker',
    controlled: 'controlled by SW',
    build: 'Build',
    fps: 'Frames (last 5 s)',
    errors: 'Error log',
    noErrors: 'No errors',
    actions: 'Actions',
    addEntry: '+1 entry',
    generate: 'Generate 40x300',
    clearAll: 'Clear all',
    export: 'Export',
    import: 'Import',
    simulateFailure: 'Simulate write failure',
    stopSimulatingFailure: 'Stop simulating write failure',
    resetCache: 'Reset app cache',
    clearLog: 'Clear log',
    yes: 'yes',
    no: 'no',
    unknown: 'n/a',
  },
} as const;
