import {
  kgToLbs,
  lbsToKg,
  displayWeight,
  toKg,
  formatWeight,
  weightLabel,
  weightStep,
} from "../utils/unitConversion";

describe("kgToLbs", () => {
  it("converts 1 kg to ~2.205 lbs", () => {
    expect(kgToLbs(1)).toBeCloseTo(2.205, 2);
  });
  it("converts 0 to 0", () => {
    expect(kgToLbs(0)).toBe(0);
  });
  it("converts 100 kg to ~220.5 lbs", () => {
    expect(kgToLbs(100)).toBeCloseTo(220.5, 0);
  });
});

describe("lbsToKg", () => {
  it("converts 2.205 lbs to ~1 kg", () => {
    expect(lbsToKg(2.205)).toBeCloseTo(1, 1);
  });
  it("round-trips correctly: kg -> lbs -> kg", () => {
    const original = 75;
    expect(lbsToKg(kgToLbs(original))).toBeCloseTo(original, 1);
  });
});

describe("displayWeight", () => {
  it("returns the same value for kg unit", () => {
    expect(displayWeight(80, "kg")).toBe(80);
  });
  it("converts to lbs for lbs unit", () => {
    expect(displayWeight(80, "lbs")).toBeCloseTo(kgToLbs(80), 1);
  });
  it("handles 0", () => {
    expect(displayWeight(0, "kg")).toBe(0);
    expect(displayWeight(0, "lbs")).toBe(0);
  });
});

describe("toKg", () => {
  it("passes through when unit is kg", () => {
    expect(toKg(80, "kg")).toBe(80);
  });
  it("converts lbs to kg", () => {
    expect(toKg(176.4, "lbs")).toBeCloseTo(80, 0);
  });
});

describe("formatWeight", () => {
  it("formats kg value with unit suffix", () => {
    const result = formatWeight(80.0, "kg");
    expect(result).toContain("kg");
    expect(result).toContain("80");
  });
  it("formats lbs value with unit suffix", () => {
    const lbs = kgToLbs(80);
    expect(formatWeight(lbs, "lbs")).toMatch(/lbs$/);
  });
});

describe("weightLabel", () => {
  it("returns kg for kg unit", () => {
    expect(weightLabel("kg")).toBe("kg");
  });
  it("returns lbs for lbs unit", () => {
    expect(weightLabel("lbs")).toBe("lbs");
  });
});

describe("weightStep", () => {
  it("returns 5 step for lbs", () => {
    expect(weightStep("lbs")).toBe(5);
  });
  it("returns 2.5 step for kg", () => {
    expect(weightStep("kg")).toBe(2.5);
  });
  it("kg step is smaller than lbs step", () => {
    expect(weightStep("kg")).toBeLessThan(weightStep("lbs"));
  });
});
