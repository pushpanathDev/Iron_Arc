import { currentWeekMonday, dateOfWeekday, doneWeekdays, exerciseMatchKey, isLighterWeek, planLength, readyForNextWeek, todayWeekday, weekStartedAt } from "../utils/planCalendar";
import type { PlanDay } from "../utils/planData";

// Friday 16 Oct 2026; that week's Monday is the 12th.
const friday = new Date(2026, 9, 16, 10, 0);
const day = (name: string, exercises: string[]): PlanDay => ({ day: name, sessionType: "training", exercises: exercises.map((n) => ({ name: n })) });
const rest = (name: string): PlanDay => ({ day: name, sessionType: "rest" });
const ppl = [day("monday", ["Barbell Bench Press"]), day("tuesday", ["Pull Up"]), day("wednesday", ["Barbell Squat"]), rest("thursday"), rest("friday"), rest("saturday"), rest("sunday")];
const plan = (createdAt: string, weekNumber: number, planData: unknown = { totalWeeks: 8, weeks: [{}] }) => ({ createdAt, weekNumber, planData });

describe("plan calendar", () => {
  it("puts plan days on this calendar week", () => {
    expect(todayWeekday(friday)).toBe(4);
    expect(dateOfWeekday(0, friday)).toBe("2026-10-12");
    expect(dateOfWeekday(6, friday)).toBe("2026-10-18");
  });

  it("a day is done once one of its exercises is logged on that date", () => {
    const logged = [
      { date: "2026-10-12", exercise: "barbell bench press" }, // Monday's Push, logged on Monday
      { date: "2026-10-16", exercise: "Pull Up" }, // Tuesday's Pull, but logged on Friday
      { date: "2026-10-07", exercise: "Barbell Squat" }, // last week
    ];
    expect([...doneWeekdays(ppl, logged, friday)]).toEqual([0]);
  });

  it("logging Monday's session with Monday's date marks Monday done", () => {
    expect([...doneWeekdays(ppl, [{ date: "2026-10-12T00:00:00.000Z", exercise: "Barbell Bench Press" }], friday)]).toEqual([0]);
  });

  it("exercise names match regardless of case and punctuation", () => {
    expect(exerciseMatchKey("Pull-Up")).toBe(exerciseMatchKey("pull up"));
  });

  it("a plan made on Thursday is in week 1 that week, and ready for week 2 the next Monday", () => {
    const thursday = "2026-10-15T09:00:00.000Z";
    expect(currentWeekMonday(plan(thursday, 1))).toBe("2026-10-12");
    expect(readyForNextWeek(plan(thursday, 1), friday)).toBe(false);
    expect(readyForNextWeek(plan(thursday, 1), new Date(2026, 9, 19, 8, 0))).toBe(true);
    expect(readyForNextWeek(plan(thursday, 2), new Date(2026, 9, 19, 8, 0))).toBe(false);
  });

  it("a plan made on a weekend starts the following Monday", () => {
    const saturday = new Date(2026, 9, 17, 12, 0).toISOString();
    expect(currentWeekMonday(plan(saturday, 1))).toBe("2026-10-19");
    expect(readyForNextWeek(plan(saturday, 1), new Date(2026, 9, 19, 8, 0))).toBe(false);
  });

  it("moving on early isn't undone, and the last week has nothing next", () => {
    const thursday = "2026-10-15T09:00:00.000Z";
    expect(readyForNextWeek(plan(thursday, 3), new Date(2026, 9, 19))).toBe(false);
    expect(readyForNextWeek(plan(thursday, 8), new Date(2026, 11, 20))).toBe(false);
  });

  it("plan length and lighter weeks", () => {
    expect(planLength({ totalWeeks: 8, weeks: [{}] })).toBe(8);
    expect(planLength({ weeks: [{}, {}, {}] })).toBe(3); // made before weekly plans
    expect(planLength(null)).toBe(1);
    expect(isLighterWeek({ weeks: [{}, {}, {}, { isDeloadWeek: true }] }, 4)).toBe(true);
    expect(isLighterWeek({ weeks: [{}] }, 1)).toBe(false);
  });
});

describe("a week that started mid-week", () => {
  const monPush = [{ day: "monday", sessionType: "training", exercises: [{ name: "Barbell Bench Press" }] }] as PlanDay[];
  const friday = new Date(2026, 9, 16, 15, 0);
  const mondayLog = (createdAt: string) => [{ date: "2026-10-12", exercise: "Barbell Bench Press", createdAt }];

  it("a workout saved before the week started doesn't count for it", () => {
    expect([...doneWeekdays(monPush, mondayLog("2026-10-12T08:00:00.000Z"), friday, "2026-10-16T09:00:00.000Z")]).toEqual([]);
  });

  it("a session for an earlier day, saved after the week started, does count", () => {
    expect([...doneWeekdays(monPush, mondayLog("2026-10-16T10:00:00.000Z"), friday, "2026-10-16T09:00:00.000Z")]).toEqual([0]);
  });

  it("the week's start comes from the plan; older plans use the plan's creation for week 1 only", () => {
    expect(weekStartedAt({ createdAt: "2026-10-01T00:00:00.000Z", weekNumber: 3, planData: { weekStartedAt: "2026-10-16T09:00:00.000Z" } })).toBe("2026-10-16T09:00:00.000Z");
    expect(weekStartedAt({ createdAt: "2026-10-01T00:00:00.000Z", weekNumber: 1, planData: {} })).toBe("2026-10-01T00:00:00.000Z");
    expect(weekStartedAt({ createdAt: "2026-10-01T00:00:00.000Z", weekNumber: 3, planData: {} })).toBeNull();
  });
});
