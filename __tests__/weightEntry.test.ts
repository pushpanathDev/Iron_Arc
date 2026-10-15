import { EXERCISES } from "../data/exercises";
import { WEIGHT_HINTS, weightHintFor } from "../utils/weightEntry";

describe("weight entry hint", () => {
  test.each([
    ["EZ Bar Curl", WEIGHT_HINTS.bar],
    ["Barbell Back Squat", WEIGHT_HINTS.bar],
    ["Deadlift", WEIGHT_HINTS.bar],
    ["Smith Machine Squat", WEIGHT_HINTS.bar],
    ["Dumbbell Bench Press", WEIGHT_HINTS.dumbbell],
    ["Lateral Raise", WEIGHT_HINTS.dumbbell],
    ["Cable Crossover", WEIGHT_HINTS.twoCables],
    ["Seated Cable Row", WEIGHT_HINTS.cable],
    ["Tricep Pushdown", WEIGHT_HINTS.cable],
    ["Cable Crunch", WEIGHT_HINTS.cable],
    ["Leg Press", WEIGHT_HINTS.machine],
    ["Pull Ups", WEIGHT_HINTS.bodyweight],
    ["Dips (Chest)", WEIGHT_HINTS.bodyweight],
    ["Kettlebell Swing", WEIGHT_HINTS.kettlebell],
  ])("%s", (name, hint) => expect(weightHintFor(name)).toBe(hint));

  test("no hint where it can't know (cardio, unknown custom names)", () => {
    expect(weightHintFor("Treadmill Running")).toBeNull();
    expect(weightHintFor("My Weird Lift")).toBeNull();
  });

  test("most strength exercises in the catalog get a hint", () => {
    const strength = Object.entries(EXERCISES)
      .filter(([cat]) => cat !== "Cardio")
      .flatMap(([, names]) => names);
    const covered = strength.filter((n) => weightHintFor(n)).length;
    expect(covered / strength.length).toBeGreaterThan(0.85);
  });
});

describe("bar + plates", () => {
   
  const { usesPlates, defaultBarWeight, barTotal, platesFor } = require("../utils/weightEntry");

  test("only for bars loaded on both ends", () => {
    expect(usesPlates("EZ Bar Curl")).toBe(true);
    expect(usesPlates("Deadlift")).toBe(true);
    expect(usesPlates("Landmine Press")).toBe(false);
    expect(usesPlates("T-Bar Row")).toBe(false);
    expect(usesPlates("Dumbbell Curl")).toBe(false);
  });

  test("default bar by type", () => {
    expect(defaultBarWeight("EZ Bar Curl", "kg")).toBe(10);
    expect(defaultBarWeight("Deadlift", "kg")).toBe(20);
    expect(defaultBarWeight("Deadlift", "lbs")).toBe(45);
  });

  test("total and plates per side", () => {
    expect(barTotal(10, [2.5])).toBe(15);
    expect(barTotal(20, [20, 5, 1.25])).toBe(72.5);
    expect(platesFor(72.5, 20, "kg")).toEqual([25, 1.25]); // fewest plates
    expect(platesFor(20, 20, "kg")).toEqual([]);
    expect(platesFor(21, 20, "kg")).toBeNull(); // 0.5 a side: no such plate
    expect(platesFor(15, 20, "kg")).toBeNull(); // lighter than the bar
  });
});
