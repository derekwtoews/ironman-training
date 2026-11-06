import { describe, expect, it } from "vitest";
import { weekInsights } from "./insights";

const base = {
  today: "2026-11-05",
  lastDateBySport: {},
  completedWeekLoads: [],
  noHrCount: 0,
};

describe("weekInsights", () => {
  it("flags a ramp over the cap, with the numbers", () => {
    // 455 -> 513 is +12.7%; cap = floor(455 * 1.12) = 509
    const r = weekInsights({ ...base, completedWeekLoads: [455, 513] });
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe("Last week's load was +13%");
    expect(r[0].detail).toContain("max 509");
  });
  it("does not flag a ramp within the cap or with too little history", () => {
    expect(weekInsights({ ...base, completedWeekLoads: [455, 500] })).toEqual(
      [],
    );
    expect(weekInsights({ ...base, completedWeekLoads: [455] })).toEqual([]);
  });
  it("flags a sport gap of 8+ days, not 7", () => {
    const seven = weekInsights({
      ...base,
      lastDateBySport: { swim: "2026-10-29" },
    });
    expect(seven).toEqual([]);
    const eight = weekInsights({
      ...base,
      lastDateBySport: { swim: "2026-10-28", run: "2026-11-05" },
    });
    expect(eight.map((x) => x.id)).toEqual(["gap-swim"]);
    expect(eight[0].title).toBe("No swim in 8 days");
  });
  it("reports workouts without heart rate, singular and plural", () => {
    expect(weekInsights({ ...base, noHrCount: 1 })[0].title).toBe(
      "1 workout has no heart rate",
    );
    expect(weekInsights({ ...base, noHrCount: 3 })[0].title).toBe(
      "3 workouts have no heart rate",
    );
  });
});
