import { describe, expect, it } from "vitest";
import { dailyLoads, fitnessFatigue, toX100 } from "./fitness";

describe("fitnessFatigue", () => {
  it("matches hand-computed EWMA for loads [100, 0, 0]", () => {
    const pts = fitnessFatigue(
      new Map([["2026-10-12", 100]]),
      "2026-10-12",
      "2026-10-14",
    );
    // fitness: 100/42, then *41/42 each day
    expect(pts[0].fitness).toBeCloseTo(2.380952, 5);
    expect(pts[1].fitness).toBeCloseTo(2.324263, 5);
    expect(pts[2].fitness).toBeCloseTo(2.26892, 5);
    // fatigue: 100/7, then *6/7 each day
    expect(pts[0].fatigue).toBeCloseTo(14.285714, 5);
    expect(pts[1].fatigue).toBeCloseTo(12.244898, 5);
    expect(pts[2].fatigue).toBeCloseTo(10.495627, 5);
    expect(pts[2].form).toBeCloseTo(2.26892 - 10.495627, 4);
  });
  it("converges to constant load", () => {
    const m = new Map<string, number>();
    const pts = fitnessFatigue(m, "2026-01-01", "2026-01-02");
    expect(pts.at(-1)?.fitness).toBe(0);
    const loads = new Map<string, number>();
    let d = new Date(Date.UTC(2025, 0, 1));
    for (let i = 0; i < 1000; i++) {
      loads.set(d.toISOString().slice(0, 10), 100);
      d = new Date(d.getTime() + 86_400_000);
    }
    const end = fitnessFatigue(
      loads,
      "2025-01-01",
      d.toISOString().slice(0, 10),
    ).at(-2);
    expect(end?.fitness).toBeCloseTo(100, 4);
  });
  it("sums multiple activities per day and rounds cache values", () => {
    const m = dailyLoads([
      { localDate: "2026-10-13", load: 140 },
      { localDate: "2026-10-13", load: 10 },
    ]);
    expect(m.get("2026-10-13")).toBe(150);
    expect(toX100(2.380952)).toBe(238);
  });
});
