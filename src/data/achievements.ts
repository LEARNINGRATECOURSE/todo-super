import type { WorkoutAchievement } from '../db/types';

export interface AchievementDef { code: string; title: string; description: string; icon: string }
export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_workout', title: 'First Workout', description: 'Complete your first workout session.', icon: 'Dumbbell' },
  { code: 'ten_workouts', title: 'Getting Serious', description: 'Complete 10 workout sessions.', icon: 'Flame' },
  { code: 'century_club', title: 'Century Club', description: 'Complete 100 workout sessions.', icon: 'Trophy' },
  { code: 'bench_100kg', title: '100kg Bench', description: 'Bench press 100 kg (or 225 lb) for at least one rep.', icon: 'Medal' },
  { code: 'squat_140kg', title: 'Squat Club', description: 'Squat 140 kg (or 315 lb) for at least one rep.', icon: 'Medal' },
  { code: 'deadlift_180kg', title: 'Pull Master', description: 'Deadlift 180 kg (or 405 lb) for at least one rep.', icon: 'Medal' },
  { code: 'ton_session', title: 'Ton Up', description: 'Lift 10,000 kg of total volume in a single session.', icon: 'Weight' },
  { code: 'iron_week', title: 'Iron Week', description: 'Train 4 or more times in a single week.', icon: 'CalendarCheck' },
  { code: 'streak_master', title: 'Streak Master', description: 'Hold a 7-day streak on any habit.', icon: 'Zap' },
  { code: 'pr_hunter', title: 'PR Hunter', description: 'Set 5 all-time personal records.', icon: 'Star' },
  { code: 'deep_focus', title: 'Deep Focus', description: 'Complete 10 Pomodoro focus sessions.', icon: 'Timer' },
];

export const seedAchievements = (): WorkoutAchievement[] =>
  ACHIEVEMENTS.map((a) => ({ id: `ach-${a.code}`, ...a, unlockedAt: null }));
