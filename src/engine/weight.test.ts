import { describe, expect, it } from "vitest";
import { wattsPerKgX100, weightOn } from "./weight";

describe("weight", () => {
  const log = [
    { date: "2026-10-01", grams: 78_000, source: "strava" },
    { date: "2026-10-15", grams: 77_400, source: "strava" },
    { date: "2026-10-15", grams: 77_200, source: "manual" },
  ];
  it("carries the latest weigh-in forward", () => {
    expect(weightOn(log, "2026-09-30")).toBeNull();
    expect(weightOn(log, "2026-10-10")).toBe(78_000);
    expect(weightOn(log, "2026-11-05")).toBe(77_200); // manual wins on the same day
  });
  it("computes W/kg x100", () => {
    expect(wattsPerKgX100(315, 77_200)).toBe(408); // 315 / 77.2 = 4.080
    expect(wattsPerKgX100(315, 75_000)).toBe(420);
  });
});
