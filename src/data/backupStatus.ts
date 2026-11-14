// Pure rules around "when was the last backup": the settings line and the reminder condition.
import { diffDays, todayStr } from '../lib/date';
import { strings } from '../lib/strings';

/** Without any backup, the reminder starts once there is this much history. */
export const NUDGE_MIN_WORKOUTS = 5;
/** Days since the last backup after which the reminder appears. */
export const NUDGE_AFTER_DAYS = 30;
/** Minimum days between two reminders. */
export const NUDGE_INTERVAL_DAYS = 7;

/** Whole calendar days (local time) from an ISO timestamp to `now`; null for missing or malformed input. */
export function daysSince(iso: string | null, now: Date): number | null {
  if (iso === null) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return diffDays(todayStr(then), todayStr(now));
}

type NudgeInput = {
  lastBackupAt: string | null;
  backupNudgeAt: string | null;
  workoutCount: number;
  now: Date;
};

/** True when the "No backup for a long time" reminder should be shown at startup. */
export function shouldNudgeBackup({ lastBackupAt, backupNudgeAt, workoutCount, now }: NudgeInput): boolean {
  const sinceBackup = daysSince(lastBackupAt, now);
  const needed = sinceBackup === null ? workoutCount >= NUDGE_MIN_WORKOUTS : sinceBackup >= NUDGE_AFTER_DAYS;
  if (!needed) return false;
  const sinceNudge = daysSince(backupNudgeAt, now);
  return sinceNudge === null || sinceNudge >= NUDGE_INTERVAL_DAYS;
}

/** "Last backup: 12 days ago" / "today" / "yesterday" / "never". */
export function describeLastBackup(lastBackupAt: string | null, now: Date): string {
  const days = daysSince(lastBackupAt, now);
  let when: string;
  if (days === null) when = strings.backup.never;
  else if (days <= 0) when = strings.chart.today;
  else if (days === 1) when = strings.chart.yesterday;
  else when = strings.chart.daysAgo(days);
  return strings.backup.lastBackup(when);
}
