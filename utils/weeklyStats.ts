import { getWeekStart, formatDate } from "./weekUtils";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { firestoreDb } from "../firebase/config";

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

  const q = query(
    collection(firestoreDb, "workouts"),
    where("date", ">=", weekStartStr),
    where("date", "<=", weekEndStr)
  );

  const snapshot = await getDocs(q);

  let workouts = snapshot.size;
  let sets = 0;
  let reps = 0;
  let volume = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();

    if (!Array.isArray(data.sets)) return;

    data.sets.forEach((set: any) => {
      sets += 1;
      reps += set.reps || 0;
      volume += (set.reps || 0) * (set.weight || 0);
    });
  });

  return { workouts, sets, reps, volume };
}

export async function getWorkoutStreak(): Promise<number> {
  const snapshot = await getDocs(collection(firestoreDb, "workouts"));

  if (snapshot.empty) return 0;

  // Collect unique weekStart dates
  const weekSet = new Set<string>();

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.date) return;

    const weekStart = getWeekStart(new Date(data.date));
    weekSet.add(formatDate(weekStart));
  });

  // Sort weeks descending (latest first)
  const weeks = Array.from(weekSet).sort((a, b) =>
    a > b ? -1 : 1
  );

  let streak = 0;
  let currentWeek = formatDate(getWeekStart(new Date()));

  for (const week of weeks) {
    if (week === currentWeek) {
      streak++;
      // move to previous week
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
  const snapshot = await getDocs(collection(firestoreDb, "workouts"));

  const map: Record<
    string,
    { workouts: number; volume: number }
  > = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.date || !Array.isArray(data.sets)) return;

    const weekStart = formatDate(
      getWeekStart(new Date(data.date))
    );

    if (!map[weekStart]) {
      map[weekStart] = { workouts: 0, volume: 0 };
    }

    map[weekStart].workouts += 1;

    data.sets.forEach((set: any) => {
      map[weekStart].volume +=
        (set.reps || 0) * (set.weight || 0);
    });
  });

  return Object.entries(map)
    .map(([week, stats]) => ({
      week,
      workouts: stats.workouts,
      volume: stats.volume,
    }))
    .sort((a, b) => (a.week > b.week ? 1 : -1));
}


