/*
 * Height: stored in whole centimetres; ft-in is shown and picked in whole inches.
 */

export const CM_MIN = 100;
export const CM_MAX = 250;
const CM_PER_INCH = 2.54;
/** The inch range that stays inside the cm range (40 in = 101.6 cm … 98 in = 248.9 cm). */
export const IN_MIN = Math.ceil(CM_MIN / CM_PER_INCH);
export const IN_MAX = Math.floor(CM_MAX / CM_PER_INCH);

export type HeightUnit = "cm" | "ft";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Whole inches for a height in cm, kept within the ft-in range. */
export const cmToInches = (cm: number) => clamp(Math.round(cm / CM_PER_INCH), IN_MIN, IN_MAX);

/** Whole centimetres for a height in inches, kept within the cm range. */
export const inchesToCm = (inches: number) => clamp(Math.round(inches * CM_PER_INCH), CM_MIN, CM_MAX);

/** A stored height as the value the picker shows in `unit`. */
export const heightInUnit = (cm: number, unit: HeightUnit) => (unit === "cm" ? clamp(Math.round(cm), CM_MIN, CM_MAX) : cmToInches(cm));

/** The value picked in `unit`, as the centimetres to store. */
export const heightToCm = (value: number, unit: HeightUnit) => (unit === "cm" ? clamp(Math.round(value), CM_MIN, CM_MAX) : inchesToCm(value));

/** 70 → 5′10″ */
export const formatFtIn = (inches: number) => `${Math.floor(inches / 12)}′${inches % 12}″`;
