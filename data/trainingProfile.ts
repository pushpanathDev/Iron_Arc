/*
 * The training profile asked once at onboarding (and editable in Profile).
 * One vocabulary for onboarding, Profile, the plan sheet and the backend
 * (src/middleware/validation.js accepts exactly these values).
 */

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type Equipment = "full_gym" | "dumbbells" | "bodyweight";
export type SessionMinutes = 30 | 45 | 60 | 90;
export type AvoidArea = "knees" | "lower_back" | "shoulders" | "wrists";
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "Under 1 year" },
  { value: "intermediate", label: "Intermediate", hint: "1–3 years" },
  { value: "advanced", label: "Advanced", hint: "3+ years" },
];

export const EQUIPMENT_OPTIONS: { value: Equipment; label: string; hint: string }[] = [
  { value: "full_gym", label: "Full gym", hint: "Barbells, cables, machines" },
  { value: "dumbbells", label: "Dumbbells", hint: "Dumbbells and a bench" },
  { value: "bodyweight", label: "Bodyweight", hint: "No equipment" },
];

export const SESSION_OPTIONS: { value: SessionMinutes; label: string; hint: string }[] = [
  { value: 30, label: "30 min", hint: "Up to 4 exercises" },
  { value: 45, label: "45 min", hint: "Up to 5 exercises" },
  { value: 60, label: "60 min", hint: "Up to 7 exercises" },
  { value: 90, label: "90 min", hint: "Up to 9 exercises" },
];

export const AVOID_OPTIONS: { value: AvoidArea; label: string }[] = [
  { value: "knees", label: "Knees" },
  { value: "lower_back", label: "Lower back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "wrists", label: "Wrists" },
];

export const WEEKDAYS: { value: Weekday; short: string; long: string }[] = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 7, short: "Sun", long: "Sunday" },
];

/** At least one rest day a week. */
export const MAX_TRAINING_DAYS = 6;
export const DEFAULT_TRAINING_DAYS: Weekday[] = [1, 2, 4, 5];
export const DEFAULT_SESSION_MINUTES: SessionMinutes = 60;

/** Split the plan uses when the user doesn't choose one (same rule as the backend). */
export function defaultSplitFor(days: number): "full_body" | "upper_lower" | "push_pull_legs" {
  if (days <= 3) return "full_body";
  if (days === 4) return "upper_lower";
  return "push_pull_legs";
}

export const SPLIT_LABELS: Record<string, string> = {
  full_body: "Full body",
  upper_lower: "Upper / Lower",
  push_pull_legs: "Push / Pull / Legs",
  body_part: "Body part split",
};

/** JS Date.getDay() (0 = Sunday) → ISO weekday (7 = Sunday). */
export const isoWeekday = (date: Date): Weekday => ((date.getDay() + 6) % 7) + 1 as Weekday;

/**
 * Training days per week the app should aim for: the chosen weekdays when
 * set, else the stored count, never more than 6 (a saved 7 from before the
 * cap counts as 6 so the week card and streak can be met).
 */
export function effectiveWeeklyGoal(profile: { trainingDays?: number[] | null; weeklyGoal?: number | null } | null | undefined): number | null {
  const days = profile?.trainingDays?.length ?? 0;
  if (days > 0) return Math.min(days, MAX_TRAINING_DAYS);
  const goal = profile?.weeklyGoal ?? 0;
  return goal > 0 ? Math.min(goal, MAX_TRAINING_DAYS) : null;
}

/** "Mon, Wed, Fri" */
export const formatDays = (days: number[]) =>
  [...days].sort((a, b) => a - b).map((d) => WEEKDAYS[d - 1]?.short).filter(Boolean).join(", ");
