import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";

import { useAllWorkouts } from "./useWorkouts";
import { useAllWeights } from "./useWeights";
import { useAchievements, useSyncAchievements } from "./useAchievements";
import { Workout, BodyWeight, ApiAchievement } from "../services/api";

import {
  generateInsights,
  Insight,
  getRandomMotivation,
} from "../insights/insightEngine";

import {
  checkAchievements,
  Achievement,
  AchievementCheckResult,
} from "../insights/achievements";

import {
  initNotifications,
  sendAchievementNotification,
  sendInsightNotification,
  scheduleStreakReminder,
  cancelStreakReminder,
} from "../notifications/notificationService";

/* =========================
   HOOK RETURN TYPE
   ========================= */

export interface InsightsAndAchievements {
  insights: Insight[];
  achievements: Achievement[];
  newAchievements: Achievement[];
  isLoading: boolean;
  streak: number;
  totalWorkouts: number;
  totalVolume: number;
  refresh: () => Promise<void>;
}

/* =========================
   MAIN HOOK
   ========================= */

export function useInsightsAndAchievements(
  goalWeight?: number
): InsightsAndAchievements {
  const { data: workouts = [], isLoading: loadingWorkouts, refetch: refetchWorkouts } = useAllWorkouts();
  const { data: weights = [], isLoading: loadingWeights, refetch: refetchWeights } = useAllWeights();
  const { data: serverAchievements = [] } = useAchievements();
  const syncAchievements = useSyncAchievements();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);

  const isLoading = loadingWorkouts || loadingWeights;

  // Initialize notifications on mount
  useEffect(() => {
    initNotifications();
  }, []);

  // Recompute insights and achievements whenever data changes
  useEffect(() => {
    if (isLoading) return;

    const stats = calculateStats(workouts, weights);
    setStreak(stats.streak);
    setTotalWorkouts(stats.totalWorkouts);
    setTotalVolume(stats.totalVolume);

    const newInsights = generateInsights(workouts, weights, goalWeight);
    if (newInsights.length < 2) newInsights.push(getRandomMotivation());
    setInsights(newInsights);

    checkAchievements(
      stats.totalWorkouts,
      stats.streak,
      stats.totalVolume,
      stats.workoutsThisWeek,
      stats.consecutiveWeeks4Plus,
      stats.categoriesWorked,
      stats.legWorkouts,
      weights.length,
      goalWeight ? stats.goalReached(goalWeight, weights) : false
    ).then(async (achievementResult: AchievementCheckResult) => {
      setAchievements(achievementResult.allAchievements);

      // Determine which achievements are newly unlocked vs. already on server
      const serverKeys = new Set(serverAchievements.map((a: any) => a.badgeKey));
      const newlyUnlocked = achievementResult.newlyUnlocked.filter(
        (a: Achievement) => !serverKeys.has(a.id)
      );
      setNewAchievements(newlyUnlocked);

      // Sync newly unlocked achievements to backend
      const allUnlockedKeys = achievementResult.allAchievements.map((a: Achievement) => a.id);
      if (allUnlockedKeys.length > 0) {
        syncAchievements.mutate(allUnlockedKeys);
      }

      // Notifications for truly new ones
      for (const achievement of newlyUnlocked) {
        await sendAchievementNotification(achievement);
      }

      // High-priority insights
      const highPriorityInsights = newInsights.filter(
        (i: Insight) => i.priority === "high" && i.type !== "streak"
      );
      for (const insight of highPriorityInsights.slice(0, 1)) {
        await sendInsightNotification(insight);
      }

      if (stats.streak > 2 && !stats.hasWorkedOutToday) {
        await scheduleStreakReminder(stats.streak);
      } else if (stats.hasWorkedOutToday) {
        await cancelStreakReminder();
      }
    }).catch((error: unknown) => {
      console.error("Error computing achievements:", error);
    });
  }, [workouts, weights, goalWeight, isLoading, serverAchievements]);

  const refresh = useCallback(async () => {
    await Promise.all([refetchWorkouts(), refetchWeights()]);
  }, [refetchWorkouts, refetchWeights]);

  return {
    insights,
    achievements,
    newAchievements,
    isLoading,
    streak,
    totalWorkouts,
    totalVolume,
    refresh,
  };
}

/* =========================
   STATS CALCULATOR
   ========================= */

interface Stats {
  streak: number;
  totalWorkouts: number;
  totalVolume: number;
  workoutsThisWeek: number;
  consecutiveWeeks4Plus: number;
  categoriesWorked: string[];
  legWorkouts: number;
  hasWorkedOutToday: boolean;
  goalReached: (goal: number, weights: BodyWeight[]) => boolean;
}

function calculateStats(workouts: Workout[], weights: BodyWeight[]): Stats {
  const today = new Date().toISOString().split("T")[0];
  const hasWorkedOutToday = workouts.some((w) => w.date === today);

  // Streak
  const streak = calculateStreak(workouts);

  // Total volume
  const totalVolume = workouts.reduce((sum, w) => {
    return sum + w.sets.reduce((s, set) => s + set.weight * set.reps, 0);
  }, 0);

  // Workouts this week
  const weekStart = getWeekStart(new Date());
  const workoutsThisWeek = new Set(
    workouts
      .filter((w) => new Date(w.date) >= weekStart)
      .map((w) => w.date)
  ).size;

  // Consecutive weeks with 4+ workouts
  const consecutiveWeeks4Plus = calculateConsecutiveWeeks(workouts);

  // Categories worked
  const categoriesWorked = [...new Set(workouts.map((w) => w.category || "Other"))];

  // Leg workouts
  const legWorkouts = workouts.filter(
    (w) => w.category?.toLowerCase() === "legs"
  ).length;

  // Goal reached checker
  const goalReached = (goal: number, wts: BodyWeight[]): boolean => {
    if (wts.length === 0) return false;
    const sorted = [...wts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latest = sorted[0].weight;
    const first = sorted[sorted.length - 1].weight;
    const isLosingGoal = goal < first;
    return isLosingGoal ? latest <= goal : latest >= goal;
  };

  return {
    streak,
    totalWorkouts: workouts.length,
    totalVolume,
    workoutsThisWeek,
    consecutiveWeeks4Plus,
    categoriesWorked,
    legWorkouts,
    hasWorkedOutToday,
    goalReached,
  };
}

function calculateStreak(workouts: Workout[]): number {
  const uniqueDates = [...new Set(workouts.map((w) => w.date))].sort().reverse();

  if (uniqueDates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 0;
  let checkDate = new Date(uniqueDates[0]);

  for (const dateStr of uniqueDates) {
    const expectedStr = checkDate.toISOString().split("T")[0];

    if (dateStr === expectedStr) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calculateConsecutiveWeeks(workouts: Workout[]): number {
  const weekWorkouts = new Map<string, Set<string>>();

  for (const workout of workouts) {
    const weekStart = getWeekStart(new Date(workout.date));
    const weekKey = weekStart.toISOString().split("T")[0];

    if (!weekWorkouts.has(weekKey)) {
      weekWorkouts.set(weekKey, new Set());
    }
    weekWorkouts.get(weekKey)!.add(workout.date);
  }

  // Count consecutive weeks with 4+ unique workout days
  let consecutive = 0;
  let currentWeek = getWeekStart(new Date());

  while (true) {
    const weekKey = currentWeek.toISOString().split("T")[0];
    const days = weekWorkouts.get(weekKey);

    if (days && days.size >= 4) {
      consecutive++;
      currentWeek.setDate(currentWeek.getDate() - 7);
    } else {
      break;
    }
  }

  return consecutive;
}
