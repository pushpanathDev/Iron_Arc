import type { MaterialIconName } from "../components/ui/iconName";

export type FitnessGoal = "strength" | "muscle" | "endurance" | "weight-loss" | "general";

/** Fitness goals (onboarding cards; Profile → Fitness goal; AI plan settings). */
export const GOALS: { id: FitnessGoal; title: string; description: string; icon: MaterialIconName }[] = [
  { id: "strength", title: "Build strength", description: "Heavy loads, low reps", icon: "fitness-center" },
  { id: "muscle", title: "Build muscle", description: "Hypertrophy volume, 8–12 reps", icon: "sports-gymnastics" },
  { id: "weight-loss", title: "Lose weight", description: "Conditioning and calorie burn", icon: "local-fire-department" },
  { id: "general", title: "Stay fit", description: "Balanced health and mobility", icon: "favorite" },
  { id: "endurance", title: "Build endurance", description: "Stamina and work capacity", icon: "directions-run" },
];
