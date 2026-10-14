import type { BodyWeight } from "../services/api";
import {
  changeOver,
  dialFraction,
  dialScaleFor,
  formatValue,
  fromDisplay,
  maxFor,
  minFor,
  parseWeight,
  stepWeight,
  toDisplay,
  weightError,
} from "../utils/bodyWeightRules";

const entry = (date: string, weight: number): BodyWeight =>
  ({ id: date, userId: "u", date, weekStart: null, weight, createdAt: `${date}T08:00:00Z`, updatedAt: `${date}T08:00:00Z` }) as BodyWeight;

test("allowed range: 20–500 kg, 45–1102 lb", () => {
  expect([minFor("kg"), maxFor("kg"), minFor("lbs"), maxFor("lbs")]).toEqual([20, 500, 45, 1102]);
  expect(weightError(null, "kg")).toBe("Enter your weight");
  expect(weightError(19.9, "kg")).toBe("Enter at least 20 kg");
  expect(weightError(20, "kg")).toBeNull();
  expect(weightError(500, "kg")).toBeNull();
  expect(weightError(500.1, "kg")).toBe("The most you can log is 500 kg");
  expect(weightError(1102, "lbs")).toBeNull();
  expect(weightError(1103, "lbs")).toBe("The most you can log is 1102 lb");
});

test("parsing what people type", () => {
  expect(parseWeight("77.4")).toBe(77.4);
  expect(parseWeight("77,4")).toBe(77.4);
  expect(parseWeight("77.46")).toBe(77.5);
  expect(parseWeight("75")).toBe(75);
  expect(parseWeight("75.")).toBe(75);
  expect(parseWeight("")).toBeNull();
  expect(parseWeight(".")).toBeNull();
  expect(parseWeight("-5")).toBeNull();
  expect(parseWeight("7a")).toBeNull();
  expect(parseWeight("12345")).toBeNull(); // more than 4 digits
});

test("stepper: 0.1 steps, clamped to the range, starts from a fallback", () => {
  expect(stepWeight(77.4, 1, "kg", 70)).toBe(77.5);
  expect(stepWeight(77.4, -1, "kg", 70)).toBe(77.3);
  expect(stepWeight(null, 1, "kg", 70)).toBe(70.1);
  expect(stepWeight(20, -1, "kg", 70)).toBe(20);
  expect(stepWeight(500, 1, "kg", 70)).toBe(500);
  expect(stepWeight(0.1 + 0.2, 1, "kg", 70)).toBe(20); // below range → clamped up
});

test("dial picks the smallest scale that fits, like a real scale", () => {
  expect(dialScaleFor(null, "kg").capacity).toBe(160);
  expect(dialScaleFor(75, "kg").capacity).toBe(160);
  expect(dialScaleFor(152, "kg").capacity).toBe(160);
  expect(dialScaleFor(153, "kg").capacity).toBe(200);
  expect(dialScaleFor(260, "kg").capacity).toBe(300);
  expect(dialScaleFor(500, "kg").capacity).toBe(500);
  expect(dialScaleFor(165, "lbs").capacity).toBe(350);
  expect(dialScaleFor(1102, "lbs").capacity).toBe(1200);
});

test("needle position: empty at 0, proportional, pegged past capacity", () => {
  const s = dialScaleFor(75, "kg");
  expect(dialFraction(null, s)).toEqual({ fraction: 0, overCapacity: false });
  expect(dialFraction(80, s).fraction).toBeCloseTo(0.5);
  expect(dialFraction(170, s)).toEqual({ fraction: 1, overCapacity: true });
});

test("unit round-trips at one decimal", () => {
  expect(toDisplay(77.4, "lbs")).toBe(170.6);
  expect(fromDisplay(170.6, "lbs")).toBe(77.4);
  expect(formatValue(80)).toBe("80");
  expect(formatValue(77.45)).toBe("77.5");
});

test("30-day change", () => {
  expect(changeOver([])).toBeNull();
  expect(changeOver([entry("2026-10-12", 77.4)])).toBeNull();
  // Less than a month of history: compared with the oldest entry.
  expect(changeOver([entry("2026-10-02", 78.6), entry("2026-10-12", 77.4)])).toEqual({ deltaKg: -1.2, days: 10, sinceDate: "2026-10-02" });
  // More than a month: compared with the last entry on or before 30 days ago.
  expect(
    changeOver([entry("2026-08-01", 82), entry("2026-09-10", 79), entry("2026-09-20", 78.5), entry("2026-10-12", 77.4)]),
  ).toEqual({ deltaKg: -1.6, days: 32, sinceDate: "2026-09-10" });
});

describe("target weight", () => {
  const { towardGoal, goalProgress } = jest.requireActual("../utils/bodyWeightRules");

  test("toward / away from the goal", () => {
    expect(towardGoal(78, 77.5, 72)).toBe(true);
    expect(towardGoal(77.5, 78, 72)).toBe(false);
    expect(towardGoal(60, 61, 65)).toBe(true); // gaining toward a higher goal
    expect(towardGoal(78, 77.5, null)).toBeNull();
    expect(towardGoal(78, 78, 72)).toBeNull();
  });

  test("progress: from the latest weigh-in, so the goal can change any time", () => {
    expect(goalProgress(75, 72)).toEqual({ leftKg: 3, reached: false, direction: "lose" });
    expect(goalProgress(72.05, 72)).toEqual({ leftKg: 0, reached: true, direction: null });
    expect(goalProgress(63, 65)).toEqual({ leftKg: 2, reached: false, direction: "gain" });
    // Reached 80, then aims for 75: 5 kg to lose (not "reached").
    expect(goalProgress(80, 80)).toEqual({ leftKg: 0, reached: true, direction: null });
    expect(goalProgress(80, 75)).toEqual({ leftKg: 5, reached: false, direction: "lose" });
  });
});
