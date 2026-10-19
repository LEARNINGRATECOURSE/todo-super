import { TABLE_NAMES, type TableMap, type TableName } from './types';

/** Storage-agnostic contract; the web build implements it on top of localStorage. */
export interface DatabaseInterface {
  all<T extends TableName>(table: T): TableMap[T][];
  get<T extends TableName>(table: T, id: string): TableMap[T] | undefined;
  insert<T extends TableName>(table: T, row: TableMap[T]): TableMap[T];
  update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>): TableMap[T] | undefined;
  remove<T extends TableName>(table: T, id: string): void;
  snapshot(): Record<TableName, unknown[]>;
  replaceAll(data: Partial<Record<TableName, unknown[]>>): void;
  clear(): void;
  transaction<R>(fn: () => R): R;
}

const STORAGE_KEY = 'taskflow.db.v1';
export const SCHEMA_VERSION = 1;

/** Primary key per table (app_settings is keyed by `key`). */
const pk = (t: TableName) => (t === 'app_settings' ? 'key' : 'id');

/** ON DELETE CASCADE map: parent table -> [child table, child FK column]. */
const CASCADES: Partial<Record<TableName, [TableName, string][]>> = {
  tasks: [['subtasks', 'taskId']],
  habits: [['habit_logs', 'habitId']],
  workout_routines: [['routine_days', 'routineId']],
  routine_days: [['routine_exercises', 'routineDayId']],
  workout_sessions: [['exercise_sets', 'sessionId']],
  exercises: [['routine_exercises', 'exerciseId'], ['exercise_sets', 'exerciseId']],
};

type Tables = { [K in TableName]: TableMap[K][] };
const emptyTables = (): Tables =>
  Object.fromEntries(TABLE_NAMES.map((t) => [t, []])) as unknown as Tables;

type Listener = () => void;

export class WebDatabase implements DatabaseInterface {
  private tables: Tables = emptyTables();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private depth = 0;
  private dirty = false;
  private listeners = new Set<Listener>();
  /** Set when the last persist failed (e.g. quota exceeded). */
  lastError: string | null = null;

  constructor(private storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flush());
      document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && this.flush());
    }
  }

  private load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { tables?: Partial<Tables> };
      for (const t of TABLE_NAMES) {
        const rows = parsed.tables?.[t];
        if (Array.isArray(rows)) (this.tables[t] as unknown[]) = rows;
      }
    } catch (err) {
      console.warn('Database load failed, starting empty', err);
    }
  }

  onChange(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private touch() {
    this.dirty = true;
    if (this.depth > 0) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 120);
    this.listeners.forEach((l) => l());
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.dirty || !this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, tables: this.tables }));
      this.dirty = false;
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Storage write failed';
      console.error('Database persist failed', err);
    }
  }

  all<T extends TableName>(table: T): TableMap[T][] {
    return this.tables[table] as TableMap[T][];
  }
  get<T extends TableName>(table: T, id: string): TableMap[T] | undefined {
    const key = pk(table);
    return (this.tables[table] as unknown as Record<string, unknown>[]).find((r) => r[key] === id) as TableMap[T] | undefined;
  }
  insert<T extends TableName>(table: T, row: TableMap[T]): TableMap[T] {
    const key = pk(table);
    const rows = this.tables[table] as unknown as Record<string, unknown>[];
    const idx = rows.findIndex((r) => r[key] === (row as unknown as Record<string, unknown>)[key]);
    if (idx >= 0) rows[idx] = row as unknown as Record<string, unknown>;
    else rows.push(row as unknown as Record<string, unknown>);
    this.touch();
    return row;
  }
  update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>): TableMap[T] | undefined {
    const key = pk(table);
    const rows = this.tables[table] as unknown as Record<string, unknown>[];
    const idx = rows.findIndex((r) => r[key] === id);
    if (idx < 0) return undefined;
    // Replace (not mutate) the row so React selectors see a new reference.
    const next = { ...rows[idx], ...patch } as unknown as TableMap[T];
    rows[idx] = next as unknown as Record<string, unknown>;
    this.touch();
    return next;
  }
  remove<T extends TableName>(table: T, id: string): void {
    const key = pk(table);
    const rows = this.tables[table] as unknown as Record<string, unknown>[];
    const idx = rows.findIndex((r) => r[key] === id);
    if (idx < 0) return;
    rows.splice(idx, 1);
    for (const [child, fk] of CASCADES[table] ?? []) {
      const kids = (this.tables[child] as unknown as Record<string, unknown>[]).filter((r) => r[fk] === id);
      for (const k of kids) this.remove(child, k[pk(child)] as string);
    }
    this.touch();
  }
  /** Deletes every row matching a predicate (used for cascades by non-id columns). */
  removeWhere<T extends TableName>(table: T, pred: (r: TableMap[T]) => boolean) {
    for (const r of [...this.all(table)].filter(pred)) this.remove(table, (r as unknown as Record<string, string>)[pk(table)]);
  }

  /** Groups many writes into one persist + one change notification. */
  transaction<R>(fn: () => R): R {
    this.depth++;
    const backup = JSON.stringify(this.tables);
    try {
      return fn();
    } catch (err) {
      this.tables = JSON.parse(backup);
      throw err;
    } finally {
      this.depth--;
      if (this.depth === 0 && this.dirty) {
        this.dirty = true;
        this.touch();
      }
    }
  }

  snapshot(): Record<TableName, unknown[]> {
    return JSON.parse(JSON.stringify(this.tables));
  }

  /** Atomic replace: the new tables are built fully before swapping, so a bad payload can't half-apply. */
  replaceAll(data: Partial<Record<TableName, unknown[]>>) {
    const next = emptyTables();
    for (const t of TABLE_NAMES) {
      const rows = data[t];
      if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Invalid backup: ${t} is not a list`);
      (next[t] as unknown[]) = rows ? JSON.parse(JSON.stringify(rows)) : [];
    }
    this.tables = next;
    this.touch();
    this.flush();
  }

  clear() {
    this.tables = emptyTables();
    this.touch();
    this.flush();
  }
}

export const db = new WebDatabase();
