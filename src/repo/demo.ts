import { db } from '../db/database';
import { PROGRAMS } from '../data/programs';
import { addDays, todayStr, weekday } from '../lib/dates';
import { parseJSON, uid } from '../lib/util';
import { createHabit, setHabitValue, toggleSlot, slotsFor } from './habitRepository';
import { createTask } from './taskRepository';
import { importProgram, getRoutineFull, saveSession, type ActiveWorkout } from './workoutRepository';
import { setSetting } from './settings';

/** Mulberry32: deterministic so the demo dataset is reproducible. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TASK_TITLES = ['Review pull requests', 'Write project update', 'Plan sprint backlog', 'Reply to emails', 'Design review', 'Fix flaky test', 'Draft proposal', 'Book dentist', 'Pay invoices', 'Prep 1:1 notes', 'Refactor auth module', 'Grocery run', 'Read research paper', 'Update roadmap'];

export function loadDemoData(days = 60) {
  const rand = rng(42);
  const today = todayStr();
  db.transaction(() => {
    // Routine
    const ppl = importProgram(PROGRAMS[0]);
    setSetting('activeRoutineId', ppl.id);
    db.update('workout_routines', ppl.id, { startDate: addDays(today, -days) });
    const full = getRoutineFull(ppl.id)!;
    const sched = parseJSON<string[]>(full.routine.scheduleDays, []);

    // Habits
    const water = createHabit({ name: 'Drink Water', icon: '💧', color: '#2f6fed', type: 'counter', target: 8, unit: 'glasses' });
    const read = createHabit({ name: 'Read 20 Pages', icon: '📚', color: '#8b5cf6', type: 'counter', target: 20, unit: 'pages' });
    const stretch = createHabit({ name: 'Morning Stretch', icon: '🧘', color: '#27a860', type: 'boolean', chainedHabitId: read.id, reminderTime: '07:00' });
    const vitamins = createHabit({ name: 'Vitamins', icon: '💊', color: '#f59e0b', type: 'boolean', scheduleType: 'fixed', scheduleConfig: JSON.stringify({ fixedTimes: ['08:00', '20:00'] }) });
    const meditate = createHabit({ name: 'Meditate', icon: '🕯️', color: '#ff4757', type: 'duration', target: 10, unit: 'min', frequency: 'weekdays' });
    const hydrate = createHabit({ name: 'Hydrate Break', icon: '🥤', color: '#06b6d4', type: 'boolean', scheduleType: 'interval', scheduleConfig: JSON.stringify({ intervalHours: 4, startHour: 9, endHour: 21 }) });
    db.update('habits', water.id, { chainedHabitId: stretch.id });
    const all = [water, read, stretch, vitamins, meditate, hydrate];

    for (let i = days; i >= 0; i--) {
      const date = addDays(today, -i);
      const dow = weekday(date);
      const isPast = i > 0;
      // Workout
      const planned = sched.includes(String(dow)) && rand() < 0.88;
      let trained = false;
      if (isPast && planned) {
        trained = true;
        let count = 0;
        for (let d = addDays(today, -days); d < date; d = addDays(d, 1)) if (sched.includes(String(weekday(d)))) count++;
        const day = full.days[count % full.days.length];
        const progress = 1 + ((days - i) / days) * 0.12;
        const wo: ActiveWorkout = {
          startedAt: new Date(`${date}T17:00:00`).getTime(), routineId: ppl.id, routineDayId: day.day.id, routineName: ppl.name, dayName: day.day.dayName,
          date, unit: 'kg', isDeload: false, fatigueRating: 2 + Math.floor(rand() * 2), notes: '', restEndsAt: null, restTotal: 0,
          exercises: day.exercises.map(({ re, exercise }) => ({
            exerciseId: exercise.id, rest: re.rest, supersetGroup: null, note: '',
            sets: Array.from({ length: re.sets }, () => ({
              id: uid('ds_'), setType: 'normal' as const, weightType: 'standard' as const,
              weight: Math.round((base(exercise.name) * progress) / 2.5) * 2.5, reps: re.reps + (rand() < 0.3 ? 1 : 0), rpe: 7 + Math.round(rand() * 2), rir: null,
              timeSeconds: null, distance: null, note: '', completed: true,
            })),
          })),
        };
        const { session } = saveSession(wo);
        db.update('workout_sessions', session.id, { duration: 3000 + Math.floor(rand() * 1800) });
      }
      // Tasks
      const n = 3 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) {
        const hour = trained || rand() < 0.5 ? 8 + Math.floor(rand() * 4) : 13 + Math.floor(rand() * 6);
        const t = createTask({
          title: TASK_TITLES[Math.floor(rand() * TASK_TITLES.length)], dueDate: date, startTime: `${String(hour).padStart(2, '0')}:00`,
          estimatedMinutes: [15, 30, 45, 60][Math.floor(rand() * 4)], priority: (['low', 'medium', 'high'] as const)[Math.floor(rand() * 3)],
          category: rand() < 0.6 ? 'Work' : 'Personal', projectId: rand() < 0.6 ? 'p_work' : 'p_personal',
        });
        const doneChance = isPast ? (trained ? 0.9 : 0.62) : 0.3;
        if (rand() < doneChance) {
          const when = new Date(`${date}T${String(Math.min(22, hour + 1)).padStart(2, '0')}:${String(Math.floor(rand() * 59)).padStart(2, '0')}:00`).toISOString();
          db.update('tasks', t.id, { completed: 1, status: 'completed', updatedAt: when });
        } else if (i > 2) db.update('tasks', t.id, { status: 'archived' });
      }
      // Habits
      for (const h of all) {
        if (h.frequency === 'weekdays' && (dow === 0 || dow === 6)) continue;
        const p = trained ? 0.88 : 0.55;
        if (!isPast && i === 0) continue;
        if (rand() > p) continue;
        const slots = slotsFor(h);
        if (slots.length) slots.forEach((s) => rand() < 0.9 && toggleSlot(h, date, s));
        else if (h.type === 'boolean') setHabitValue(h, date, 1);
        else setHabitValue(h, date, Math.round(h.target * (0.7 + rand() * 0.5)));
      }
      // Pomodoro
      if (isPast && rand() < 0.6) {
        const sessions = 1 + Math.floor(rand() * 3);
        for (let s = 0; s < sessions; s++) {
          db.insert('pomodoro_sessions', { id: uid('pm_'), durationMinutes: rand() < 0.5 ? 25 : 50, type: 'work', taskId: null, taskTitle: null, completedAt: new Date(`${date}T${String(9 + s * 2).padStart(2, '0')}:30:00`).toISOString() });
        }
      }
      // Measurements weekly
      if (isPast && i % 7 === 0) {
        db.insert('body_measurements', { id: uid('bm_'), date, weight: Math.round((82 - ((days - i) / days) * 1.5 + rand() * 0.4) * 10) / 10, bodyFat: Math.round((16.5 - ((days - i) / days) + rand() * 0.2) * 10) / 10, chest: null, waist: 84 - (days - i) / 40, hips: null, biceps: null, thighs: null, calves: null, notes: null, photoUri: null });
      }
    }
    const now = new Date().toISOString();
    db.insert('notes', { id: uid('n_'), title: 'Weekly review', folder: 'Journal', pinned: 1, createdAt: now, updatedAt: now, content: '# Weekly review\n\n## Wins\n- Hit every planned workout\n- Shipped the **auth refactor**\n\n## Next week\n- [ ] Plan the sprint\n- [ ] Book a deload week\n- [x] Order new lifting belt\n\n> Consistency beats intensity.' });
    db.insert('notes', { id: uid('n_'), title: 'Project ideas', folder: 'Ideas', pinned: 0, createdAt: now, updatedAt: now, content: '# Ideas\n\n- Habit-stacking widget\n- Auto-deload coach\n- Weekly *insight* email' });
  });
}

function base(name: string): number {
  const table: Record<string, number> = {
    'Barbell Bench Press': 80, 'Overhead Press': 50, 'Incline Dumbbell Press': 28, 'Lateral Raise': 10, 'Triceps Pushdown': 30, 'Overhead Triceps Extension': 20,
    Deadlift: 140, 'Pull-Up': 5, 'Barbell Row': 70, 'Face Pull': 25, 'Barbell Curl': 35, 'Hammer Curl': 16,
    'Barbell Back Squat': 110, 'Romanian Deadlift': 90, 'Leg Press': 200, 'Lying Leg Curl': 45, 'Standing Calf Raise': 80, 'Hanging Leg Raise': 0,
  };
  return table[name] ?? 40;
}
