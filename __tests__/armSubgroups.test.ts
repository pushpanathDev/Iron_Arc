import { armSubgroupOf, isArmSubgroup, unassignedArmExercises } from "../data/armSubgroups";
import { EXERCISES } from "../data/exercises";

test("every built-in Arms exercise has a sub-group", () => {
  expect(unassignedArmExercises()).toEqual([]);
});

test("sub-group lookup", () => {
  expect(armSubgroupOf("hammer curl")).toBe("Biceps");
  expect(armSubgroupOf("Skull Crushers")).toBe("Triceps");
  expect(armSubgroupOf("Dead Hang")).toBe("Forearms");
  expect(armSubgroupOf("Arnold Press")).toBeNull();
  expect(isArmSubgroup("Triceps")).toBe(true);
  expect(isArmSubgroup("Arms")).toBe(false);
});

test("forearms has more than three exercises", () => {
  expect(EXERCISES.Arms.filter((n) => armSubgroupOf(n) === "Forearms").length).toBeGreaterThanOrEqual(6);
});
