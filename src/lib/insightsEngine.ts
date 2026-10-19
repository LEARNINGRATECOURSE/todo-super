import type { Habit, HabitLog, PomodoroSession, Task, WorkoutSession } from '../db/types';
import { DAY_NAMES, addDays, diffDays, isoToLocalDate, range, todayStr, weekday } from './dates';
import { avg, sum } from './util';

export interface InsightData {
  tasks: Task[]; sessions: WorkoutSession[]; habits: Habit[]; habitLogs: HabitLog[]; pomodoros: PomodoroSession[];
  isScheduled: (h: Habit, date: string) => boolean;
}
export interface Insight { id: string; icon: string; title: string; body: string; metric: string }

const WINDOW = 90;

export function generateInsights(d: InsightData, today = todayStr()): Insight[] {
  const out: Insight[] = [];
  const completed = d.tasks.filter((t) => t.completed);
  const doneByDay: Record<string, number> = {};
  completed.forEach((t) => { const k = isoToLocalDate(t.updatedAt); doneByDay[k] = (doneByDay[k] ?? 0) + 1; });
  const workoutDays = new Set(d.sessions.map((s) => s.date));

  const activeDates = [...Object.keys(doneByDay), ...workoutDays, ...d.habitLogs.map((l) => l.date)].sort();
  const first = activeDates[0];
  const from = first && diffDays(today, first) < WINDOW ? first : addDays(today, -WINDOW);
  // Today is still in progress, so only fully elapsed days are analysed.
  const days = range(from, addDays(today, -1));

  // 1. Workout ↔ task correlation
  const wDays = days.filter((x) => workoutDays.has(x));
  const rDays = days.filter((x) => !workoutDays.has(x));
  if (wDays.length >= 3 && rDays.length >= 3) {
    const a = avg(wDays.map((x) => doneByDay[x] ?? 0));
    const b = avg(rDays.map((x) => doneByDay[x] ?? 0));
    if (b > 0 && a > 0) {
      const pct = Math.round(((a - b) / b) * 100);
      out.push({
        id: 'workout-task', icon: 'Dumbbell', metric: `${pct >= 0 ? '+' : ''}${pct}%`,
        title: 'Workout momentum',
        body: pct >= 0
          ? `You complete ${pct}% more tasks on days you work out (${a.toFixed(1)} vs ${b.toFixed(1)} per day).`
          : `You complete ${Math.abs(pct)}% fewer tasks on workout days (${a.toFixed(1)} vs ${b.toFixed(1)}). Try lighter task loads on lifting days.`,
      });
    }
  }

  // 2. Habit ↔ workout synergy
  if (wDays.length >= 5) {
    const rows = d.habits.filter((h) => !h.archived).map((h) => {
      const logs = new Map(d.habitLogs.filter((l) => l.habitId === h.id).map((l) => [l.date, l]));
      const applicable = wDays.filter((x) => d.isScheduled(h, x));
      const done = applicable.filter((x) => logs.get(x)?.completed).length;
      return { h, rate: applicable.length ? done / applicable.length : 0, n: applicable.length };
    }).filter((r) => r.n >= 5).sort((a, b) => b.rate - a.rate);
    const best = rows[0];
    if (best && best.rate >= 0.5) {
      out.push({
        id: 'habit-workout', icon: 'Link', metric: `${Math.round(best.rate * 100)}%`,
        title: 'Routine anchor',
        body: `On ${Math.round(best.rate * 100)}% of days you work out, you also complete ${best.h.icon} ${best.h.name}. Stack them to lock both in.`,
      });
    }
  }

  // 3. Circadian peak window
  const hours = completed.map((t) => new Date(t.updatedAt).getHours());
  if (hours.length >= 5) {
    const buckets = { Morning: hours.filter((h) => h < 12).length, Afternoon: hours.filter((h) => h >= 12 && h < 17).length, Evening: hours.filter((h) => h >= 17).length };
    const [name, n] = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    const share = Math.round((n / hours.length) * 100);
    const window = name === 'Morning' ? 'before 12 PM' : name === 'Afternoon' ? '12–5 PM' : 'after 5 PM';
    out.push({ id: 'circadian', icon: 'Sun', metric: name, title: 'Peak velocity window', body: `${share}% of your tasks are finished in the ${name.toLowerCase()} (${window}). Schedule deep work there.` });
  }

  // 4. Power day
  if (days.length >= 14) {
    const byDow = (fn: (date: string) => number) => {
      const s: number[] = Array(7).fill(0), c: number[] = Array(7).fill(0);
      days.forEach((x) => { s[weekday(x)] += fn(x); c[weekday(x)]++; });
      return s.map((v, i) => (c[i] ? v / c[i] : 0));
    };
    const tasks = byDow((x) => doneByDay[x] ?? 0);
    const workouts = byDow((x) => (workoutDays.has(x) ? 1 : 0));
    const habits = byDow((x) => {
      const hs = d.habits.filter((h) => !h.archived && d.isScheduled(h, x));
      if (!hs.length) return 0;
      return hs.filter((h) => d.habitLogs.some((l) => l.habitId === h.id && l.date === x && l.completed)).length / hs.length;
    });
    const norm = (xs: number[]) => { const m = Math.max(...xs); return xs.map((v) => (m > 0 ? v / m : 0)); };
    const [nt, nw, nh] = [norm(tasks), norm(workouts), norm(habits)];
    const score = DAY_NAMES.map((_, i) => (nt[i] + nw[i] + nh[i]) / 3);
    const best = score.indexOf(Math.max(...score));
    if (score[best] > 0) {
      out.push({
        id: 'power-day', icon: 'Zap', metric: DAY_NAMES[best].slice(0, 3),
        title: 'Power day',
        body: `${DAY_NAMES[best]} is your strongest day across tasks, habits and workouts (score ${(score[best] * 100).toFixed(0)}/100).`,
      });
    }
  }

  // 5. Deep work momentum
  const work = d.pomodoros.filter((p) => p.type === 'work');
  if (work.length) {
    const mins = sum(work.map((p) => p.durationMinutes));
    out.push({
      id: 'deep-work', icon: 'Timer', metric: `${(mins / 60).toFixed(1)}h`,
      title: 'Deep work momentum',
      body: `${(mins / 60).toFixed(1)} focus hours across ${work.length} sessions — average block ${Math.round(mins / work.length)} min.`,
    });
  }
  return out;
}
