import type { BodyWeight } from "../services/api";
import { kgToLbs, lbsToKg, type WeightUnit } from "./unitConversion";

/*
 * Body-weight entry rules and the analog dial's scale, as pure functions.
 *
 * Range: the backend accepts 1–500 kg. The app asks for 20–500 kg (44–1102 lb):
 * below 20 kg is almost certainly a typo for a body weight, and 500 is the
 * server's ceiling. Values are typed/stepped to one decimal.
 */

export const MIN_KG = 20;
export const MAX_KG = 500;
/** Stepper increment in either unit. */
export const WEIGHT_STEP = 0.1;
const DAY_MS = 86_400_000;
const TREND_DAYS = 30;

const round1 = (n: number) => Math.round(n * 10) / 10;

export const minFor = (unit: WeightUnit) => (unit === "kg" ? MIN_KG : Math.ceil(kgToLbs(MIN_KG)));
export const maxFor = (unit: WeightUnit) => (unit === "kg" ? MAX_KG : Math.floor(kgToLbs(MAX_KG)));

/** Parse what the user typed: "77,4" and "77.4" both work; more than one decimal is rounded. */
export function parseWeight(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d{0,4}(\.\d*)?$/.test(t) || t === "" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? round1(n) : null;
}

/** Why a value can't be saved, or null if it can. */
export function weightError(value: number | null, unit: WeightUnit): string | null {
  if (value == null) return "Enter your weight";
  const min = minFor(unit);
  const max = maxFor(unit);
  if (value < min) return `Enter at least ${min} ${unit === "kg" ? "kg" : "lb"}`;
  if (value > max) return `The most you can log is ${max} ${unit === "kg" ? "kg" : "lb"}`;
  return null;
}

/** One stepper press, kept within the allowed range. */
export function stepWeight(value: number | null, direction: 1 | -1, unit: WeightUnit, fallback: number): number {
  const base = value ?? fallback;
  return Math.min(maxFor(unit), Math.max(minFor(unit), round1(base + direction * WEIGHT_STEP)));
}

/* ---------- analog dial scale ---------- */

export interface DialScale {
  /** Highest value on the dial, in the display unit. */
  capacity: number;
  /** Numbered every `label`, long tick every `major`, short tick every `minor`. */
  label: number;
  major: number;
  minor: number;
}

/** Like real scales: the smallest dial that fits, so normal weights get fine resolution. */
const DIALS: Record<WeightUnit, DialScale[]> = {
  kg: [
    { capacity: 160, label: 20, major: 10, minor: 2 },
    { capacity: 200, label: 20, major: 10, minor: 2 },
    { capacity: 300, label: 50, major: 10, minor: 5 },
    { capacity: 500, label: 100, major: 50, minor: 10 },
  ],
  lbs: [
    { capacity: 350, label: 50, major: 10, minor: 5 },
    { capacity: 450, label: 50, major: 10, minor: 5 },
    { capacity: 650, label: 100, major: 50, minor: 10 },
    { capacity: 1200, label: 200, major: 100, minor: 20 },
  ],
};

/** Keep this much headroom so the needle never sits right on the end stop. */
const HEADROOM = 0.95;

export function dialScaleFor(value: number | null, unit: WeightUnit): DialScale {
  const dials = DIALS[unit];
  if (value == null) return dials[0];
  return dials.find((d) => value <= d.capacity * HEADROOM) ?? dials[dials.length - 1];
}

/** Needle position 0..1 on the dial; past capacity it rests on the end stop. */
export function dialFraction(value: number | null, scale: DialScale): { fraction: number; overCapacity: boolean } {
  if (value == null || value <= 0) return { fraction: 0, overCapacity: false };
  return { fraction: Math.min(1, value / scale.capacity), overCapacity: value > scale.capacity };
}

/* ---------- trend ---------- */

export interface WeightChange {
  /** Latest minus the comparison entry, in kg. */
  deltaKg: number;
  /** Days actually covered (≤ 30 when there isn't a month of history yet). */
  days: number;
  sinceDate: string;
}

const dayMs = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00`);

/**
 * Change over the last 30 days: latest entry vs the most recent entry on or
 * before 30 days earlier. With less history, vs the oldest entry (and `days`
 * says how long that is). Null with fewer than two entries.
 */
export function changeOver(entries: BodyWeight[], days = TREND_DAYS): WeightChange | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const cutoff = dayMs(latest.date) - days * DAY_MS;
  const before = [...sorted].reverse().find((e) => dayMs(e.date) <= cutoff);
  const base = before ?? sorted[0];
  if (base === latest) return null;
  return {
    deltaKg: round1(latest.weight - base.weight),
    days: Math.round((dayMs(latest.date) - dayMs(base.date)) / DAY_MS),
    sinceDate: base.date.slice(0, 10),
  };
}

/** kg → display unit, one decimal. */
export const toDisplay = (kg: number, unit: WeightUnit) => round1(unit === "kg" ? kg : kgToLbs(kg));
/** display unit → kg, one decimal (what the server stores). */
export const fromDisplay = (value: number, unit: WeightUnit) => round1(unit === "kg" ? value : lbsToKg(value));

/** 77.4, 80 (no trailing ".0"). */
export const formatValue = (n: number) => String(round1(n));

/* ---------- target weight (optional, set by the user) ---------- */

/** Within this many kg counts as at the goal. */
const GOAL_TOLERANCE_KG = 0.1;

/** True if going from `fromKg` to `toKg` moved closer to the goal; null when there's no goal or no movement. */
export function towardGoal(fromKg: number, toKg: number, goalKg: number | null | undefined): boolean | null {
  if (goalKg == null || fromKg === toKg) return null;
  return Math.abs(toKg - goalKg) < Math.abs(fromKg - goalKg);
}

export interface GoalProgress {
  /** kg still to go (0 at the goal). */
  leftKg: number;
  reached: boolean;
  /** Which way the user still has to go. */
  direction: "lose" | "gain" | null;
}

/**
 * Progress from the latest weigh-in. The goal can change at any time (reach 80,
 * then aim for 75), so the direction comes from where the user is now, not
 * from where they started.
 */
export function goalProgress(latestKg: number, goalKg: number): GoalProgress {
  const diff = round1(goalKg - latestKg);
  if (Math.abs(diff) <= GOAL_TOLERANCE_KG) return { leftKg: 0, reached: true, direction: null };
  return { leftKg: Math.abs(diff), reached: false, direction: diff < 0 ? "lose" : "gain" };
}
