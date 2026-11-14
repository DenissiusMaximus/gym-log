import type { SafetySnapshotStore } from './types';

// Native: SQLite in WAL mode is the only store; there is no mirror.
export const safetySnapshot: SafetySnapshotStore = {
  read: () => null,
  writeNow: () => {},
  schedule: () => {},
  install: () => {},
};
