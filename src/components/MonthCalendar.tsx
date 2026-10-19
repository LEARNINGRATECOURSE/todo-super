import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DAY_LETTERS, MONTH_NAMES, addDays, daysInMonth, toDateStr, todayStr } from '../lib/dates';
import { isScheduledOn } from '../repo/habitRepository';
import { useAppStore } from '../store/useAppStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { Button, IconButton } from './ui';

const DOT = { task: '#2f6fed', workout: '#1f9d55', habit: '#8b5cf6', reminder: '#f26b1d' };

export function MonthCalendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const tasks = useAppStore((s) => s.tasks);
  const habits = useAppStore((s) => s.habits);
  const logs = useAppStore((s) => s.habitLogs);
  const sessions = useWorkoutStore((s) => s.sessions);
  const today = todayStr();
  const [cursor, setCursor] = useState(() => { const [y, m] = selected.split('-').map(Number); return { y, m: m - 1 }; });

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = first.getDay();
    const total = Math.ceil((lead + daysInMonth(cursor.y, cursor.m)) / 7) * 7;
    const start = addDays(toDateStr(first), -lead);
    const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
    const byDate = {
      task: new Set(tasks.map((t) => t.dueDate)),
      reminder: new Set(tasks.filter((t) => t.reminderTime && !t.completed).map((t) => t.dueDate)),
      workout: new Set(sessions.map((s) => s.date)),
      habitDone: new Set(logs.filter((l) => l.completed).map((l) => l.date)),
    };
    const activeHabits = habits.some((h) => !h.archived);
    return Array.from({ length: total }, (_, i) => {
      const date = addDays(start, i);
      const dots: string[] = [];
      if (byDate.task.has(date)) dots.push(DOT.task);
      if (byDate.workout.has(date)) dots.push(DOT.workout);
      // Past/today: completed habits; today also shows active habits
      if (byDate.habitDone.has(date) || (date === today && activeHabits && habits.some((h) => !h.archived && isScheduledOn(h, date)))) dots.push(DOT.habit);
      if (byDate.reminder.has(date)) dots.push(DOT.reminder);
      return { date, inMonth: date.startsWith(monthPrefix), dots };
    });
  }, [cursor, tasks, habits, logs, sessions, today]);

  const move = (n: number) => setCursor((c) => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row between">
        <IconButton label="Previous month" onClick={() => move(-1)}><ChevronLeft size={20} /></IconButton>
        <div style={{ textAlign: 'center' }}>
          <div className="h2">{MONTH_NAMES[cursor.m]} {cursor.y}</div>
        </div>
        <IconButton label="Next month" onClick={() => move(1)}><ChevronRight size={20} /></IconButton>
      </div>
      <div className="cal-grid" role="grid" aria-label="Month calendar">
        {DAY_LETTERS.map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
        {cells.map((c) => (
          <button key={c.date} type="button" className={`cal-day${c.inMonth ? '' : ' out'}${c.date === today ? ' today' : ''}`} aria-pressed={c.date === selected} aria-label={c.date}
            onClick={() => { onSelect(c.date); if (!c.inMonth) { const [y, m] = c.date.split('-').map(Number); setCursor({ y, m: m - 1 }); } }}>
            {Number(c.date.slice(8))}
            <span className="dots">{c.dots.slice(0, 4).map((color, i) => <i key={i} style={{ background: color }} />)}</span>
          </button>
        ))}
      </div>
      <div className="row between wrap">
        <div className="row wrap" style={{ gap: 12 }}>
          {([['task', 'Tasks'], ['workout', 'Workouts'], ['habit', 'Habits'], ['reminder', 'Reminders']] as const).map(([k, l]) => (
            <span key={k} className="row tiny muted" style={{ gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: 9, background: DOT[k] }} /> {l}</span>
          ))}
        </div>
        <Button sm onClick={() => { onSelect(today); setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }); }}>Today</Button>
      </div>
    </div>
  );
}
