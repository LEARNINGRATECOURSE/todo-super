import { db, SCHEMA_VERSION } from '../db/database';
import { TABLE_NAMES, type TableName } from '../db/types';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { seedDefaults } from './seed';

export interface BackupFile {
  app: 'taskflow-pro';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

/** Deterministic: tables in fixed order, rows sorted by primary key. */
export function buildBackup(): BackupFile {
  const snap = db.snapshot();
  const tables = {} as Record<TableName, unknown[]>;
  for (const t of TABLE_NAMES) {
    const key = t === 'app_settings' ? 'key' : 'id';
    tables[t] = [...snap[t]].sort((a, b) => String((a as Record<string, unknown>)[key]).localeCompare(String((b as Record<string, unknown>)[key])));
  }
  return { app: 'taskflow-pro', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
}

export const backupFilename = () => `taskflow-backup-${new Date().toISOString().slice(0, 10)}.json`;

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function validateBackup(data: unknown): asserts data is BackupFile {
  const d = data as Partial<BackupFile> | null;
  if (!d || typeof d !== 'object' || d.app !== 'taskflow-pro') throw new Error('Not a TaskFlow Pro backup file.');
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion > SCHEMA_VERSION) throw new Error('Backup was created by a newer version of the app.');
  if (!d.tables || typeof d.tables !== 'object') throw new Error('Backup has no tables.');
  // A missing table would be restored as empty, silently wiping that data, so every table must be present.
  for (const name of TABLE_NAMES) {
    const rows = (d.tables as Partial<Record<TableName, unknown>>)[name];
    if (!Array.isArray(rows)) throw new Error(`Backup table "${name}" is missing or malformed.`);
    if (rows.some((r) => !r || typeof r !== 'object')) throw new Error(`Backup table "${name}" contains invalid rows.`);
  }
}

/** Parses and validates a backup without touching the stored data. */
export function parseBackup(json: string): BackupFile {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('File is not valid JSON.'); }
  validateBackup(parsed);
  return parsed;
}

/** All-or-nothing restore: validation happens before the existing data is touched. */
export function restoreBackup(json: string) {
  const backup = parseBackup(json);
  db.replaceAll(backup.tables);
  seedDefaults();
}

export function factoryReset() {
  db.clear();
  seedDefaults();
  usePomodoroStore.getState().link(null); // the linked task was just deleted
}
