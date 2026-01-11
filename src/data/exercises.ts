export type ExerciseCategory =
  | "Chest"
  | "Shoulders"
  | "Back"
  | "Legs"
  | "Arms"
  | "Abs";

export const EXERCISES: Record<ExerciseCategory, string[]> = {
  Chest: [
    "Bench Press",
    "Incline Bench Press",
    "Chest Fly",
    "Push Ups",
  ],
  Shoulders: [
    "Shoulder Press",
    "Lateral Raise",
    "Front Raise",
    "Rear Delt Fly",
  ],
  Back: [
    "Pull Ups",
    "Lat Pulldown",
    "Barbell Row",
    "Seated Cable Row",
  ],
  Legs: [
    "Squats",
    "Leg Press",
    "Lunges",
    "Leg Extension",
    "Leg Curl",
  ],
  Arms: [
    "Bicep Curl",
    "Hammer Curl",
    "Tricep Pushdown",
    "Skull Crushers",
  ],
  Abs: [
    "Crunches",
    "Plank",
    "Hanging Leg Raise",
    "Russian Twist",
  ],
};
