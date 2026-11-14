import { useEffect, useRef } from 'react';

import { saveBackup } from '@/data/backupActions';
import { shouldNudgeBackup } from '@/data/backupStatus';
import { useData } from '@/data/useData';
import { useUi } from '@/data/useUi';
import { logError } from '@/dev/errorLog';
import { strings } from '@/lib/strings';
import { applyUpdate } from '@/pwa/registerSW';

/** setTimeout limit (about 24 days): the snackbar stays until something replaces it. */
const PERSISTENT_MS = 2_147_483_647;
const NUDGE_DURATION_MS = 8_000;

/**
 * App-wide snackbars that do not belong to any screen: "New version available" and the backup
 * reminder. Renders nothing. The update goes first; the reminder waits until no snackbar is
 * showing, and is checked once per launch.
 */
export function AppNotices() {
  const hydrated = useData((s) => s.hydrated);
  const updateReady = useUi((s) => s.updateReady);
  const busy = useUi((s) => s.snackbar !== null);
  const updateShown = useRef(false);
  const nudgeChecked = useRef(false);

  useEffect(() => {
    // Shown once per launch: if it is dismissed or replaced, the update applies at the next cold start.
    if (updateReady && !updateShown.current) {
      updateShown.current = true;
      useUi.getState().showSnackbar({
        text: strings.update.available,
        actionLabel: strings.update.action,
        onAction: () => {
          applyUpdate().catch((error) => logError('update', error));
        },
        duration: PERSISTENT_MS,
      });
      return;
    }
    if (!hydrated || nudgeChecked.current || busy) return;
    nudgeChecked.current = true;
    const { meta, workouts } = useData.getState();
    const due = shouldNudgeBackup({
      lastBackupAt: meta.lastBackupAt,
      backupNudgeAt: meta.backupNudgeAt,
      workoutCount: Object.keys(workouts).length,
      now: new Date(),
    });
    if (!due) return;
    useData.getState().setMeta({ backupNudgeAt: new Date().toISOString() });
    useUi.getState().showSnackbar({
      text: strings.backup.nudge,
      actionLabel: strings.backup.nudgeAction,
      onAction: () => void saveBackup(),
      duration: NUDGE_DURATION_MS,
    });
  }, [hydrated, updateReady, busy]);

  return null;
}
