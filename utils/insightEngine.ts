type WorkoutInsightState =
  | "above_average"
  | "below_average"
  | "around_average"
  | "no_data";

const workoutTemplates: Record<WorkoutInsightState, string[]> = {
  above_average: [
    "You trained more consistently than usual this week.",
    "Workout frequency is above your normal average.",
    "Consistency improved this week — keep the momentum.",
  ],
  below_average: [
    "Workout frequency dipped slightly this week.",
    "You trained less than your usual average.",
    "Looks like a lighter training week — recovery or busy schedule?",
  ],
  around_average: [
    "You’re right on track with your usual training pattern.",
    "Workout frequency is consistent with your average.",
    "Steady training rhythm maintained this week.",
  ],
  no_data: ["Log more workouts to unlock weekly insights."],
};

function pickTemplate(templates: string[]) {
  return templates[Math.floor(Math.random() * templates.length)];
}

export function getWorkoutInsight(thisWeek: number, average: number) {
  if (!average || thisWeek === 0) {
    return pickTemplate(workoutTemplates.no_data);
  }

  const diff = thisWeek - average;

  let state: WorkoutInsightState =
    Math.abs(diff) < 0.5
      ? "around_average"
      : diff > 0
      ? "above_average"
      : "below_average";

  return pickTemplate(workoutTemplates[state]);
}
