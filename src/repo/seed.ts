import { db } from '../db/database';
import { SEED_EXERCISES } from '../data/exercises';
import { seedAchievements } from '../data/achievements';
import { addDays, todayStr } from '../lib/dates';
import { uid } from '../lib/util';
import { getSetting, setSetting } from './settings';

/** Idempotent: ensures the exercise library, achievements and default challenges exist. */
export function seedDefaults() {
  db.transaction(() => {
    const have = new Set(db.all('exercises').map((e) => e.id));
    SEED_EXERCISES.forEach((e) => { if (!have.has(e.id)) db.insert('exercises', e); });
    const ach = new Set(db.all('workout_achievements').map((a) => a.id));
    seedAchievements().forEach((a) => { if (!ach.has(a.id)) db.insert('workout_achievements', a); });
    if (!getSetting('challengesSeeded')) {
      const deadline = addDays(todayStr(), 30);
      db.insert('workout_challenges', { id: uid('c_'), title: 'Monthly Volume Push', description: 'Lift 50,000 kg total volume', targetValue: 50000, currentValue: 0, unit: 'kg', deadline, completed: 0, icon: 'Weight' });
      db.insert('workout_challenges', { id: uid('c_'), title: 'Consistency Month', description: 'Complete 12 workouts', targetValue: 12, currentValue: 0, unit: 'sessions', deadline, completed: 0, icon: 'CalendarCheck' });
      setSetting('challengesSeeded', '1');
    }
    if (!db.all('projects').length && !getSetting('projectsSeeded')) {
      const now = new Date().toISOString();
      db.insert('projects', { id: 'p_work', name: 'Work', color: '#2f6fed', icon: 'folder', createdAt: now });
      db.insert('projects', { id: 'p_personal', name: 'Personal', color: '#27a860', icon: 'folder', createdAt: now });
      setSetting('projectsSeeded', '1');
    }
  });
}
