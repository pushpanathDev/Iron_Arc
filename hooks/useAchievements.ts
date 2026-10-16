import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useAuth } from "../providers/AuthContext";
import { useToast } from "../providers/ToastContext";
import { TIER_LABELS } from "../utils/achievementDisplay";
import { Achievement, achievementApi } from "../services/api";
import { enqueueUnlocks } from "./badgeUnlocks";

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
 * server reports newly unlocked keys, celebrates each one in the unlock sheet
 * (BadgeUnlockHost), one after another. Falls back to a toast if the badge
 * details can't be loaded.
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

      const found = newlyUnlocked.map((key) => badges.find((b) => b.key === key)).filter((b): b is Achievement => !!b);
      if (found.length === newlyUnlocked.length) {
        enqueueUnlocks(found);
        return;
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
