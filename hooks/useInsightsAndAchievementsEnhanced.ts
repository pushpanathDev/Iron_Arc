/**
 * Enhanced Insights & Achievements Hook
 * ====================================
 * Integrated with both expo-notifications and Notifee for reliable notifications
 * Sends notifications even when app is closed using background notification service
 */

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getAllWorkouts, Workout } from "../db/workouts";
import { getAllWeights, BodyWeight } from "../db/weights";
import { useAuth } from "../auth/AuthContext";

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

import {
  scheduleBackgroundNotifications,
  getBackgroundNotificationPreferences,
  setBackgroundNotificationPreferences,
} from "../notifications/backgroundNotificationService";

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
  hasWorkedOutToday: boolean;
  consecutiveWeeks: number;
}

/* =========================
   MAIN HOOK
   ========================= */

export function useInsightsAndAchievements(
  goalWeight?: number,
): InsightsAndAchievements {
  const { user } = useAuth();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [hasWorkedOutToday, setHasWorkedOutToday] = useState(false);
  const [consecutiveWeeks, setConsecutiveWeeks] = useState(0);

  // Initialize notifications on mount
  useEffect(() => {
    initNotifications();
  }, []);

  // Main data loading function
  const loadData = useCallback(async () => {
    if (!user) {
      setInsights([]);
      setAchievements([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch data
      const [workouts, weights] = await Promise.all([
        getAllWorkouts(user.uid),
        getAllWeights(user.uid),
      ]);

      // Calculate stats
      const stats = calculateStats(workouts, weights);
      setStreak(stats.streak);
      setTotalWorkouts(stats.totalWorkouts);
      setTotalVolume(stats.totalVolume);
      setHasWorkedOutToday(stats.hasWorkedOutToday);
      setConsecutiveWeeks(stats.consecutiveWeeks4Plus);

      // Generate insights
      const newInsights = generateInsights(workouts, weights, goalWeight);

      // Add random motivation if insights are few
      if (newInsights.length < 2) {
        newInsights.push(getRandomMotivation());
      }

      setInsights(newInsights);

      // Check achievements
      const achievementResult = await checkAchievements(
        stats.totalWorkouts,
        stats.streak,
        stats.totalVolume,
        stats.workoutsThisWeek,
        stats.consecutiveWeeks4Plus,
        stats.categoriesWorked,
        stats.legWorkouts,
        weights.length,
        goalWeight ? stats.goalReached(goalWeight, weights) : false,
      );

      setAchievements(achievementResult.allAchievements);
      setNewAchievements(achievementResult.newlyUnlocked);

      // Send notifications for new achievements
      for (const achievement of achievementResult.newlyUnlocked) {
        // This uses both expo-notifications AND Notifee
        await sendAchievementNotification(achievement);
      }

      // Send high-priority insight notifications
      const highPriorityInsights = newInsights.filter(
        (i) => i.priority === "high" && i.type !== "streak",
      );
      for (const insight of highPriorityInsights.slice(0, 1)) {
        // This uses expo-notifications (foreground)
        // Background notifications are scheduled separately
        await sendInsightNotification(insight);
      }

      // Handle streak reminders - NOW USES NOTIFEE (works with app closed!)
      if (stats.streak > 2 && !stats.hasWorkedOutToday) {
        // This calls Notifee's scheduleStreakWarning()
        await scheduleStreakReminder(stats.streak);
      } else if (stats.hasWorkedOutToday) {
        await cancelStreakReminder();
      }

      // Update background notification preferences based on user activity
      await updateBackgroundNotificationPreferences(stats);
    } catch (error) {
      console.error("Error loading insights/achievements:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, goalWeight]);

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  return {
    insights,
    achievements,
    newAchievements,
    isLoading,
    streak,
    totalWorkouts,
    totalVolume,
    refresh: loadData,
    hasWorkedOutToday,
    consecutiveWeeks,
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
      .map((w) => w.date),
  ).size;

  // Consecutive weeks with 4+ workouts
  const consecutiveWeeks4Plus = calculateConsecutiveWeeks(workouts);

  // Categories worked
  const categoriesWorked = [
    ...new Set(workouts.map((w) => w.category || "Other")),
  ];

  // Leg workouts
  const legWorkouts = workouts.filter(
    (w) =>
      w.category?.toLowerCase().includes("leg") ||
      w.exercise.toLowerCase().includes("leg"),
  ).length;

  return {
    streak,
    totalWorkouts: workouts.length,
    totalVolume,
    workoutsThisWeek,
    consecutiveWeeks4Plus,
    categoriesWorked,
    legWorkouts,
    hasWorkedOutToday,
    goalReached: (goal: number, weights: BodyWeight[]) => {
      if (weights.length === 0) return false;
      const latestWeight = weights[weights.length - 1]?.weight;
      return latestWeight ? latestWeight <= goal : false; // Assuming goal is a max weight for weight loss
    },
  };
}

/* =========================
   HELPER FUNCTIONS
   ========================= */

function calculateStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0;

  const sortedByDate = [...workouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const uniqueDates = [...new Set(sortedByDate.map((w) => w.date))];

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const dateStr of uniqueDates) {
    const workoutDate = new Date(dateStr);
    workoutDate.setHours(0, 0, 0, 0);

    if (workoutDate.getTime() === currentDate.getTime()) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (workoutDate.getTime() < currentDate.getTime()) {
      break;
    }
  }

  return streak;
}

function calculateConsecutiveWeeks(workouts: Workout[]): number {
  const weeklyCounts = new Map<string, number>();

  workouts.forEach((w) => {
    const weekKey = getWeekKey(new Date(w.date));
    weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) || 0) + 1);
  });

  const sortedWeeks = Array.from(weeklyCounts.entries())
    .filter(([, count]) => count >= 4)
    .sort((a, b) => b[0].localeCompare(a[0]));

  let consecutive = 0;
  const now = new Date();
  let currentWeekKey = getWeekKey(now);

  for (const [weekKey] of sortedWeeks) {
    if (weekKey === currentWeekKey || isAdjacentWeek(weekKey, currentWeekKey)) {
      consecutive++;
      currentWeekKey = getPreviousWeekKey(weekKey);
    } else {
      break;
    }
  }

  return consecutive;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekKey(date: Date): string {
  const start = getWeekStart(date);
  return start.toISOString().split("T")[0];
}

function getPreviousWeekKey(weekKey: string): string {
  const date = new Date(weekKey);
  date.setDate(date.getDate() - 7);
  return date.toISOString().split("T")[0];
}

function isAdjacentWeek(week1: string, week2: string): boolean {
  const week1Date = new Date(week1).getTime();
  const week2Date = new Date(week2).getTime();
  const diff = Math.abs(week1Date - week2Date);
  return diff === 7 * 24 * 60 * 60 * 1000;
}

/* =========================
   BACKGROUND NOTIFICATION SYNC
   ========================= */

/**
 * Update background notification preferences based on user activity
 * This enables/disables notifications intelligently
 */
async function updateBackgroundNotificationPreferences(
  stats: Stats,
): Promise<void> {
  try {
    const prefs = await getBackgroundNotificationPreferences();

    // If user has a strong streak, enable streak warnings
    if (stats.streak >= 3) {
      prefs.streakWarnings = true;
      prefs.streakWarningThreshold = Math.floor(stats.streak * 0.8); // Warn at 80% of streak
    }

    // If user is consistent, enable daily reminders
    if (stats.workoutsThisWeek >= 3) {
      prefs.dailyReminder = true;
    }

    // Update preferences in storage and reschedule
    await setBackgroundNotificationPreferences(prefs);

    // Reschedule all background notifications with updated preferences
    await scheduleBackgroundNotifications(prefs);
  } catch (error) {
    console.error("Error updating background notification preferences:", error);
  }
}
