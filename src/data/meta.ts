import type { Meta, ThemeMode } from './types';

export const SCHEMA_VERSION = 1;

export const DEFAULT_META: Meta = {
  schemaVersion: SCHEMA_VERSION,
  rev: 0,
  themeMode: 'system',
  activeFilter: 'all',
  lastBackupAt: null,
  backupNudgeAt: null,
};

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

const stringOrNull = (v: unknown, fallback: string | null) =>
  typeof v === 'string' || v === null ? v : fallback;

/** Builds `Meta` from raw key/value rows, falling back to defaults for missing or malformed values. */
export function parseMeta(raw: Record<string, unknown>): Meta {
  const d = DEFAULT_META;
  return {
    schemaVersion:
      typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)
        ? raw.schemaVersion
        : d.schemaVersion,
    rev: typeof raw.rev === 'number' && Number.isFinite(raw.rev) ? raw.rev : d.rev,
    themeMode: THEME_MODES.includes(raw.themeMode as ThemeMode)
      ? (raw.themeMode as ThemeMode)
      : d.themeMode,
    activeFilter:
      typeof raw.activeFilter === 'string' && raw.activeFilter ? raw.activeFilter : d.activeFilter,
    lastBackupAt: stringOrNull(raw.lastBackupAt, d.lastBackupAt),
    backupNudgeAt: stringOrNull(raw.backupNudgeAt, d.backupNudgeAt),
  };
}

export function metaToRows(meta: Meta): { key: string; value: unknown }[] {
  return Object.entries(meta).map(([key, value]) => ({ key, value }));
}
