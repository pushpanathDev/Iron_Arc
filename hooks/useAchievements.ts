import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
import { TIER_LABELS } from "../insights/achievements";
import { Achievement, achievementApi } from "../services/api";

export const ACHIEVEMENTS_KEY = ["achievements"] as const;

export function useAchievements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ACHIEVEMENTS_KEY,
    queryFn: () => achievementApi.list(),
    enabled: !!user,
    // The query cache is persisted; ignore any entries in an older shape.
    select: (data) =>
      Array.isArray(data)
        ? data.filter((a) => typeof a?.key === "string" && a.tier in TIER_LABELS)
        : [],
  });
}

/**
 * Call after any save that can unlock badges (workout, weight, plan).
 * Always refreshes ["achievements"] so progress stays current; when the
 * server reports newly unlocked keys, also shows one celebration toast with
 * each badge's title and tier (looked up from the refreshed catalog).
 */
export function useAchievementUnlockHandler() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useCallback(
    async (newlyUnlocked: string[] = []) => {
      if (newlyUnlocked.length === 0) {
        queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
        return;
      }

      let badges: Achievement[] = [];
      try {
        badges = await queryClient.fetchQuery({
          queryKey: ACHIEVEMENTS_KEY,
          queryFn: () => achievementApi.list(),
          staleTime: 0, // force a fresh read now that something unlocked
        });
      } catch {
        // Still celebrate; fall back to the raw keys below.
        queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
      }

      const labels = newlyUnlocked.map((key) => {
        const badge = badges.find((b) => b.key === key);
        return badge ? `${badge.title} (${TIER_LABELS[badge.tier]})` : key;
      });

      showToast({
        message: `🏆 ${labels.length > 1 ? "Badges" : "Badge"} unlocked: ${labels.join(", ")}`,
        type: "success",
        duration: 5000,
      });
    },
    [queryClient, showToast],
  );
}
