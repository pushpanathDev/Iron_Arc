import { dateOfWeekday, doneWeekdays, exerciseMatchKey, isLighterWeek, nextWeekStartsOn, planLength, readyForNextWeek, todayWeekday, weekStartsOn } from "../utils/planCalendar";
import type { PlanDay } from "../utils/planData";

// Friday 16 Oct 2026; that week's Monday is the 12th.
const friday = new Date(2026, 9, 16, 10, 0);
const day = (name: string, exercises: string[]): PlanDay => ({ day: name, sessionType: "training", exercises: exercises.map((n) => ({ name: n })) });
const rest = (name: string): PlanDay => ({ day: name, sessionType: "rest" });
const ppl = [day("monday", ["Barbell Bench Press"]), day("tuesday", ["Pull Ups"]), day("wednesday", ["Barbell Back Squat"]), rest("thursday"), rest("friday"), rest("saturday"), rest("sunday")];
const plan = (planData: unknown, weekNumber = 1, createdAt = "2026-10-14T09:00:00.000Z") => ({ createdAt, weekNumber, planData });

describe("plan weeks are calendar weeks", () => {
  it("each plan week knows its Monday", () => {
    expect(weekStartsOn(plan({ weekStartsOn: "2026-10-19" }))).toBe("2026-10-19");
    expect(nextWeekStartsOn(plan({ weekStartsOn: "2026-10-19" }))).toBe("2026-10-26");
  });

  it("plans from before: the week's start time, or weeks counted from when the plan was made", () => {
    expect(weekStartsOn(plan({ weekStartedAt: "2026-10-16T09:00:00.000Z" }))).toBe("2026-10-12");
    expect(weekStartsOn(plan({}, 1, "2026-10-14T09:00:00.000Z"))).toBe("2026-10-12"); // made on a Wednesday
    expect(weekStartsOn(plan({}, 3, "2026-10-01T09:00:00.000Z"))).toBe("2026-10-12");
    expect(weekStartsOn(plan({}, 1, new Date(2026, 9, 17, 12, 0).toISOString()))).toBe("2026-10-19"); // made on a Saturday
  });

  it("the next week can start from the Monday after, not before", () => {
    const week1 = plan({ totalWeeks: 8, weekStartsOn: "2026-10-12" });
    expect(readyForNextWeek(week1, friday)).toBe(false);
    expect(readyForNextWeek(week1, new Date(2026, 9, 18, 22, 0))).toBe(false); // Sunday night
    expect(readyForNextWeek(week1, new Date(2026, 9, 19, 7, 0))).toBe(true); // Monday
    expect(readyForNextWeek(week1, new Date(2026, 10, 2))).toBe(true); // weeks later, still waiting
  });

  it("the last week has nothing next", () => {
    expect(readyForNextWeek(plan({ totalWeeks: 8, weekStartsOn: "2026-10-12" }, 8), new Date(2026, 11, 20))).toBe(false);
  });

  it("plan days have the dates of their own week", () => {
    expect(todayWeekday(friday)).toBe(4);
    expect(dateOfWeekday(0, "2026-10-19")).toBe("2026-10-19");
    expect(dateOfWeekday(6, "2026-10-19")).toBe("2026-10-25");
  });
});

describe("done days", () => {
  it("a day is done once one of its exercises is logged on that day's date", () => {
    const logged = [
      { date: "2026-10-12", exercise: "barbell bench press" }, // Monday's Push, on Monday
      { date: "2026-10-16", exercise: "Pull Ups" }, // Tuesday's Pull, but on Friday
      { date: "2026-10-07", exercise: "Barbell Back Squat" }, // the week before
    ];
    expect([...doneWeekdays(ppl, logged, "2026-10-12")]).toEqual([0]);
  });

  it("week 2 doesn't count week 1's workouts: it has its own dates", () => {
    expect([...doneWeekdays(ppl, [{ date: "2026-10-12", exercise: "Barbell Bench Press" }], "2026-10-19")]).toEqual([]);
  });

  it("dates with a time, and names in any case or punctuation", () => {
    expect([...doneWeekdays(ppl, [{ date: "2026-10-12T00:00:00.000Z", exercise: "Barbell Bench Press" }], "2026-10-12")]).toEqual([0]);
    expect(exerciseMatchKey("Pull-Up")).toBe(exerciseMatchKey("pull up"));
  });
});

describe("plan length and lighter weeks", () => {
  it("reads both", () => {
    expect(planLength({ totalWeeks: 8, weeks: [{}] })).toBe(8);
    expect(planLength({ weeks: [{}, {}, {}] })).toBe(3); // made before weekly plans
    expect(planLength(null)).toBe(1);
    expect(isLighterWeek({ weeks: [{}, {}, {}, { isDeloadWeek: true }] }, 4)).toBe(true);
    expect(isLighterWeek({ weeks: [{}] }, 1)).toBe(false);
  });
});
