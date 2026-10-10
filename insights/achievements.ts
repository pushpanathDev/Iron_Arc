/**
 * Achievement display metadata only.
 *
 * Badges, their rules and progress all come from the server
 * (GET /api/achievements). This file just maps badge keys, tiers and
 * categories to icons, colours and labels. It never decides whether a
 * badge is earned.
 */
import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import type { AchievementTier } from "../services/api";

export type BadgeIconName = ComponentProps<typeof Ionicons>["name"];

const BADGE_ICONS: Record<string, BadgeIconName> = {
  streak_3: "flame-outline",
  streak_7: "flame",
  streak_14: "flame",
  streak_30: "bonfire-outline",
  streak_60: "bonfire",
  streak_100: "bonfire",
  weekly_4x_once: "calendar-outline",
  weekly_4x_4: "calendar",

  workout_1: "footsteps",
  workout_10: "fitness",
  workout_50: "medal",
  workout_100: "trophy",

  volume_1k: "barbell-outline",
  volume_10k: "barbell",
  volume_50k: "barbell",

  pr_1: "trending-up",
  pr_10: "rocket",

  muscle_groups_6: "body",
  exercises_10: "list",
  custom_exercise_1: "create",

  weight_first: "scale-outline",
  weight_entries_10: "scale",
  weight_entries_30: "analytics",

  ai_plan_1: "sparkles-outline",
  ai_plan_3: "sparkles",

  weekend_warrior: "sunny",
  double_session: "copy",
  comeback_kid: "refresh-circle",
};

export function badgeIcon(key: string): BadgeIconName {
  return BADGE_ICONS[key] ?? "ribbon";
}

/** Badge colour per tier (fixed metal colours, readable in light and dark). */
export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: "#CD7F32",
  silver: "#9CA3AF",
  gold: "#D4A017",
};

export const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

/** Display order and labels for the server's badge categories. */
export const CATEGORY_ORDER: { key: string; label: string }[] = [
  { key: "consistency", label: "Consistency" },
  { key: "workouts", label: "Workouts" },
  { key: "volume", label: "Volume" },
  { key: "records", label: "Personal Records" },
  { key: "variety", label: "Variety" },
  { key: "body_weight", label: "Body Weight" },
  { key: "ai_plans", label: "AI Plans" },
  { key: "fun", label: "Fun" },
];

export function categoryLabel(key: string): string {
  return CATEGORY_ORDER.find((c) => c.key === key)?.label ?? key;
}

/** Volume badges count kilograms; everything else is a plain count. */
export function formatProgressValue(category: string, value: number): string {
  const rounded = Math.floor(value);
  return category === "volume" ? `${rounded.toLocaleString()} kg` : String(rounded);
}
