import { diffPlanWeek } from "../utils/planData";

const ex = (name: string, sets = 3, reps = "8-10") => ({ name, sets, reps });
const plan = (days: object[]) => ({ weeks: [{ week: 1, days }] });

describe("diffPlanWeek", () => {
  const before = plan([
    { day: "monday", sessionType: "training", targetMuscles: ["chest", "triceps"], exercises: [ex("Bench Press", 4, "8"), ex("Bicep Curl")] },
    { day: "wednesday", sessionType: "training", targetMuscles: ["quads"], exercises: [ex("Barbell Squat")] },
    { day: "thursday", sessionType: "training", targetMuscles: ["back"], exercises: [ex("Barbell Row", 4, "8")] },
  ]);
  const after = plan([
    { day: "monday", sessionType: "training", targetMuscles: ["chest", "triceps"], exercises: [ex("Bench Press", 3, "8"), ex("Lateral Raise")] },
    { day: "wednesday", sessionType: "rest" },
    { day: "thursday", sessionType: "training", targetMuscles: ["back"], exercises: [ex("Barbell Row", 4, "8"), ex("Pull Up")] },
    { day: "saturday", sessionType: "training", targetMuscles: ["quads", "hamstrings"], exercises: [ex("Leg Press"), ex("Leg Curl")] },
  ]);

  test("lists swaps, added, removed, scheme changes and day changes, Monday first", () => {
    expect(diffPlanWeek(before, after, 1)).toEqual([
      { dayIndex: 0, text: "Mon: Bicep Curl → Lateral Raise" },
      { dayIndex: 0, text: "Mon: Bench Press 4×8 → 3×8" },
      { dayIndex: 2, text: "Wed is now a rest day" },
      { dayIndex: 3, text: "Thu: + Pull Up" },
      { dayIndex: 5, text: "Sat: Legs, 2 exercises" },
    ]);
  });

  test("no changes, no lines", () => {
    expect(diffPlanWeek(before, before, 1)).toEqual([]);
  });
});
