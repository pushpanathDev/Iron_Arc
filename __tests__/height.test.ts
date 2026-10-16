import { CM_MAX, CM_MIN, cmToInches, formatFtIn, heightInUnit, heightToCm, IN_MAX, IN_MIN, inchesToCm } from "../utils/height";

describe("height units", () => {
  it("shows a stored height in either unit", () => {
    expect(heightInUnit(179, "cm")).toBe(179);
    expect(heightInUnit(179, "ft")).toBe(70); // 70.47 in
    expect(formatFtIn(70)).toBe("5′10″");
  });

  it("switching units without moving the picker keeps the stored cm", () => {
    // The picker only reports a value once the user moves it, so 179 stays 179.
    const shownInFt = heightInUnit(179, "ft");
    expect(heightInUnit(179, "cm")).toBe(179);
    expect(shownInFt).toBe(70);
  });

  it("picking in ft-in stores the nearest whole cm", () => {
    expect(heightToCm(70, "ft")).toBe(178); // 177.8
    expect(heightToCm(76, "ft")).toBe(193); // 193.04
    // and reads back the same inch
    expect(heightInUnit(heightToCm(70, "ft"), "ft")).toBe(70);
  });

  it("every inch survives a round trip through cm", () => {
    for (let inches = IN_MIN; inches <= IN_MAX; inches++) expect(cmToInches(inchesToCm(inches))).toBe(inches);
  });

  it("every cm changes by at most 1 after a round trip through inches", () => {
    for (let cm = 102; cm <= 248; cm++) expect(Math.abs(inchesToCm(cmToInches(cm)) - cm)).toBeLessThanOrEqual(1);
  });

  it("keeps the ends inside the range", () => {
    expect(heightInUnit(CM_MIN, "ft")).toBe(IN_MIN); // 100 cm is 39.4 in: shown as the lowest inch
    expect(heightInUnit(CM_MAX, "ft")).toBe(IN_MAX);
    expect(heightToCm(IN_MIN, "ft")).toBeGreaterThanOrEqual(CM_MIN);
    expect(heightToCm(IN_MAX, "ft")).toBeLessThanOrEqual(CM_MAX);
    expect(heightInUnit(90, "cm")).toBe(CM_MIN);
    expect(heightInUnit(260, "cm")).toBe(CM_MAX);
    expect(heightInUnit(182.6, "cm")).toBe(183);
  });
});
