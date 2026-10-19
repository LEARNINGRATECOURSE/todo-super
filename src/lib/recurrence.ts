import type { Task } from '../db/types';
import { addDays, isWeekend, parseDate, toDateStr, weekday } from './dates';
import { parseJSON } from './util';

/** Next due date for a recurring task after `from`, or null if the series has ended. */
export function nextOccurrence(task: Pick<Task, 'recurringRule' | 'dueDate' | 'recurrenceEndDate' | 'recurrenceDays'>): string | null {
  const from = task.dueDate;
  let next: string;
  switch (task.recurringRule) {
    case 'daily':
      next = addDays(from, 1);
      break;
    case 'weekdays': {
      next = addDays(from, 1);
      while (isWeekend(next)) next = addDays(next, 1);
      break;
    }
    case 'weekly':
      next = addDays(from, 7);
      break;
    case 'monthly': {
      const d = parseDate(from);
      const target = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(d.getDate(), last));
      next = toDateStr(target);
      break;
    }
    case 'custom': {
      const days = parseJSON<string[]>(task.recurrenceDays, []).map(Number);
      if (!days.length) return null;
      next = addDays(from, 1);
      for (let i = 0; i < 7 && !days.includes(weekday(next)); i++) next = addDays(next, 1);
      break;
    }
    default:
      return null;
  }
  if (task.recurrenceEndDate && next > task.recurrenceEndDate) return null;
  return next;
}
