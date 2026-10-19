import { useMemo } from 'react';
import { addDays, parseDate, todayStr } from '../lib/dates';
import { isScheduledOn } from '../repo/habitRepository';
import { useAppStore } from '../store/useAppStore';

const LEVELS = ['var(--recessed)', 'rgba(255,71,87,.28)', 'rgba(255,71,87,.5)', 'rgba(255,71,87,.75)', 'var(--accent)'];

/** GitHub-style consistency grid. `habitId` null aggregates every active habit. */
export function HabitHeatmap({ habitId, days }: { habitId: string | null; days: number }) {
  const habits = useAppStore((s) => s.habits);
  const logs = useAppStore((s) => s.habitLogs);
  const today = todayStr();
  const { cells, completeDays } = useMemo(() => {
    const byDate = new Map<string, typeof logs>();
    logs.forEach((l) => { if (!habitId || l.habitId === habitId) (byDate.get(l.date) ?? byDate.set(l.date, []).get(l.date)!).push(l); });
    const active = habits.filter((h) => !h.archived && (!habitId || h.id === habitId));
    const start = addDays(today, -(days - 1));
    const pad = parseDate(start).getDay();
    const out: { date: string | null; level: number; label: string }[] = Array.from({ length: pad }, () => ({ date: null, level: 0, label: '' }));
    let complete = 0;
    for (let i = 0; i < days; i++) {
      const date = addDays(start, i);
      const sched = active.filter((h) => isScheduledOn(h, date));
      const dayLogs = byDate.get(date) ?? [];
      const done = sched.filter((h) => dayLogs.find((l) => l.habitId === h.id && l.completed)).length;
      const partial = sched.filter((h) => dayLogs.find((l) => l.habitId === h.id && !l.completed && l.value > 0)).length;
      const ratio = sched.length ? (done + partial * 0.4) / sched.length : 0;
      const level = done === 0 && partial === 0 ? 0 : ratio >= 1 ? 4 : ratio >= 0.7 ? 3 : ratio >= 0.4 ? 2 : 1;
      if (sched.length && done === sched.length) complete++;
      out.push({ date, level, label: `${date}: ${done}/${sched.length} habits` });
    }
    return { cells: out, completeDays: complete };
  }, [habits, logs, habitId, days, today]);
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="heat hide-scroll" role="img" aria-label={`Habit consistency for the last ${days} days: ${completeDays} perfect days`} style={{ direction: 'ltr' }}>
        {cells.map((c, i) => <i key={i} title={c.label} style={{ background: c.date ? LEVELS[c.level] : 'transparent' }} />)}
      </div>
      <div className="row between tiny muted">
        <span className="num">{completeDays} perfect days</span>
        <span className="row" style={{ gap: 3 }}>Less {LEVELS.map((l, i) => <i key={i} style={{ width: 11, height: 11, borderRadius: 3, background: l, display: 'inline-block' }} />)} More</span>
      </div>
    </div>
  );
}
