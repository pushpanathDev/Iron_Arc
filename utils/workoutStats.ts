export function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
}

export function calculateWeeklyReps(workouts: any[]) {
  const weekStart = getStartOfWeek();
  let totalReps = 0;

  workouts.forEach((workout) => {
    const workoutDate = new Date(workout.createdAt);
    if (workoutDate >= weekStart) {
      workout.sets?.forEach((set: any) => {
        totalReps += Number(set.reps || 0);
      });
    }
  });

  return totalReps;
}

export function calculateWorkoutStreak(workouts: any[]) {
  const uniqueDays = Array.from(
    new Set(workouts.map((w) => new Date(w.createdAt).toDateString()))
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let streak = 0;
  let currentDate = new Date();

  for (const day of uniqueDays) {
    if (day === currentDate.toDateString()) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
