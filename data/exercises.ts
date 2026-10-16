export type ExerciseCategory =
  | "Chest"
  | "Shoulders"
  | "Back"
  | "Legs"
  | "Arms"
  | "Abs"
  | "Cardio"
  | "Full Body";

export const EXERCISES: Record<ExerciseCategory, string[]> = {
  Chest: [
    // Barbell
    "Barbell Bench Press",
    "Incline Barbell Bench Press",
    "Decline Barbell Bench Press",
    "Close-Grip Bench Press",
    // Dumbbell
    "Dumbbell Bench Press",
    "Incline Dumbbell Press",
    "Decline Dumbbell Press",
    "Dumbbell Fly",
    "Incline Dumbbell Fly",
    "Dumbbell Pullover",
    // Machine/Cable
    "Cable Crossover",
    "Low Cable Crossover",
    "High Cable Crossover",
    "Chest Press Machine",
    "Pec Deck Machine",
    "Smith Machine Bench Press",
    // Bodyweight
    "Push Ups",
    "Wide Push Ups",
    "Diamond Push Ups",
    "Incline Push Ups",
    "Decline Push Ups",
    "Dips (Chest)",
  ],
  Shoulders: [
    // Barbell
    "Barbell Overhead Press",
    "Military Press",
    "Behind Neck Press",
    "Barbell Upright Row",
    // Dumbbell
    "Dumbbell Shoulder Press",
    "Arnold Press",
    "Lateral Raise",
    "Front Raise",
    "Rear Delt Fly",
    "Dumbbell Shrugs",
    "Dumbbell Upright Row",
    // Cable/Machine
    "Cable Lateral Raise",
    "Cable Front Raise",
    "Face Pull",
    "Reverse Pec Deck",
    "Machine Shoulder Press",
    // Other
    "Handstand Push Ups",
    "Pike Push Ups",
    "Barbell Shrugs",
    "Landmine Press",
  ],
  Back: [
    // Pull Movements
    "Pull Ups",
    "Wide Grip Pull Ups",
    "Close Grip Pull Ups",
    "Chin Ups",
    "Lat Pulldown",
    "Close Grip Lat Pulldown",
    "Straight Arm Pulldown",
    // Row Movements
    "Barbell Row",
    "Pendlay Row",
    "T-Bar Row",
    "Dumbbell Row",
    "Seated Cable Row",
    "One Arm Cable Row",
    "Machine Row",
    "Inverted Row",
    // Other
    "Deadlift",
    "Rack Pull",
    "Hyperextension",
    "Good Morning",
    "Cable Pullover",
    "Meadows Row",
  ],
  Legs: [
    // Squat Variations
    "Barbell Back Squat",
    "Bodyweight Squat",
    "Front Squat",
    "Goblet Squat",
    "Hack Squat",
    "Leg Press",
    "Smith Machine Squat",
    "Bulgarian Split Squat",
    "Sissy Squat",
    // Lunge Variations
    "Walking Lunges",
    "Reverse Lunges",
    "Side Lunges",
    "Step Ups",
    // Leg Extensions/Curls
    "Leg Extension",
    "Lying Leg Curl",
    "Seated Leg Curl",
    "Standing Leg Curl",
    // Posterior Chain
    "Romanian Deadlift",
    "Stiff Leg Deadlift",
    "Sumo Deadlift",
    "Hip Thrust",
    "Glute Bridge",
    "Cable Pull Through",
    // Calves
    "Standing Calf Raise",
    "Seated Calf Raise",
    "Donkey Calf Raise",
    "Leg Press Calf Raise",
    // Other
    "Box Jumps",
    "Wall Sit",
  ],
  Arms: [
    // Biceps - Barbell
    "Barbell Curl",
    "EZ Bar Curl",
    "Preacher Curl",
    "Drag Curl",
    // Biceps - Dumbbell
    "Dumbbell Curl",
    "Hammer Curl",
    "Incline Dumbbell Curl",
    "Concentration Curl",
    "Cross Body Curl",
    "Zottman Curl",
    // Biceps - Cable/Machine
    "Cable Curl",
    "Rope Hammer Curl",
    "Machine Preacher Curl",
    // Triceps - Compound
    "Close Grip Bench Press",
    "Dips (Triceps)",
    "Diamond Push Ups",
    // Triceps - Extension
    "Skull Crushers",
    "Overhead Tricep Extension",
    "Dumbbell Kickback",
    "Tricep Pushdown",
    "Rope Pushdown",
    "Reverse Grip Pushdown",
    // Forearms
    "Wrist Curl",
    "Reverse Wrist Curl",
    "Reverse Curl",
    "Plate Pinch",
    "Dead Hang",
    "Farmer's Walk",
  ],
  Abs: [
    // Upper Abs
    "Crunches",
    "Cable Crunch",
    "Machine Crunch",
    "Decline Sit Ups",
    // Lower Abs
    "Leg Raise",
    "Hanging Leg Raise",
    "Reverse Crunch",
    "Captain's Chair Leg Raise",
    // Obliques
    "Russian Twist",
    "Side Plank",
    "Bicycle Crunch",
    "Wood Chops",
    "Oblique Crunch",
    // Planks
    "Plank",
    "Weighted Plank",
    "Plank Jacks",
    "Mountain Climbers",
    // Other
    "Ab Wheel Rollout",
    "Dead Bug",
    "Hollow Body Hold",
    "V-Ups",
    "Toe Touches",
    "Flutter Kicks",
  ],
  Cardio: [
    "Treadmill Running",
    "Treadmill Walking (Incline)",
    "Stationary Bike",
    "Elliptical",
    "Rowing Machine",
    "Stair Climber",
    "Jump Rope",
    "Battle Ropes",
    "Burpees",
    "Jumping Jacks",
    "High Knees",
    "Sprints",
    "Box Jumps",
    "Cycling",
    "Swimming",
  ],
  "Full Body": [
    "Deadlift",
    "Clean and Press",
    "Clean and Jerk",
    "Snatch",
    "Thruster",
    "Turkish Get Up",
    "Burpees",
    "Kettlebell Swing",
    "Man Makers",
    "Bear Crawl",
    "Sled Push",
    "Sled Pull",
    "Farmer's Walk",
  ],
};
