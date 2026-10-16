import type { User } from "../services/api";
import { isProfileComplete, missingProfileFields } from "../utils/profileComplete";

const complete = {
  displayName: "Sam",
  age: 28,
  height: 178,
  fitnessGoal: "muscle",
  experienceLevel: "beginner",
  equipment: "full_gym",
  trainingDays: [1, 3, 5],
} as User;

describe("profile completeness", () => {
  it("accepts a fully set up profile", () => {
    expect(isProfileComplete(complete)).toBe(true);
  });

  it("names each missing field", () => {
    const empty = { ...complete, displayName: "  ", age: null, height: null, fitnessGoal: null, experienceLevel: null, equipment: null, trainingDays: [] } as User;
    expect(missingProfileFields(empty)).toEqual(["name", "age", "height", "goal", "experience", "equipment", "days"]);
  });

  it("a profile filled in Profile but without a goal still needs onboarding", () => {
    expect(isProfileComplete({ ...complete, fitnessGoal: null })).toBe(false);
  });

  it("fields an older server leaves out don't block", () => {
    const old = { ...complete, experienceLevel: undefined, equipment: undefined, trainingDays: undefined } as User;
    expect(isProfileComplete(old)).toBe(true);
  });

  it("no profile is incomplete", () => {
    expect(isProfileComplete(null)).toBe(false);
  });
});
