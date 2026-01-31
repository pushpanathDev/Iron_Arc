import { sqliteDb } from "../db/sqlite";

/* =========================
   ACHIEVEMENT TYPES
   ========================= */

export type AchievementId =
  // Workout milestones
  | "first_workout"
  | "workout_10"
  | "workout_50"
  | "workout_100"
  | "workout_500"
  // Streak achievements
  | "streak_3"
  | "streak_7"
  | "streak_14"
  | "streak_21"
  | "streak_30"
  | "streak_60"
  | "streak_100"
  | "streak_365"
  // Volume achievements
  | "volume_1k"
  | "volume_10k"
  | "volume_50k"
  | "volume_100k"
  | "volume_500k"
  | "volume_1m"
  // Consistency achievements
  | "consistency_4x_week"
  | "consistency_month"
  | "early_bird"
  | "night_owl"
  // Category achievements
  | "all_rounder"
  | "leg_day_warrior"
  // Weight achievements
  | "weight_goal_reached"
  | "weight_logged_30";

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  unlockedAt?: number;
  progress?: number; // 0-100
  requirement: number;
  current?: number;
}

/* =========================
   ACHIEVEMENT DEFINITIONS
   ========================= */

export const ACHIEVEMENTS: Record<AchievementId, Omit<Achievement, "unlockedAt" | "progress" | "current">> = {
  // Workout milestones
  first_workout: {
    id: "first_workout",
    title: "First Step",
    description: "Log your first workout",
    icon: "footsteps",
    tier: "bronze",
    requirement: 1,
  },
  workout_10: {
    id: "workout_10",
    title: "Getting Started",
    description: "Complete 10 workouts",
    icon: "fitness",
    tier: "bronze",
    requirement: 10,
  },
  workout_50: {
    id: "workout_50",
    title: "Committed",
    description: "Complete 50 workouts",
    icon: "medal",
    tier: "silver",
    requirement: 50,
  },
  workout_100: {
    id: "workout_100",
    title: "Century Lifter",
    description: "Complete 100 workouts",
    icon: "ribbon",
    tier: "gold",
    requirement: 100,
  },
  workout_500: {
    id: "workout_500",
    title: "Iron Veteran",
    description: "Complete 500 workouts",
    icon: "trophy",
    tier: "platinum",
    requirement: 500,
  },

  // Streak achievements
  streak_3: {
    id: "streak_3",
    title: "Momentum",
    description: "3 day workout streak",
    icon: "flame",
    tier: "bronze",
    requirement: 3,
  },
  streak_7: {
    id: "streak_7",
    title: "Week Warrior",
    description: "7 day workout streak",
    icon: "flame",
    tier: "silver",
    requirement: 7,
  },
  streak_14: {
    id: "streak_14",
    title: "Fortnight Fighter",
    description: "14 day workout streak",
    icon: "flame",
    tier: "silver",
    requirement: 14,
  },
  streak_21: {
    id: "streak_21",
    title: "Habit Builder",
    description: "21 day workout streak",
    icon: "flame",
    tier: "gold",
    requirement: 21,
  },
  streak_30: {
    id: "streak_30",
    title: "Month Master",
    description: "30 day workout streak",
    icon: "flame",
    tier: "gold",
    requirement: 30,
  },
  streak_60: {
    id: "streak_60",
    title: "Discipline King",
    description: "60 day workout streak",
    icon: "flame",
    tier: "platinum",
    requirement: 60,
  },
  streak_100: {
    id: "streak_100",
    title: "Century Streak",
    description: "100 day workout streak",
    icon: "flame",
    tier: "platinum",
    requirement: 100,
  },
  streak_365: {
    id: "streak_365",
    title: "LEGENDARY",
    description: "365 day workout streak",
    icon: "star",
    tier: "diamond",
    requirement: 365,
  },

  // Volume achievements
  volume_1k: {
    id: "volume_1k",
    title: "1 Tonne Club",
    description: "Lift 1,000kg total volume",
    icon: "barbell",
    tier: "bronze",
    requirement: 1000,
  },
  volume_10k: {
    id: "volume_10k",
    title: "10 Tonne Titan",
    description: "Lift 10,000kg total volume",
    icon: "barbell",
    tier: "silver",
    requirement: 10000,
  },
  volume_50k: {
    id: "volume_50k",
    title: "50 Tonne Beast",
    description: "Lift 50,000kg total volume",
    icon: "barbell",
    tier: "gold",
    requirement: 50000,
  },
  volume_100k: {
    id: "volume_100k",
    title: "100 Tonne Legend",
    description: "Lift 100,000kg total volume",
    icon: "barbell",
    tier: "platinum",
    requirement: 100000,
  },
  volume_500k: {
    id: "volume_500k",
    title: "Half Millionaire",
    description: "Lift 500,000kg total volume",
    icon: "barbell",
    tier: "platinum",
    requirement: 500000,
  },
  volume_1m: {
    id: "volume_1m",
    title: "MILLIONAIRE",
    description: "Lift 1,000,000kg total volume",
    icon: "diamond",
    tier: "diamond",
    requirement: 1000000,
  },

  // Consistency achievements
  consistency_4x_week: {
    id: "consistency_4x_week",
    title: "Consistent",
    description: "4+ workouts in a week",
    icon: "calendar",
    tier: "bronze",
    requirement: 4,
  },
  consistency_month: {
    id: "consistency_month",
    title: "Consistency King",
    description: "4+ workouts/week for 4 weeks",
    icon: "ribbon",
    tier: "gold",
    requirement: 4,
  },
  early_bird: {
    id: "early_bird",
    title: "Early Bird",
    description: "Log a workout before 7 AM",
    icon: "sunny",
    tier: "bronze",
    requirement: 1,
  },
  night_owl: {
    id: "night_owl",
    title: "Night Owl",
    description: "Log a workout after 10 PM",
    icon: "moon",
    tier: "bronze",
    requirement: 1,
  },

  // Category achievements
  all_rounder: {
    id: "all_rounder",
    title: "All-Rounder",
    description: "Train all major muscle groups",
    icon: "body",
    tier: "silver",
    requirement: 6,
  },
  leg_day_warrior: {
    id: "leg_day_warrior",
    title: "Leg Day Warrior",
    description: "Never skip leg day (10 leg workouts)",
    icon: "walk",
    tier: "silver",
    requirement: 10,
  },

  // Weight achievements
  weight_goal_reached: {
    id: "weight_goal_reached",
    title: "Goal Crusher",
    description: "Reach your weight goal",
    icon: "flag",
    tier: "gold",
    requirement: 1,
  },
  weight_logged_30: {
    id: "weight_logged_30",
    title: "Weight Watcher",
    description: "Log weight for 30 days",
    icon: "scale",
    tier: "silver",
    requirement: 30,
  },
};

/* =========================
   DATABASE OPERATIONS
   ========================= */

export async function initAchievementsTable() {
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      unlockedAt INTEGER
    )
  `);
}

export async function getUnlockedAchievements(): Promise<Map<AchievementId, number>> {
  const rows = await sqliteDb.getAllAsync<{ id: string; unlockedAt: number }>(
    `SELECT * FROM achievements`
  );
  return new Map(rows.map((r) => [r.id as AchievementId, r.unlockedAt]));
}

export async function unlockAchievement(id: AchievementId): Promise<boolean> {
  const existing = await sqliteDb.getFirstAsync<{ id: string }>(
    `SELECT id FROM achievements WHERE id = ?`,
    [id]
  );

  if (existing) return false; // Already unlocked

  await sqliteDb.runAsync(
    `INSERT INTO achievements (id, unlockedAt) VALUES (?, ?)`,
    [id, Date.now()]
  );

  return true; // Newly unlocked
}

/* =========================
   ACHIEVEMENT CHECKER
   ========================= */

export interface AchievementCheckResult {
  newlyUnlocked: Achievement[];
  allAchievements: Achievement[];
}

export async function checkAchievements(
  totalWorkouts: number,
  currentStreak: number,
  totalVolume: number,
  workoutsThisWeek: number,
  consecutiveWeeks4Plus: number,
  categoriesWorked: string[],
  legWorkouts: number,
  weightLogsCount: number,
  goalReached: boolean
): Promise<AchievementCheckResult> {
  await initAchievementsTable();
  
  const unlockedMap = await getUnlockedAchievements();
  const newlyUnlocked: Achievement[] = [];
  const allAchievements: Achievement[] = [];

  // Helper to check and unlock
  const check = async (
    id: AchievementId,
    current: number,
    requirement: number
  ) => {
    const def = ACHIEVEMENTS[id];
    const isUnlocked = unlockedMap.has(id);
    const progress = Math.min(100, Math.round((current / requirement) * 100));

    if (!isUnlocked && current >= requirement) {
      const justUnlocked = await unlockAchievement(id);
      if (justUnlocked) {
        newlyUnlocked.push({
          ...def,
          unlockedAt: Date.now(),
          progress: 100,
          current,
        });
      }
    }

    allAchievements.push({
      ...def,
      unlockedAt: unlockedMap.get(id),
      progress,
      current,
    });
  };

  // Workout milestones
  await check("first_workout", totalWorkouts, 1);
  await check("workout_10", totalWorkouts, 10);
  await check("workout_50", totalWorkouts, 50);
  await check("workout_100", totalWorkouts, 100);
  await check("workout_500", totalWorkouts, 500);

  // Streak achievements
  await check("streak_3", currentStreak, 3);
  await check("streak_7", currentStreak, 7);
  await check("streak_14", currentStreak, 14);
  await check("streak_21", currentStreak, 21);
  await check("streak_30", currentStreak, 30);
  await check("streak_60", currentStreak, 60);
  await check("streak_100", currentStreak, 100);
  await check("streak_365", currentStreak, 365);

  // Volume achievements
  await check("volume_1k", totalVolume, 1000);
  await check("volume_10k", totalVolume, 10000);
  await check("volume_50k", totalVolume, 50000);
  await check("volume_100k", totalVolume, 100000);
  await check("volume_500k", totalVolume, 500000);
  await check("volume_1m", totalVolume, 1000000);

  // Consistency
  await check("consistency_4x_week", workoutsThisWeek, 4);
  await check("consistency_month", consecutiveWeeks4Plus, 4);

  // Categories
  await check("all_rounder", categoriesWorked.length, 6);
  await check("leg_day_warrior", legWorkouts, 10);

  // Weight
  await check("weight_logged_30", weightLogsCount, 30);
  await check("weight_goal_reached", goalReached ? 1 : 0, 1);

  return { newlyUnlocked, allAchievements };
}

/* =========================
   TIER COLORS
   ========================= */

export const TIER_COLORS = {
  bronze: { bg: "#CD7F32", text: "#FFFFFF" },
  silver: { bg: "#C0C0C0", text: "#1A1A1A" },
  gold: { bg: "#FFD700", text: "#1A1A1A" },
  platinum: { bg: "#E5E4E2", text: "#1A1A1A" },
  diamond: { bg: "#B9F2FF", text: "#1A1A1A" },
};
