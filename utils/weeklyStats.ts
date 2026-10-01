import { getWeekStart, formatDate } from "./weekUtils";
import { workoutApi } from "../services/api";

/* 🔹 Week range */
export function getCurrentWeekRange() {
  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    weekStart,
    weekEnd,
    weekStartStr: formatDate(weekStart),
    weekEndStr: formatDate(weekEnd),
  };
}

/* 🔹 Weekly stats */
export async function getWeeklyWorkoutStats() {
  const { weekStartStr, weekEndStr } = getCurrentWeekRange();
  const result = await workoutApi.list({
    startDate: weekStartStr,
    endDate: weekEndStr,
    limit: 1000,
  });
  const workouts = result.workouts ?? [];

  let sets = 0;
  let reps = 0;
  let volume = 0;

  for (const workout of workouts) {
    for (const set of workout.sets) {
      sets++;
      reps += set.reps;
      volume += set.reps * set.weight;
    }
  }

  return { workouts: workouts.length, sets, reps, volume };
}

export async function getWorkoutStreak(): Promise<number> {
  const allWorkouts = await workoutApi.listAll();
  if (allWorkouts.length === 0) return 0;

  const weekSet = new Set<string>();
  for (const workout of allWorkouts) {
    const weekStart = getWeekStart(new Date(workout.date));
    weekSet.add(formatDate(weekStart));
  }

  const weeks = Array.from(weekSet).sort((a, b) => (a > b ? -1 : 1));
  let streak = 0;
  let currentWeek = formatDate(getWeekStart(new Date()));

  for (const week of weeks) {
    if (week === currentWeek) {
      streak++;
      const d = new Date(currentWeek);
      d.setDate(d.getDate() - 7);
      currentWeek = formatDate(d);
    } else {
      break;
    }
  }

  return streak;
}

export async function getWeeklyWorkoutTrends() {
  const allWorkouts = await workoutApi.listAll();

  const map: Record<string, { workouts: number; volume: number }> = {};

  for (const workout of allWorkouts) {
    const weekStart = formatDate(getWeekStart(new Date(workout.date)));
    if (!map[weekStart]) map[weekStart] = { workouts: 0, volume: 0 };
    map[weekStart].workouts++;
    for (const set of workout.sets) {
      map[weekStart].volume += set.reps * set.weight;
    }
  }

  return Object.entries(map)
    .map(([week, stats]) => ({ week, workouts: stats.workouts, volume: stats.volume }))
    .sort((a, b) => (a.week > b.week ? 1 : -1));
}
