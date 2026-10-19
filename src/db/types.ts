// Row types mirror the 17-table schema from the PRD (JSON columns are stored as strings).

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'archived';
export type Priority = 'low' | 'medium' | 'high';
export type RecurringRule = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  category: string;
  projectId: string | null;
  dueDate: string;
  dueTime: string | null;
  startTime: string | null;
  endTime: string | null;
  estimatedMinutes: number;
  completed: 0 | 1;
  recurringRule: RecurringRule;
  recurrenceEndDate: string | null;
  recurrenceDays: string | null;
  reminderTime: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Subtask { id: string; taskId: string; title: string; completed: 0 | 1; order: number }
export interface Project { id: string; name: string; color: string; icon: string; createdAt: string }

export type HabitType = 'boolean' | 'counter' | 'duration';
export type HabitFrequency = 'daily' | 'weekdays' | 'custom';
export type ScheduleType = 'none' | 'fixed' | 'interval';
export interface ScheduleConfig {
  intervalHours?: number;
  startHour?: number;
  endHour?: number;
  fixedTimes?: string[];
  customDays?: number[]; // 0 = Sunday
}
export interface Habit {
  id: string; name: string; icon: string; color: string; type: HabitType; target: number; unit: string;
  frequency: HabitFrequency; reminderTime: string | null; archived: 0 | 1;
  scheduleType: ScheduleType; scheduleConfig: string | null; chainedHabitId: string | null; frozenDates: string | null;
}
export type HabitStatus = 'missed' | 'partial' | 'full' | 'frozen';
export interface HabitLog {
  id: string; habitId: string; date: string; value: number; completed: 0 | 1;
  checkins: string | null; status: HabitStatus; isFrozen: 0 | 1;
}

export interface WorkoutRoutine {
  id: string; name: string; description: string | null; folder: string; isTemplate: 0 | 1;
  programGoal: string | null; isDeload: 0 | 1; version: number;
  scheduleDays: string; startDate: string | null; skippedDates: string;
}
export interface RoutineDay { id: string; routineId: string; dayName: string; order: number }
export type Muscle = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core' | 'Cardio';
export type ExerciseCategory = 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' | 'Cardio';
export interface Exercise {
  id: string; name: string; muscle: Muscle; category: ExerciseCategory; equipment: string; isCustom: 0 | 1;
  instructions: string | null; isFavorite: 0 | 1; primaryMuscle: string | null; secondaryMuscles: string | null; tags: string;
}
export interface RoutineExercise {
  id: string; routineDayId: string; exerciseId: string; sets: number; reps: number; weight: number;
  rest: number; note: string | null; order: number; supersetGroup: string | null;
}
export interface WorkoutSession {
  id: string; routineId: string | null; routineDayId: string | null; routineName: string | null; dayName: string | null;
  date: string; duration: number; notes: string | null; unit: 'kg' | 'lb'; isDeload: 0 | 1; totalVolume: number; fatigueRating: number;
  startedAt?: string | null;
}
export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure' | 'amrap' | 'rest_pause' | 'superset';
export type WeightType = 'standard' | 'bodyweight' | 'assisted' | 'cardio';
export interface ExerciseSet {
  id: string; sessionId: string; exerciseId: string; setNumber: number; reps: number; weight: number;
  rpe: number | null; rir: number | null; setType: SetType; weightType: WeightType;
  timeSeconds: number | null; distance: number | null; note: string | null; completed: 0 | 1;
}
export interface BodyMeasurement {
  id: string; date: string; weight: number | null; bodyFat: number | null; chest: number | null; waist: number | null;
  hips: number | null; biceps: number | null; thighs: number | null; calves: number | null; notes: string | null; photoUri: string | null;
}
export interface WorkoutAchievement { id: string; code: string; title: string; description: string; icon: string; unlockedAt: string | null }
export interface WorkoutChallenge {
  id: string; title: string; description: string; targetValue: number; currentValue: number; unit: string; deadline: string; completed: 0 | 1; icon: string;
}
export type NoteFolder = 'Personal' | 'Work' | 'Ideas' | 'Journal';
export interface Note { id: string; title: string; content: string; folder: NoteFolder; pinned: 0 | 1; createdAt: string; updatedAt: string }
export interface PomodoroSession { id: string; durationMinutes: number; type: 'work' | 'break'; taskId: string | null; taskTitle: string | null; completedAt: string }
export interface AppSetting { key: string; value: string }

export interface TableMap {
  tasks: Task; subtasks: Subtask; projects: Project; habits: Habit; habit_logs: HabitLog;
  workout_routines: WorkoutRoutine; routine_days: RoutineDay; exercises: Exercise; routine_exercises: RoutineExercise;
  workout_sessions: WorkoutSession; exercise_sets: ExerciseSet; body_measurements: BodyMeasurement;
  workout_achievements: WorkoutAchievement; workout_challenges: WorkoutChallenge; notes: Note;
  pomodoro_sessions: PomodoroSession; app_settings: AppSetting;
}
export type TableName = keyof TableMap;
export const TABLE_NAMES: TableName[] = [
  'projects', 'tasks', 'subtasks', 'habits', 'habit_logs', 'exercises', 'workout_routines', 'routine_days',
  'routine_exercises', 'workout_sessions', 'exercise_sets', 'body_measurements', 'workout_achievements',
  'workout_challenges', 'notes', 'pomodoro_sessions', 'app_settings',
];
