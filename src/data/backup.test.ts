import { backupFileName, BackupError, describeSummary, parseAndValidate, serialize } from './backup';
import { generateDemo } from './demo';
import { emptySnapshot } from './ops';
import type { Snapshot } from './types';

const sample = (): Snapshot => ({
  ...emptySnapshot(),
  exercises: [
    { id: 'e1', name: 'Bench', sortIndex: 0, archivedAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'e2', name: 'Squat', sortIndex: 1, archivedAt: '2026-02-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  groups: [{ id: 'g1', name: 'Push', createdAt: '2026-01-01T00:00:00.000Z' }],
  memberships: [{ groupId: 'g1', exerciseId: 'e1', position: 0 }],
  workouts: [
    { id: 'w1', date: '2026-10-21', createdAt: '2026-10-21T10:00:00.000Z' },
    { id: 'w2', date: null, createdAt: '2026-10-22T10:00:00.000Z' },
    { id: 'w3', date: '2027-11-12', createdAt: '2026-10-23T10:00:00.000Z' },
  ],
  entries: [
    { workoutId: 'w1', exerciseId: 'e1', weights: [40, 42.5], updatedAt: '2026-10-21T11:00:00.000Z' },
    { workoutId: 'w2', exerciseId: 'e2', weights: [0], updatedAt: '2026-10-22T11:00:00.000Z' },
  ],
});

const withData = (patch: (data: Record<string, unknown[]>) => void, version = 1) => {
  const file = JSON.parse(serialize(sample()));
  patch(file.data);
  file.version = version;
  return JSON.stringify(file);
};

describe('backup', () => {
  it('round-trips through serialize and parseAndValidate', () => {
    const original = sample();
    const { snapshot, summary } = parseAndValidate(serialize(original, { exportedAt: '2026-11-14T18:03:00.000Z' }));
    expect(snapshot.exercises).toEqual(original.exercises);
    expect(snapshot.groups).toEqual(original.groups);
    expect(snapshot.memberships).toEqual(original.memberships);
    expect(snapshot.workouts).toEqual(original.workouts);
    expect(snapshot.entries).toEqual(original.entries);
    expect(summary).toEqual({ exercises: 2, workouts: 3, firstDate: '2026-10-21', lastDate: '2027-11-12' });
    expect(describeSummary(summary)).toBe(
      'The file contains 2 exercises, 3 workouts, 21.10.2026 - 12.11.2027. Current data will be replaced.',
    );
  });

  it('writes the documented file format', () => {
    const file = JSON.parse(serialize(sample(), { exportedAt: '2026-11-14T18:03:00.000Z', appVersion: '1.0.0' }));
    expect(Object.keys(file)).toEqual(['format', 'version', 'exportedAt', 'appVersion', 'data']);
    expect(file).toMatchObject({ format: 'gym-log-backup', version: 1, appVersion: '1.0.0' });
    expect(Object.keys(file.data)).toEqual(['exercises', 'groups', 'memberships', 'workouts', 'entries']);
  });

  it('round-trips a large demo dataset', () => {
    const demo = generateDemo(40, 300);
    const { snapshot } = parseAndValidate(serialize(demo));
    expect(snapshot.entries).toHaveLength(demo.entries.length);
    expect(snapshot.workouts).toHaveLength(300);
  });

  it('rejects a file from a newer version', () => {
    expect(() => parseAndValidate(withData(() => {}, 2))).toThrow('This file was created by a newer version of the app');
  });

  it.each([
    ['not json', 'nope'],
    ['wrong format', JSON.stringify({ format: 'other', version: 1, data: {} })],
    ['array', '[]'],
    ['missing version', JSON.stringify({ format: 'gym-log-backup', data: {} })],
  ])('rejects %s', (_name, text) => {
    expect(() => parseAndValidate(text)).toThrow(BackupError);
  });

  it('rejects bad field types, dates and weights', () => {
    expect(() => parseAndValidate(withData((d) => ((d.exercises[0] as { name: unknown }).name = 5)))).toThrow(/exercises\[0\]\.name/);
    expect(() => parseAndValidate(withData((d) => ((d.workouts[0] as { date: unknown }).date = '2026-02-30')))).toThrow(/workouts\[0\]\.date/);
    expect(() => parseAndValidate(withData((d) => ((d.entries[0] as { weights: unknown }).weights = [])))).toThrow(/weights/);
    expect(() => parseAndValidate(withData((d) => ((d.entries[0] as { weights: unknown }).weights = [-1])))).toThrow(/weights/);
    expect(() => parseAndValidate(withData((d) => ((d.entries[0] as { weights: unknown }).weights = [null])))).toThrow(/weights/);
    expect(() => parseAndValidate(withData((d) => delete (d as Record<string, unknown>).groups))).toThrow(/data\.groups/);
  });

  it('drops memberships and entries that point at missing ids', () => {
    const text = withData((d) => {
      d.memberships.push({ groupId: 'nope', exerciseId: 'e1', position: 1 });
      d.memberships.push({ groupId: 'g1', exerciseId: 'nope', position: 2 });
      d.entries.push({ workoutId: 'nope', exerciseId: 'e1', weights: [1], updatedAt: 'x' });
      d.entries.push({ workoutId: 'w1', exerciseId: 'nope', weights: [1], updatedAt: 'x' });
    });
    const { snapshot } = parseAndValidate(text);
    expect(snapshot.memberships).toHaveLength(1);
    expect(snapshot.entries).toHaveLength(2);
  });

  it('merges workouts that share a date: the first keeps its entries, the rest move over', () => {
    const text = withData((d) => {
      d.workouts.push({ id: 'dup', date: '2026-10-21', createdAt: 'x' });
      d.entries.push({ workoutId: 'dup', exerciseId: 'e1', weights: [1], updatedAt: 'x' }); // conflicts: w1 wins
      d.entries.push({ workoutId: 'dup', exerciseId: 'e2', weights: [77], updatedAt: 'x' }); // moves to w1
    });
    const { snapshot } = parseAndValidate(text);
    expect(snapshot.workouts.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
    const w1 = snapshot.entries.filter((e) => e.workoutId === 'w1');
    expect(w1.find((e) => e.exerciseId === 'e1')?.weights).toEqual([40, 42.5]);
    expect(w1.find((e) => e.exerciseId === 'e2')?.weights).toEqual([77]);
    expect(snapshot.entries.some((e) => e.workoutId === 'dup')).toBe(false);
  });

  it('builds the file name', () => {
    expect(backupFileName('2026-11-14')).toBe('gym-log-2026-11-14.json');
  });
});
