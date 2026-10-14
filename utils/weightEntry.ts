import type { WeightUnit } from "./unitConversion";

/*
 * What number to enter as "weight", by equipment (read from the exercise
 * name). One convention keeps PRs, "Last time" and volume comparable:
 *   barbell / EZ bar / trap bar / Smith: everything on the bar, bar included
 *   dumbbell / kettlebell: one of them
 *   cable crossover / fly (two stacks): one side's stack
 *   other cable and machines: the stack or plates loaded
 *   bodyweight moves: only the weight added (0 = bodyweight)
 */

export const WEIGHT_HINTS = {
  bar: "Total: bar + plates",
  dumbbell: "Weight of one dumbbell",
  kettlebell: "Weight of one kettlebell",
  twoCables: "One side's stack",
  cable: "The stack weight",
  machine: "Stack or plates loaded",
  bodyweight: "Added weight only · 0 = bodyweight",
} as const;

type HintKey = keyof typeof WEIGHT_HINTS;

/** Catalog lifts whose names don't say the equipment (their usual setup). */
const BY_NAME: Record<string, HintKey> = {
  "close-grip bench press": "bar",
  "close grip bench press": "bar",
  "military press": "bar",
  "behind neck press": "bar",
  "pendlay row": "bar",
  "t-bar row": "bar",
  "meadows row": "bar",
  deadlift: "bar",
  "rack pull": "bar",
  "good morning": "bar",
  "front squat": "bar",
  "romanian deadlift": "bar",
  "stiff leg deadlift": "bar",
  "sumo deadlift": "bar",
  "hip thrust": "bar",
  "skull crushers": "bar",
  "preacher curl": "bar",
  "drag curl": "bar",
  "reverse curl": "bar",
  "clean and press": "bar",
  "clean and jerk": "bar",
  snatch: "bar",
  thruster: "bar",
  "arnold press": "dumbbell",
  "lateral raise": "dumbbell",
  "front raise": "dumbbell",
  "rear delt fly": "dumbbell",
  "hammer curl": "dumbbell",
  "concentration curl": "dumbbell",
  "cross body curl": "dumbbell",
  "zottman curl": "dumbbell",
  "goblet squat": "dumbbell",
  "bulgarian split squat": "dumbbell",
  "walking lunges": "dumbbell",
  "reverse lunges": "dumbbell",
  "side lunges": "dumbbell",
  "step ups": "dumbbell",
  "farmer's walk": "dumbbell",
  "face pull": "cable",
  "tricep pushdown": "cable",
  "rope pushdown": "cable",
  "reverse grip pushdown": "cable",
  "rope hammer curl": "cable",
  "wood chops": "cable",
  "standing calf raise": "machine",
  "seated calf raise": "machine",
  "donkey calf raise": "machine",
};

const BAR = /\b(barbell|ez[- ]?bar|trap bar|hex bar|smith|landmine)\b/i;
const DUMBBELL = /\b(dumbbells?|db)\b/i;
const KETTLEBELL = /\bkettlebells?\b/i;
const TWO_CABLES = /\b(crossover|cable fly|cable flye)\b/i;
const CABLE = /\bcable\b/i;
const MACHINE = /\b(machine|leg press|hack squat|pulldown|pec deck|leg extension|leg curl|chest press)\b/i;
const BODYWEIGHT =
  /\b(push ?ups?|pull ?ups?|chin ?ups?|dips|inverted row|hyperextension|sit ?ups?|crunch(es)?|leg raise|plank|hollow body|dead bug|v-ups|flutter kicks|toe touches|mountain climbers|ab wheel|wall sit|glute bridge|sissy squat|dead hang)\b/i;

/** Short hint under the weight field, or null when the name doesn't say (cardio, custom names). */
export function weightHintFor(exercise: string): string | null {
  const name = exercise.trim().toLowerCase();
  const key: HintKey | null =
    BY_NAME[name] ??
    (BAR.test(name)
      ? "bar"
      : DUMBBELL.test(name)
        ? "dumbbell"
        : KETTLEBELL.test(name)
          ? "kettlebell"
          : TWO_CABLES.test(name)
            ? "twoCables"
            : CABLE.test(name)
              ? "cable"
              : MACHINE.test(name)
                ? "machine"
                : BODYWEIGHT.test(name)
                  ? "bodyweight"
                  : null);
  return key ? WEIGHT_HINTS[key] : null;
}

/* =========================================================
   Bar + plates helper (barbell-type lifts loaded on both ends)
   ========================================================= */


/** Plates offered per side, heaviest first. */
export const PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5],
};

/** Loaded on one end only (landmine, T-bar, Meadows): "per side × 2" doesn't apply. */
const ONE_END = /\b(landmine|t-bar|meadows)\b/i;

/** True when the bar + plates helper fits: a bar loaded equally on both ends. */
export function usesPlates(exercise: string): boolean {
  return weightHintFor(exercise) === WEIGHT_HINTS.bar && !ONE_END.test(exercise);
}

/** A sensible starting bar weight; the user's own value replaces it once set. */
export function defaultBarWeight(exercise: string, unit: WeightUnit): number {
  const n = exercise.toLowerCase();
  const kg = unit === "kg";
  if (/\bez[- ]?bar\b|preacher curl|skull crushers|drag curl|reverse curl/.test(n)) return kg ? 10 : 25;
  if (/\b(trap|hex) bar\b/.test(n)) return kg ? 25 : 55;
  if (/\bsmith\b/.test(n)) return kg ? 15 : 35;
  return kg ? 20 : 45;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Bar + plates on both sides. */
export const barTotal = (bar: number, perSide: number[]) => round2(bar + 2 * perSide.reduce((a, b) => a + b, 0));

/**
 * The plates per side that make `total` on this bar (fewest plates), or null
 * when the available plates can't make it exactly.
 */
export function platesFor(total: number, bar: number, unit: WeightUnit): number[] | null {
  let side = round2((total - bar) / 2);
  if (side < 0) return null;
  const out: number[] = [];
  for (const p of PLATES[unit]) {
    while (side >= p - 0.001) {
      out.push(p);
      side = round2(side - p);
    }
  }
  return Math.abs(side) < 0.001 ? out : null;
}
