import { daySetCount, daysByWeekday, exerciseTags, getPlanWeekDays, isTrainingDay, planDayShortName, planSummary, restLabel } from "../utils/planData";
import type { Plan } from "../services/api";

const planData = {
  planExplanation: "An upper/lower split for four days. It progresses weekly.",
  weeks: [
    {
      week: 1,
      days: [
        { day: "monday", sessionType: "training", targetMuscles: ["chest", "triceps"], estimatedDurationMinutes: 45, exercises: [{ name: "Barbell Bench Press", sets: 4, reps: "8-10" }, { name: "Tricep Pushdown", sets: 3, reps: "12" }] },
        { day: "tuesday", sessionType: "rest", recoveryNote: "Rest" },
        { day: "thursday", sessionType: "training", targetMuscles: ["quads", "hamstrings"], exercises: [{ name: "Barbell Back Squat", sets: 4, reps: "5" }] },
      ],
    },
    { week: 2, days: [{ day: "monday", sessionType: "training", targetMuscles: ["back", "biceps"], exercises: [{ name: "Barbell Row", sets: 4, reps: "8" }] }] },
  ],
};

describe("plan data", () => {
  test("week days, clamped to the weeks the plan has", () => {
    expect(getPlanWeekDays(planData, 1)).toHaveLength(3);
    expect(getPlanWeekDays(planData, 2)[0].day).toBe("monday");
    expect(getPlanWeekDays(planData, 9)).toHaveLength(1); // last week
  });

  test("Monday-first slots, rest days are not training days", () => {
    const slots = daysByWeekday(getPlanWeekDays(planData, 1));
    expect(slots.map((d) => (d ? d.day : null))).toEqual(["monday", "tuesday", null, "thursday", null, null, null]);
    expect(slots.map((d) => isTrainingDay(d))).toEqual([true, false, false, true, false, false, false]);
  });

  test("short session names from muscles", () => {
    expect(planDayShortName({ targetMuscles: ["chest", "triceps"] })).toBe("Push");
    expect(planDayShortName({ targetMuscles: ["back", "biceps"] })).toBe("Pull");
    expect(planDayShortName({ targetMuscles: ["quads", "hamstrings"] })).toBe("Legs");
    expect(planDayShortName({ targetMuscles: ["chest", "back", "shoulders"] })).toBe("Upper");
    expect(planDayShortName({ name: "Heavy day", targetMuscles: ["chest"] })).toBe("Heavy day");
  });

  test("sets, summary, tags and rest labels", () => {
    const [monday] = getPlanWeekDays(planData, 1);
    expect(daySetCount(monday)).toBe(7);
    expect(planSummary({ planData, weekNumber: 1, criteria: null } as unknown as Plan)).toMatchObject({ trainingDays: 2, minutes: 45 });
    expect(exerciseTags("Barbell Bench Press")).toBe("Chest · Barbell");
    expect(exerciseTags("Tricep Pushdown")).toBe("Arms · Cable");
    expect(exerciseTags("Unknown Move")).toBe("");
    expect([restLabel(90), restLabel(120), restLabel(45), restLabel(undefined)]).toEqual(["90 s", "2 min", "45 s", null]);
  });
});
