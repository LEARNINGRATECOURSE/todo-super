export interface ProgramExercise { name: string; sets: number; reps: number; rest: number; weight?: number; superset?: string }
export interface ProgramDay { name: string; exercises: ProgramExercise[] }
export interface Program {
  id: string; name: string; folder: 'Hypertrophy' | 'Strength' | 'Powerlifting' | 'Fat Loss' | 'Deload';
  level: string; daysPerWeek: number; weeks: number; goal: string; description: string; scheduleDays: number[]; days: ProgramDay[];
}
const e = (name: string, sets: number, reps: number, rest = 90, superset?: string): ProgramExercise => ({ name, sets, reps, rest, superset });

const PUSH: ProgramDay = { name: 'Push', exercises: [e('Barbell Bench Press', 4, 6, 150), e('Overhead Press', 3, 8, 120), e('Incline Dumbbell Press', 3, 10), e('Lateral Raise', 4, 15, 60), e('Triceps Pushdown', 3, 12, 60), e('Overhead Triceps Extension', 3, 12, 60)] };
const PULL: ProgramDay = { name: 'Pull', exercises: [e('Deadlift', 3, 5, 180), e('Pull-Up', 4, 8, 120), e('Barbell Row', 3, 8, 120), e('Face Pull', 3, 15, 60), e('Barbell Curl', 3, 10, 60), e('Hammer Curl', 3, 12, 60)] };
const LEGS: ProgramDay = { name: 'Legs', exercises: [e('Barbell Back Squat', 4, 6, 180), e('Romanian Deadlift', 3, 8, 120), e('Leg Press', 3, 12, 120), e('Lying Leg Curl', 3, 12, 75), e('Standing Calf Raise', 4, 12, 60), e('Hanging Leg Raise', 3, 12, 60)] };

export const PROGRAMS: Program[] = [
  {
    id: 'ppl', name: 'Push Pull Legs (PPL)', folder: 'Hypertrophy', level: 'Intermediate', daysPerWeek: 6, weeks: 8, goal: 'Muscle growth',
    description: 'Classic 6-day split hitting every muscle group twice per week with high weekly volume.',
    scheduleDays: [1, 2, 3, 4, 5, 6], days: [PUSH, PULL, LEGS, { ...PUSH, name: 'Push B' }, { ...PULL, name: 'Pull B' }, { ...LEGS, name: 'Legs B' }],
  },
  {
    id: 'upper-lower', name: 'Upper / Lower Strength & Size', folder: 'Strength', level: 'Intermediate', daysPerWeek: 4, weeks: 10, goal: 'Strength + size',
    description: 'Four-day upper/lower split mixing heavy compound work with hypertrophy accessories.',
    scheduleDays: [1, 2, 4, 5],
    days: [
      { name: 'Upper A (Heavy)', exercises: [e('Barbell Bench Press', 4, 5, 180), e('Barbell Row', 4, 5, 150), e('Overhead Press', 3, 8, 120), e('Lat Pulldown', 3, 10), e('Barbell Curl', 2, 12, 60), e('Skull Crusher', 2, 12, 60)] },
      { name: 'Lower A (Heavy)', exercises: [e('Barbell Back Squat', 4, 5, 180), e('Romanian Deadlift', 3, 8, 150), e('Leg Press', 3, 10, 120), e('Lying Leg Curl', 3, 10, 75), e('Standing Calf Raise', 4, 12, 60)] },
      { name: 'Upper B (Volume)', exercises: [e('Incline Dumbbell Press', 4, 10), e('Seated Cable Row', 4, 10), e('Seated Dumbbell Press', 3, 10), e('Pull-Up', 3, 8, 120), e('Lateral Raise', 3, 15, 60), e('Triceps Pushdown', 3, 12, 60)] },
      { name: 'Lower B (Volume)', exercises: [e('Front Squat', 4, 8, 150), e('Hip Thrust', 3, 10, 120), e('Bulgarian Split Squat', 3, 10), e('Leg Extension', 3, 12, 60), e('Seated Calf Raise', 4, 15, 60), e('Cable Crunch', 3, 15, 60)] },
    ],
  },
  {
    id: 'starting-strength', name: 'Starting Strength 5×5', folder: 'Strength', level: 'Beginner', daysPerWeek: 3, weeks: 12, goal: 'Linear progression',
    description: 'Alternate two simple full-body workouts three times a week and add weight every session.',
    scheduleDays: [1, 3, 5],
    days: [
      { name: 'Workout A', exercises: [e('Barbell Back Squat', 5, 5, 180), e('Barbell Bench Press', 5, 5, 180), e('Barbell Row', 5, 5, 150)] },
      { name: 'Workout B', exercises: [e('Barbell Back Squat', 5, 5, 180), e('Overhead Press', 5, 5, 150), e('Deadlift', 1, 5, 240)] },
    ],
  },
  {
    id: 'powerlifting-peaking', name: 'Powerlifting Peaking S/B/D', folder: 'Powerlifting', level: 'Advanced', daysPerWeek: 4, weeks: 6, goal: 'Meet peaking',
    description: 'Six-week peak for squat, bench and deadlift with low reps, high intensity and minimal accessories.',
    scheduleDays: [1, 2, 4, 5],
    days: [
      { name: 'Squat Day', exercises: [e('Barbell Back Squat', 5, 3, 240), e('Front Squat', 3, 5, 180), e('Hanging Leg Raise', 3, 10, 60)] },
      { name: 'Bench Day', exercises: [e('Barbell Bench Press', 5, 3, 240), e('Close-Grip Bench Press', 3, 6, 150), e('Barbell Row', 3, 8, 120)] },
      { name: 'Deadlift Day', exercises: [e('Deadlift', 5, 2, 270), e('Romanian Deadlift', 3, 6, 150), e('Pull-Up', 3, 8, 120)] },
      { name: 'Bench Volume', exercises: [e('Barbell Bench Press', 4, 5, 180), e('Overhead Press', 3, 5, 150), e('Triceps Pushdown', 3, 12, 60)] },
    ],
  },
  {
    id: 'full-body-shred', name: 'Full Body Shred & Conditioning', folder: 'Fat Loss', level: 'All levels', daysPerWeek: 3, weeks: 8, goal: 'Fat loss',
    description: 'Metabolic full-body circuits with short rests plus finishing conditioning work.',
    scheduleDays: [1, 3, 5],
    days: [
      { name: 'Circuit A', exercises: [e('Goblet Squat', 4, 15, 45), e('Push-Up', 4, 15, 45), e('One-Arm Dumbbell Row', 4, 12, 45), e('Kettlebell Swing', 4, 20, 45), e('Plank', 3, 1, 30)] },
      { name: 'Circuit B', exercises: [e('Walking Lunge', 4, 12, 45), e('Dumbbell Bench Press', 4, 12, 45), e('Lat Pulldown', 4, 12, 45), e('Burpee', 4, 12, 45), e('Russian Twist', 3, 20, 30)] },
      { name: 'Conditioning', exercises: [e('Rowing Machine', 1, 1, 60), e('Jump Rope', 5, 1, 45), e('Treadmill Run', 1, 1, 60), e('Ab Wheel Rollout', 3, 10, 45)] },
    ],
  },
  {
    id: 'arnold-split', name: 'Arnold Classic Volume Split', folder: 'Hypertrophy', level: 'Advanced', daysPerWeek: 6, weeks: 8, goal: 'Maximum volume',
    description: 'Golden-era six-day split built on antagonist supersets: chest + back, shoulders + arms, legs.',
    scheduleDays: [1, 2, 3, 4, 5, 6],
    days: [
      { name: 'Chest & Back', exercises: [e('Barbell Bench Press', 4, 8, 90, 'A1'), e('Pull-Up', 4, 8, 90, 'A2'), e('Incline Barbell Bench Press', 4, 10, 90, 'B1'), e('Barbell Row', 4, 10, 90, 'B2'), e('Cable Fly', 3, 12, 60, 'C1'), e('Seated Cable Row', 3, 12, 60, 'C2')] },
      { name: 'Shoulders & Arms', exercises: [e('Overhead Press', 4, 8, 90), e('Lateral Raise', 4, 12, 60, 'A1'), e('Rear Delt Fly', 4, 12, 60, 'A2'), e('Barbell Curl', 4, 10, 60, 'B1'), e('Skull Crusher', 4, 10, 60, 'B2'), e('Hammer Curl', 3, 12, 60, 'C1'), e('Triceps Pushdown', 3, 12, 60, 'C2')] },
      { name: 'Legs', exercises: [e('Barbell Back Squat', 5, 8, 150), e('Romanian Deadlift', 4, 10, 120), e('Leg Press', 4, 12, 90), e('Lying Leg Curl', 4, 12, 75, 'A1'), e('Leg Extension', 4, 12, 75, 'A2'), e('Standing Calf Raise', 5, 15, 45)] },
      { name: 'Chest & Back B', exercises: [e('Dumbbell Bench Press', 4, 10, 90, 'A1'), e('Lat Pulldown', 4, 10, 90, 'A2'), e('Dip', 3, 12, 90, 'B1'), e('One-Arm Dumbbell Row', 3, 12, 90, 'B2'), e('Pec Deck', 3, 15, 60, 'C1'), e('Face Pull', 3, 15, 60, 'C2')] },
      { name: 'Shoulders & Arms B', exercises: [e('Arnold Press', 4, 10, 90), e('Cable Lateral Raise', 4, 15, 60, 'A1'), e('Barbell Shrug', 4, 12, 60, 'A2'), e('Preacher Curl', 4, 12, 60, 'B1'), e('Overhead Triceps Extension', 4, 12, 60, 'B2'), e('Dumbbell Curl', 3, 12, 60, 'C1'), e('Close-Grip Bench Press', 3, 10, 60, 'C2')] },
      { name: 'Legs B', exercises: [e('Front Squat', 4, 8, 150), e('Hip Thrust', 4, 10, 120), e('Bulgarian Split Squat', 3, 12, 90), e('Seated Calf Raise', 5, 15, 45), e('Cable Crunch', 4, 15, 45), e('Hanging Leg Raise', 4, 12, 45)] },
    ],
  },
];

export const FOLDERS = ['All', 'Hypertrophy', 'Strength', 'Powerlifting', 'Fat Loss', 'Deload'] as const;
