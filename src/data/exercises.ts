import type { Exercise, ExerciseCategory, Muscle } from '../db/types';

type Seed = [name: string, muscle: Muscle, category: ExerciseCategory, secondary: string];

const SEEDS: Seed[] = [
  // Chest
  ['Barbell Bench Press', 'Chest', 'Barbell', 'Triceps, Front Delts'],
  ['Incline Barbell Bench Press', 'Chest', 'Barbell', 'Front Delts, Triceps'],
  ['Dumbbell Bench Press', 'Chest', 'Dumbbell', 'Triceps'],
  ['Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Front Delts'],
  ['Cable Fly', 'Chest', 'Cable', 'Front Delts'],
  ['Pec Deck', 'Chest', 'Machine', 'Front Delts'],
  ['Push-Up', 'Chest', 'Bodyweight', 'Triceps, Core'],
  ['Dip', 'Chest', 'Bodyweight', 'Triceps'],
  // Back
  ['Deadlift', 'Back', 'Barbell', 'Glutes, Hamstrings'],
  ['Barbell Row', 'Back', 'Barbell', 'Biceps, Rear Delts'],
  ['Pendlay Row', 'Back', 'Barbell', 'Biceps'],
  ['Pull-Up', 'Back', 'Bodyweight', 'Biceps'],
  ['Chin-Up', 'Back', 'Bodyweight', 'Biceps'],
  ['Lat Pulldown', 'Back', 'Cable', 'Biceps'],
  ['Seated Cable Row', 'Back', 'Cable', 'Biceps'],
  ['One-Arm Dumbbell Row', 'Back', 'Dumbbell', 'Biceps'],
  ['T-Bar Row', 'Back', 'Barbell', 'Biceps'],
  ['Face Pull', 'Back', 'Cable', 'Rear Delts'],
  // Legs
  ['Barbell Back Squat', 'Legs', 'Barbell', 'Glutes, Core'],
  ['Front Squat', 'Legs', 'Barbell', 'Core'],
  ['Romanian Deadlift', 'Legs', 'Barbell', 'Glutes, Lower Back'],
  ['Leg Press', 'Legs', 'Machine', 'Glutes'],
  ['Bulgarian Split Squat', 'Legs', 'Dumbbell', 'Glutes'],
  ['Walking Lunge', 'Legs', 'Dumbbell', 'Glutes'],
  ['Leg Extension', 'Legs', 'Machine', ''],
  ['Lying Leg Curl', 'Legs', 'Machine', ''],
  ['Hip Thrust', 'Legs', 'Barbell', 'Glutes'],
  ['Standing Calf Raise', 'Legs', 'Machine', 'Calves'],
  ['Seated Calf Raise', 'Legs', 'Machine', 'Calves'],
  ['Goblet Squat', 'Legs', 'Dumbbell', 'Glutes, Core'],
  // Shoulders
  ['Overhead Press', 'Shoulders', 'Barbell', 'Triceps'],
  ['Seated Dumbbell Press', 'Shoulders', 'Dumbbell', 'Triceps'],
  ['Arnold Press', 'Shoulders', 'Dumbbell', 'Triceps'],
  ['Lateral Raise', 'Shoulders', 'Dumbbell', ''],
  ['Cable Lateral Raise', 'Shoulders', 'Cable', ''],
  ['Rear Delt Fly', 'Shoulders', 'Dumbbell', 'Upper Back'],
  ['Barbell Shrug', 'Shoulders', 'Barbell', 'Traps'],
  // Arms
  ['Barbell Curl', 'Arms', 'Barbell', 'Forearms'],
  ['Dumbbell Curl', 'Arms', 'Dumbbell', 'Forearms'],
  ['Hammer Curl', 'Arms', 'Dumbbell', 'Forearms'],
  ['Preacher Curl', 'Arms', 'Machine', ''],
  ['Triceps Pushdown', 'Arms', 'Cable', ''],
  ['Skull Crusher', 'Arms', 'Barbell', ''],
  ['Overhead Triceps Extension', 'Arms', 'Dumbbell', ''],
  ['Close-Grip Bench Press', 'Arms', 'Barbell', 'Chest'],
  // Core
  ['Plank', 'Core', 'Bodyweight', ''],
  ['Hanging Leg Raise', 'Core', 'Bodyweight', 'Hip Flexors'],
  ['Cable Crunch', 'Core', 'Cable', ''],
  ['Ab Wheel Rollout', 'Core', 'Bodyweight', ''],
  ['Russian Twist', 'Core', 'Bodyweight', 'Obliques'],
  // Cardio
  ['Treadmill Run', 'Cardio', 'Cardio', ''],
  ['Rowing Machine', 'Cardio', 'Cardio', 'Back'],
  ['Stationary Bike', 'Cardio', 'Cardio', ''],
  ['Jump Rope', 'Cardio', 'Cardio', 'Calves'],
  ['Kettlebell Swing', 'Cardio', 'Dumbbell', 'Glutes'],
  ['Burpee', 'Cardio', 'Bodyweight', 'Chest'],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export const exerciseIdFor = (name: string) => `ex-${slug(name)}`;

export const SEED_EXERCISES: Exercise[] = SEEDS.map(([name, muscle, category, secondary]) => ({
  id: exerciseIdFor(name),
  name,
  muscle,
  category,
  equipment: category === 'Bodyweight' ? 'None' : category,
  isCustom: 0,
  instructions: null,
  isFavorite: 0,
  primaryMuscle: muscle,
  secondaryMuscles: secondary || null,
  tags: '[]',
}));

export const MUSCLES: Muscle[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
export const CATEGORIES: ExerciseCategory[] = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Cardio'];
