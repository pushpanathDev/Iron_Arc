import { homeHeadlines, type HeadlineInput } from "../components/home/headlines";

const base: HeadlineInput = { firstName: "Asha", trainedToday: false, week: { daysTrained: 2, goal: 6, met: false, remaining: 4 }, suggestion: null, streak: 0 };
const at = (hour: number, day = 17) => new Date(2026, 9, day, hour, 0);

describe("home headlines", () => {
  it("greets by the time of day, with the name", () => {
    expect(homeHeadlines(base, at(8))[0]).toMatch(/(morning|shine).*Asha/i);
    expect(homeHeadlines(base, at(14))[0]).toContain("Asha");
    expect(homeHeadlines({ ...base, firstName: "" }, at(20))[0]).not.toContain(",");
  });

  it("cheers a session done today, and nudges one not done yet", () => {
    expect(["Crushed it today!", "Another one in the bank!", "You showed up today!", "Today's work done!"]).toContain(homeHeadlines({ ...base, trainedToday: true }, at(19))[1]);
    expect(["Still time to train today", "Finish the day strong!"]).toContain(homeHeadlines(base, at(19))[1]);
    expect(homeHeadlines(base, at(23))[1]).toBe("Rest up. Go again tomorrow");
  });

  it("counts the week toward the goal", () => {
    const week = (daysTrained: number, goal: number | null) => homeHeadlines({ ...base, week: { daysTrained, goal, met: !!goal && daysTrained >= goal, remaining: goal ? Math.max(0, goal - daysTrained) : 0 } }, at(10))[2];
    expect(week(2, 6)).toBe("2 of 6 down, 4 to go!");
    expect(week(5, 6)).toBe("One more day to your goal!");
    expect(week(6, 6)).toBe("Week goal smashed!");
    expect(week(7, 6)).toBe("Above and beyond this week");
    expect(week(0, 6)).toBe("New week, fresh start!");
    expect(homeHeadlines({ ...base, week: { daysTrained: 2, goal: null, met: false, remaining: 0 } }, at(10))).toHaveLength(2);
  });

  it("adds the next muscle group and the streak when there are any", () => {
    const lines = homeHeadlines({ ...base, suggestion: "Back", streak: 3 }, at(10));
    expect(lines).toContain("Back day is calling!");
    expect(lines).toContain("3-week streak. Keep going!");
  });

  it("holds the same wording all day and changes it the next", () => {
    expect(homeHeadlines(base, at(7))).toEqual(homeHeadlines(base, at(11)));
    const days = new Set([16, 17, 18].map((d) => homeHeadlines({ ...base, trainedToday: true }, at(19, d))[1]));
    expect(days.size).toBeGreaterThan(1);
  });

  it("every line fits the one-line headline", () => {
    const inputs = [base, { ...base, trainedToday: true, suggestion: "Shoulders", streak: 12 }, { ...base, firstName: "Pushpanath" }];
    for (const input of inputs) for (const h of [7, 13, 19, 23]) for (const d of [16, 17, 18]) for (const line of homeHeadlines(input, at(h, d))) expect(line.length).toBeLessThanOrEqual(27);
  });
});
