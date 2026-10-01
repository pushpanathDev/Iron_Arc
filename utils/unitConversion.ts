export type WeightUnit = "kg" | "lbs";

const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 1 / KG_TO_LBS;

export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10;
}

/**
 * Convert a weight value for display in the user's preferred unit.
 * All data is stored in kg on the server; this converts for display only.
 */
export function displayWeight(kg: number, unit: WeightUnit): number {
  return unit === "lbs" ? kgToLbs(kg) : kg;
}

/**
 * Convert a user-entered value from their preferred unit back to kg for storage.
 */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === "lbs" ? lbsToKg(value) : value;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  const val = displayWeight(kg, unit);
  return `${val}${unit}`;
}

export function weightLabel(unit: WeightUnit): string {
  return unit === "lbs" ? "lbs" : "kg";
}

/**
 * Increment step for weight buttons based on unit.
 * kg: 2.5 (standard plate increment)
 * lbs: 5 (standard plate increment)
 */
export function weightStep(unit: WeightUnit): number {
  return unit === "lbs" ? 5 : 2.5;
}
