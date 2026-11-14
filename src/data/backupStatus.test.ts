import { describeLastBackup, shouldNudgeBackup } from './backupStatus';

// Local noon, so the calendar day is the same in any time zone.
const now = new Date(2026, 10, 15, 12, 0, 0);
const daysAgo = (n: number) => new Date(2026, 10, 15 - n, 12, 0, 0).toISOString();

const check = (over: Partial<Parameters<typeof shouldNudgeBackup>[0]>) =>
  shouldNudgeBackup({ lastBackupAt: null, backupNudgeAt: null, workoutCount: 0, now, ...over });

describe('shouldNudgeBackup', () => {
  it('stays quiet without a backup until there are 5 workouts', () => {
    expect(check({ workoutCount: 4 })).toBe(false);
    expect(check({ workoutCount: 5 })).toBe(true);
  });

  it('reminds 30 days after the last backup, not before', () => {
    expect(check({ lastBackupAt: daysAgo(29), workoutCount: 100 })).toBe(false);
    expect(check({ lastBackupAt: daysAgo(30), workoutCount: 100 })).toBe(true);
  });

  it('ignores the workout count once a backup exists', () => {
    expect(check({ lastBackupAt: daysAgo(40), workoutCount: 0 })).toBe(true);
  });

  it('waits 7 days between reminders', () => {
    expect(check({ workoutCount: 9, backupNudgeAt: daysAgo(6) })).toBe(false);
    expect(check({ workoutCount: 9, backupNudgeAt: daysAgo(7) })).toBe(true);
  });

  it('treats a malformed timestamp as missing', () => {
    expect(check({ workoutCount: 9, lastBackupAt: 'garbage' })).toBe(true);
    expect(check({ workoutCount: 9, backupNudgeAt: 'garbage' })).toBe(true);
  });
});

describe('describeLastBackup', () => {
  it('describes never, today, yesterday and older', () => {
    expect(describeLastBackup(null, now)).toBe('Last backup: never');
    expect(describeLastBackup(daysAgo(0), now)).toBe('Last backup: today');
    expect(describeLastBackup(daysAgo(1), now)).toBe('Last backup: yesterday');
    expect(describeLastBackup(daysAgo(12), now)).toBe('Last backup: 12 days ago');
  });
});
