import { db } from '../db/database';
import type { PomodoroSession } from '../db/types';
import { nowIso } from '../lib/dates';
import { uid } from '../lib/util';

export function logPomodoro(p: { durationMinutes: number; type: 'work' | 'break'; taskId: string | null; taskTitle: string | null }): PomodoroSession {
  const row: PomodoroSession = { id: uid('pm_'), ...p, completedAt: nowIso() };
  db.insert('pomodoro_sessions', row);
  return row;
}
