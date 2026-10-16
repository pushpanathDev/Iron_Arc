/**
 * Achievement display metadata only.
 *
 * Badges, their rules and progress all come from the server
 * (GET /api/achievements). This file just maps badge keys, tiers and
 * categories to icons, colours and labels. It never decides whether a
 * badge is earned.
 */

import type { AchievementTier } from "../services/api";
import type { ColorTokens } from "../theme/tokens";
import { displayWeight, weightLabel, type WeightUnit } from "./unitConversion";
import type { MaterialIconName } from "../components/ui/iconName";

const BADGE_ICONS: Record<string, MaterialIconName> = {
  streak_3: "local-fire-department",
  streak_7: "military-tech",
  streak_14: "whatshot",
  streak_30: "workspace-premium",
  streak_60: "bolt",
  streak_100: "emoji-events",
  weekly_4x_once: "calendar-month",
  weekly_4x_4: "event-repeat",

  workout_1: "fitness-center",
  workout_10: "repeat",
  workout_50: "stars",
  workout_100: "emoji-events",

  volume_1k: "line-weight",
  volume_10k: "fitness-center",
  volume_50k: "terrain",

  pr_1: "trending-up",
  pr_10: "upgrade",

  muscle_groups_6: "accessibility-new",
  exercises_10: "checklist",
  custom_exercise_1: "edit-note",

  weight_first: "monitor-weight",
  weight_entries_10: "scale",
  weight_entries_30: "insights",

  ai_plan_1: "auto-awesome",
  ai_plan_3: "psychology",

  weekend_warrior: "wb-sunny",
  double_session: "content-copy",
  comeback_kid: "replay",
};

export function badgeIcon(key: string): MaterialIconName {
  return BADGE_ICONS[key] ?? "military-tech";
}

/** Tier colour from the theme (gold = amber, the records colour). */
export function tierColor(colors: ColorTokens, tier: AchievementTier): string {
  return tier === "gold" ? colors.amber : tier === "silver" ? colors.tierSilver : colors.tierBronze;
}

export const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

/** Display order and labels for the server's badge categories. */
export const CATEGORY_ORDER: { key: string; label: string; icon: MaterialIconName }[] = [
  { key: "consistency", label: "Consistency", icon: "local-fire-department" },
  { key: "workouts", label: "Workouts", icon: "fitness-center" },
  { key: "volume", label: "Volume", icon: "line-weight" },
  { key: "records", label: "Records", icon: "trending-up" },
  { key: "variety", label: "Variety", icon: "accessibility-new" },
  { key: "body_weight", label: "Body weight", icon: "monitor-weight" },
  { key: "ai_plans", label: "AI plans", icon: "auto-awesome" },
  { key: "fun", label: "Fun", icon: "celebration" },
];

export function categoryLabel(key: string): string {
  return CATEGORY_ORDER.find((c) => c.key === key)?.label ?? key;
}
export function categoryIcon(key: string): MaterialIconName {
  return CATEGORY_ORDER.find((c) => c.key === key)?.icon ?? "military-tech";
}

const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 100) / 10}k` : Math.round(n).toLocaleString());

/**
 * "1 / 4 weeks", "2.2k / 10k kg", "12 / 50". Volume badges count kilograms
 * (shown in the user's unit); weekly-streak badges count weeks.
 */
export function progressLabel(badge: { key: string; category: string; progress: number; targetValue: number }, unit: WeightUnit): string {
  const p = Math.max(0, Math.floor(badge.progress));
  const t = badge.targetValue;
  if (badge.category === "volume") return `${compact(displayWeight(p, unit))} / ${compact(displayWeight(t, unit))} ${weightLabel(unit)}`;
  if (badge.key.startsWith("streak_")) return `${p} / ${t} ${t === 1 ? "week" : "weeks"}`;
  return `${p} / ${t}`;
}

/** "10 Oct" (this year) or "10 Oct 2025". */
export function unlockDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
}
