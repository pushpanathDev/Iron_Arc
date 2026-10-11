import { useCallback, useEffect, useMemo, useState } from "react";

import { useAllWorkouts } from "./useWorkouts";
import { useAllWeights } from "./useWeights";
import { useAchievements } from "./useAchievements";

import {
  calculateAnalyticsStats,
  generateInsights,
  Insight,
  getRandomMotivation,
} from "../insights/insightEngine";

import type { Achievement } from "../services/api";


/* =========================
   HOOK RETURN TYPE
   ========================= */

export interface InsightsAndAchievements {
  insights: Insight[];
  achievements: Achievement[];
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
  // Badges, rules and progress come entirely from the server.
  const { data: achievements = [], isLoading: loadingAchievements } = useAchievements();

  const [insights, setInsights] = useState<Insight[]>([]);
  const stats = useMemo(
    () => calculateAnalyticsStats(workouts, weights, "all"),
    [workouts, weights],
  );

  const isLoading = loadingWorkouts || loadingWeights || loadingAchievements;

  // Recompute insights from workout data. Achievement state comes only from the server.
  useEffect(() => {
    if (isLoading) return;

    const newInsights = generateInsights(workouts, weights, goalWeight);
    if (newInsights.length < 2) newInsights.push(getRandomMotivation());
    setInsights(newInsights);
  }, [workouts, weights, goalWeight, isLoading]);

  const refresh = useCallback(async () => {
    await Promise.all([refetchWorkouts(), refetchWeights()]);
  }, [refetchWorkouts, refetchWeights]);

  return {
    insights,
    achievements,
    isLoading,
    streak: stats.streak,
    totalWorkouts: stats.totalWorkouts,
    totalVolume: stats.totalVolume,
    refresh,
  };
}
