import { formatValue, towardGoal } from "../../utils/bodyWeightRules";

type Goal = string | null | undefined;

/**
 * Colour for a weight change from `fromKg` to `toKg`. The sign and arrow always
 * show the real change; colour says good or bad: green toward the target
 * weight, red away from it. Without a target: green for a gain and red for a
 * loss, flipped when the fitness goal is weight loss. Shared by the Weight
 * screen and Home so a change reads the same everywhere.
 */
export function deltaColor(
  fromKg: number,
  toKg: number,
  goalKg: number | null,
  fitnessGoal: Goal,
  colors: { trendGood: string; trendBad: string; textSecondary: string },
) {
  const toward = towardGoal(fromKg, toKg, goalKg);
  if (toward != null) return toward ? colors.trendGood : colors.trendBad;
  const d = toKg - fromKg;
  if (d === 0) return colors.textSecondary;
  const gainIsGood = fitnessGoal !== "weight-loss";
  return d > 0 === gainIsGood ? colors.trendGood : colors.trendBad;
}

/** "+0.5", "−1.2", "±0". */
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${formatValue(Math.abs(n))}`;
