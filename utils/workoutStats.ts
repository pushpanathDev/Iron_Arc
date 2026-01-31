import { Timestamp } from "firebase/firestore";

export function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
}

/**
 * ✅ TOTAL REPS THIS WEEK
 */
export function calculateWeeklyReps(workouts: any[]) {
  const weekStart = getStartOfWeek();
  let totalReps = 0;

  workouts.forEach((workout) => {
    const workoutDate =
      workout.createdAt instanceof Timestamp
        ? workout.createdAt.toDate()
        : new Date(workout.createdAt);

    if (workoutDate >= weekStart) {
      workout.sets?.forEach((set: any) => {
        totalReps += Number(set.reps || 0);
      });
    }
  });

  return totalReps;
}

/**
 * 🔥 WORKOUT STREAK (based on unique days)
 */
export function calculateWorkoutStreak(workouts: any[]) {
  const uniqueDays = Array.from(
    new Set(
      workouts.map((w) =>
        w.createdAt instanceof Timestamp
          ? w.createdAt.toDate().toDateString()
          : new Date(w.createdAt).toDateString()
      )
    )
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
