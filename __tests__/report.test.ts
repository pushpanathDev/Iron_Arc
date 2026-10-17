import { strFromU8, unzipSync } from "fflate";
import type { Achievement, BodyWeight, Workout } from "../services/api";
import { buildReport, monthAtAGlance, monthBounds, reportMonths, type ReportInput } from "../utils/report/reportData";
import { reportHtml } from "../utils/report/reportPdf";
import { reportWorkbook } from "../utils/report/reportXlsx";
import { excelDate } from "../utils/report/xlsx";

// reportData uses the pure session grouping; its module also holds a React hook.
jest.mock("../hooks/useWorkouts", () => ({ useAllWorkouts: jest.fn() }));

let n = 0;
const w = (date: string, exercise: string, sets: [number, number][], category = "Chest", time = "10:00", notes: string | null = null): Workout =>
  ({
    id: `w${++n}`,
    userId: "u",
    date,
    exercise,
    category,
    notes,
    createdAt: `${date}T${time}:00.000Z`,
    updatedAt: `${date}T${time}:00.000Z`,
    sets: sets.map(([weight, reps], i) => ({ id: `w${n}-${i}`, workoutId: `w${n}`, setNumber: i + 1, weight, reps })),
  }) as Workout;
const weigh = (date: string, weight: number) => ({ id: date, userId: "u", date, weekStart: null, weight, createdAt: date, updatedAt: date }) as BodyWeight;
const badge = (title: string, progress: number, targetValue: number, unlockedAt: string | null = null): Achievement =>
  ({ key: title, title, description: "", tier: "bronze", category: "x", targetValue, triggerEvents: [], progress, unlockedAt }) as Achievement;

const august = [w("2026-08-10", "Bench Press", [[70, 8]]), w("2026-08-12", "Bench Press", [[72.5, 8]])];
const september = [
  w("2026-09-01", "Bench Press", [[75, 8], [80, 5]], "Chest", "10:00", "Felt strong"), // record: 75 × 8 (the stronger set by estimated 1RM) beats August
  w("2026-09-01", "Pull Ups", [[0, 10]], "Back", "10:20"),
  w("2026-09-02", "My Curl", [[20, 10]], "Arms"),
  w("2026-09-03", "Squat", [[100, 5]], "Legs"),
  w("2026-09-09", "Squat", [[105, 5]], "Legs"), // record
  w("2026-09-16", "Bench Press", [[80, 5]]),
  w("2026-09-29", "Bench Press", [[80, 5]]),
];
const base: ReportInput = {
  workouts: [...august, ...september],
  weights: [weigh("2026-09-02", 76), weigh("2026-09-15", 75.4), weigh("2026-09-28", 74.8), weigh("2026-08-20", 77)],
  achievements: [badge("First workout", 1, 1, "2026-08-10T10:00:00.000Z"), badge("Iron habit", 10, 10, "2026-09-16T10:00:00.000Z"), badge("Volume master", 40000, 50000), badge("Century", 10, 100)],
  month: "2026-09",
  todayKey: "2026-10-17",
  firstName: "Asha",
  weeklyGoal: 3,
  goalWeightKg: 72,
  customArms: new Map([["my curl", "Biceps"]]),
};

describe("monthly report numbers", () => {
  const r = buildReport(base);

  it("covers the whole of a past month", () => {
    expect(monthBounds("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(r.rangeLabel).toBe("1 Sep – 30 Sep 2026");
    expect(r.daysSoFar).toBe(30);
    expect(r.isCurrentMonth).toBe(false);
  });

  it("counts workouts as sessions, and days trained", () => {
    expect(r.workouts).toBe(6); // the two 1 Sep logs are one session
    expect(r.daysTrained).toBe(6);
    expect(r.workoutsVsLastMonth).toBe(4);
    expect(r.headline).toBe("ASHA, YOU SHOWED UP.");
  });

  it("splits the month into four weeks, the last taking the leftover days", () => {
    expect(r.weeks.map((x) => [x.start, x.end, x.workouts])).toEqual([
      ["2026-09-01", "2026-09-07", 3],
      ["2026-09-08", "2026-09-14", 1],
      ["2026-09-15", "2026-09-21", 1],
      ["2026-09-22", "2026-09-30", 1],
    ]);
    expect(r.weeks.map((x) => x.metTarget)).toEqual([true, false, false, false]);
    expect(r.weeks.filter((x) => x.best).map((x) => x.label)).toEqual(["Week 1"]);
    expect(r.weeksMet).toBe(1);
  });

  it("finds the month's records and marks the exact set", () => {
    expect(r.prs.map((p) => [p.exercise, p.weightKg, p.reps])).toEqual(
      expect.arrayContaining([
        ["Bench Press", 75, 8],
        ["Squat", 105, 5],
      ]),
    );
    const marked = r.setRows.filter((s) => s.pr).map((s) => `${s.date} ${s.exercise} ${s.weightKg}`);
    expect(marked).toEqual(["2026-09-01 Bench Press 75", "2026-09-09 Squat 105"]);
    expect(r.calendar.filter((d) => d.pr).map((d) => d.date)).toEqual(["2026-09-01", "2026-09-09"]);
  });

  it("counts sets by muscle group, arms split like Analytics", () => {
    expect(r.muscles).toEqual(
      expect.arrayContaining([
        { group: "Chest", sets: 4 },
        { group: "Biceps", sets: 1 },
        { group: "Legs", sets: 2 },
      ]),
    );
    expect(r.topExercises[0].name).toBe("Bench Press");
    expect(r.topExercises[0]).toMatchObject({ sets: 4, topWeightKg: 80, topReps: 5 });
  });

  it("keeps notes on a workout's first set and says when a set is bodyweight", () => {
    expect(r.setRows[0]).toMatchObject({ set: 1, notes: "Felt strong" });
    expect(r.setRows[1].notes).toBe("");
    expect(r.setRows.find((s) => s.exercise === "Pull Ups")?.notes).toBe("Bodyweight");
  });

  it("body weight across the month, judged against the goal", () => {
    expect(r.body).toMatchObject({ startKg: 76, latestKg: 74.8, changeKg: -1.2, checkIns: 3, towardGoal: true });
    expect(buildReport({ ...base, goalWeightKg: null }).body?.towardGoal).toBeNull();
    expect(buildReport({ ...base, goalWeightKg: 80 }).body?.towardGoal).toBe(false);
  });

  it("badges unlocked this month, and the closest ones still to come", () => {
    expect(r.badges.map((b) => b.title)).toEqual(["Iron habit"]);
    expect(r.nextBadges.map((b) => b.title)).toEqual(["Volume master", "Century"]);
    expect(r.badgeRows[0].title).toBe("Iron habit");
  });
});

describe("months that aren't typical", () => {
  it("the current month runs to today, and later weeks don't show yet", () => {
    const r = buildReport({ ...base, month: "2026-09", todayKey: "2026-09-10" });
    expect(r.isCurrentMonth).toBe(true);
    expect(r.end).toBe("2026-09-10");
    expect(r.daysSoFar).toBe(10);
    expect(r.weeks).toHaveLength(2);
    expect(r.calendar.find((d) => d.date === "2026-09-11")?.future).toBe(true);
  });

  it("an empty month, and a first month", () => {
    expect(buildReport({ ...base, month: "2026-07" }).headline).toBe("A FRESH PAGE.");
    expect(buildReport({ ...base, month: "2026-08" }).headline).toBe("ASHA, IT STARTS HERE.");
    expect(buildReport({ ...base, month: "2026-07" }).workoutsVsLastMonth).toBeNull();
  });

  it("offers the current month and every month trained, newest first", () => {
    expect(reportMonths(base.workouts, "2026-10-17")).toEqual(["2026-10", "2026-09", "2026-08"]);
  });
});

describe("report files", () => {
  const r = buildReport({ ...base, workouts: [...base.workouts, w("2026-09-20", "Curl <&> \"press\"", [[10, 10]], "Arms")] });

  it("the PDF escapes anything the user typed", () => {
    const html = reportHtml(buildReport({ ...base, firstName: "<b>Asha</b>" }), "kg");
    expect(html).not.toContain("<b>ASHA</b>");
    expect(html).toContain("&lt;B&gt;ASHA&lt;/B&gt;");
    expect(html.match(/<section class="page/g)).toHaveLength(3);
  });

  it("the workbook holds four sheets, a chart, real dates and escaped text", () => {
    const files = unzipSync(reportWorkbook(r, { fullName: "Asha Rao", unit: "kg", generatedOn: "17 Oct 2026" }));
    const names = Object.keys(files);
    expect(names).toEqual(expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet4.xml", "xl/charts/chart1.xml", "xl/drawings/drawing1.xml"]));
    const workouts = strFromU8(files["xl/worksheets/sheet2.xml"]);
    expect(workouts).toContain("Curl &lt;&amp;&gt; &quot;press&quot;");
    expect(workouts).toContain(`<v>${excelDate("2026-09-01")}</v>`);
    expect(workouts).toContain("SUBTOTAL(109,G2:G");
    expect(strFromU8(files["docProps/app.xml"])).toContain("<Application>Iron Arc</Application>");
    expect(excelDate("1900-03-01")).toBe(61);
  });

  it("weights show in the user's unit", () => {
    const sheet = strFromU8(unzipSync(reportWorkbook(r, { fullName: "", unit: "lbs", generatedOn: "" }))["xl/worksheets/sheet2.xml"]);
    expect(sheet).toContain("Weight (lbs)");
    expect(sheet).toContain("<v>176.4</v>"); // 80 kg
  });
});

describe("month picker", () => {
  it("says what a month holds", () => {
    expect(monthAtAGlance(base.workouts, "2026-09")).toEqual({ workouts: 6, days: 6 });
    expect(monthAtAGlance(base.workouts, "2026-07")).toEqual({ workouts: 0, days: 0 });
  });
});
