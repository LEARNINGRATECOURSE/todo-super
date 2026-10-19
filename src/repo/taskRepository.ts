import { db } from '../db/database';
import type { Priority, Project, Subtask, Task, TaskStatus } from '../db/types';
import { diffDays, todayStr, nowIso } from '../lib/dates';
import { nextOccurrence } from '../lib/recurrence';
import { uid } from '../lib/util';

export type TaskInput = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> & { title: string };

export function createTask(input: TaskInput, subtasks: string[] = []): Task {
  const now = nowIso();
  const task: Task = {
    id: uid('t_'), title: input.title.trim(), description: input.description ?? null, status: input.status ?? 'todo',
    priority: input.priority ?? 'medium', category: input.category ?? 'Work', projectId: input.projectId ?? null,
    dueDate: input.dueDate ?? todayStr(), dueTime: input.dueTime ?? null, startTime: input.startTime ?? null,
    endTime: input.endTime ?? null, estimatedMinutes: input.estimatedMinutes ?? 30,
    completed: input.completed ?? 0, recurringRule: input.recurringRule ?? 'none', recurrenceEndDate: input.recurrenceEndDate ?? null,
    recurrenceDays: input.recurrenceDays ?? null, reminderTime: input.reminderTime ?? null, createdAt: now, updatedAt: now,
  };
  db.transaction(() => {
    db.insert('tasks', task);
    subtasks.filter((s) => s.trim()).forEach((title, i) => db.insert('subtasks', { id: uid('s_'), taskId: task.id, title: title.trim(), completed: 0, order: i }));
  });
  return task;
}

export function updateTask(id: string, patch: Partial<Task>) {
  return db.update('tasks', id, { ...patch, updatedAt: nowIso() });
}

export function deleteTask(id: string) {
  db.remove('tasks', id);
}

/** Restores a task and its subtasks (used by undo). */
export function restoreTask(task: Task, subtasks: Subtask[]) {
  db.transaction(() => {
    db.insert('tasks', task);
    subtasks.forEach((s) => db.insert('subtasks', s));
  });
}

export const subtasksOf = (taskId: string) => db.all('subtasks').filter((s) => s.taskId === taskId).sort((a, b) => a.order - b.order);

/** Replaces the subtask list of a task, preserving completion state for unchanged titles. */
export function setSubtasks(taskId: string, items: { title: string; completed?: boolean }[]) {
  db.transaction(() => {
    for (const s of subtasksOf(taskId)) db.remove('subtasks', s.id);
    items.filter((i) => i.title.trim()).forEach((it, order) =>
      db.insert('subtasks', { id: uid('s_'), taskId, title: it.title.trim(), completed: it.completed ? 1 : 0, order }),
    );
  });
}

export function toggleSubtask(id: string) {
  const s = db.get('subtasks', id);
  if (s) db.update('subtasks', id, { completed: s.completed ? 0 : 1 });
}

/**
 * Completes/uncompletes a task. Completing a recurring task spawns its next occurrence
 * (roll-forward recurrence) so every instance keeps its own history.
 * Returns the spawned task, if any.
 */
export function toggleComplete(id: string): { task?: Task; next?: Task } {
  const t = db.get('tasks', id);
  if (!t) return {};
  const completing = !t.completed;
  let next: Task | undefined;
  db.transaction(() => {
    db.update('tasks', id, { completed: completing ? 1 : 0, status: completing ? 'completed' : 'todo', updatedAt: nowIso() });
    if (completing && t.recurringRule !== 'none') {
      // Roll forward past today so completing an overdue instance doesn't leave another overdue copy behind.
      let date = nextOccurrence(t);
      while (date && date <= todayStr()) date = nextOccurrence({ ...t, dueDate: date });
      if (date) {
        const subs = subtasksOf(id).map((s) => s.title);
        next = createTask({ ...t, dueDate: date, completed: 0, status: 'todo' }, subs);
      }
    }
  });
  return { task: db.get('tasks', id), next };
}

export function setStatus(id: string, status: TaskStatus) {
  // Moving into Done is completing: go through toggleComplete so recurring tasks spawn their next occurrence.
  const t = db.get('tasks', id);
  if (status === 'completed' && t && !t.completed) { toggleComplete(id); return; }
  db.update('tasks', id, { status, completed: status === 'completed' ? 1 : 0, updatedAt: nowIso() });
}

export function createProject(name: string, color: string): Project {
  const p: Project = { id: uid('p_'), name: name.trim(), color, icon: 'folder', createdAt: nowIso() };
  db.insert('projects', p);
  return p;
}
export function deleteProject(id: string) {
  db.transaction(() => {
    db.all('tasks').filter((t) => t.projectId === id).forEach((t) => db.update('tasks', t.id, { projectId: null }));
    db.remove('projects', id);
  });
}

/** Eisenhower quadrant: important = high/medium-priority, urgent = due within 2 days (or overdue). */
export type Quadrant = 'do' | 'schedule' | 'delegate' | 'eliminate';
export function quadrantOf(t: Task, today = todayStr()): Quadrant {
  const important = t.priority === 'high';
  const urgent = diffDays(t.dueDate, today) <= 2;
  if (important && urgent) return 'do';
  if (important) return 'schedule';
  if (urgent) return 'delegate';
  return 'eliminate';
}

export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
export const taskStart = (t: Task) => t.startTime ?? t.dueTime;
