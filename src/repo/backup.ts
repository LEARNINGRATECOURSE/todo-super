import { db, SCHEMA_VERSION } from '../db/database';
import { TABLE_NAMES, type TableName } from '../db/types';
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
  for (const [name, rows] of Object.entries(d.tables)) {
    if (!(TABLE_NAMES as string[]).includes(name)) continue;
    if (!Array.isArray(rows)) throw new Error(`Backup table "${name}" is malformed.`);
  }
}

/** All-or-nothing restore: validation happens before the existing data is touched. */
export function restoreBackup(json: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('File is not valid JSON.'); }
  validateBackup(parsed);
  db.replaceAll(parsed.tables);
  seedDefaults();
}

export function factoryReset() {
  db.clear();
  seedDefaults();
}
