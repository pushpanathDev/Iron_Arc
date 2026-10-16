import type { User } from "../services/api";

/**
 * What onboarding must collect before the app opens: name, age, height, goal,
 * experience, equipment and at least one training day. Fields an older server
 * leaves out (undefined) don't count as missing, so it can't loop onboarding.
 */
export function missingProfileFields(profile: User | null | undefined): string[] {
  if (!profile) return ["profile"];
  const missing: string[] = [];
  if (!profile.displayName?.trim()) missing.push("name");
  if (profile.age == null) missing.push("age");
  if (profile.height == null) missing.push("height");
  if (!profile.fitnessGoal) missing.push("goal");
  if (profile.experienceLevel === null) missing.push("experience");
  if (profile.equipment === null) missing.push("equipment");
  if (profile.trainingDays !== undefined && profile.trainingDays.length === 0) missing.push("days");
  return missing;
}

export const isProfileComplete = (profile: User | null | undefined) => missingProfileFields(profile).length === 0;
