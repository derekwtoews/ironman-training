import { describe, expect, it } from "vitest";
import { dailyLoads } from "./fitness";
import type { ActivityLoadInput } from "./types";
import { weeklyVolume } from "./volume";

// Hand-checked four weeks (Mon 2026-10-12 ... Sun 2026-11-08). Loads come from the
// load.test.ts cases: bike A=140, bike B=220, run=10, strength(z1,25min)=25, strength(z2,30min)=60.
const acts: ActivityLoadInput[] = [
  {
    localDate: "2026-10-13",
    discipline: "bike",
    movingSeconds: 4800,
    distanceM: 30000,
    load: 140,
  },
  {
    localDate: "2026-10-15",
    discipline: "run",
    movingSeconds: 600,
    distanceM: 1500,
    load: 10,
  },
  {
    localDate: "2026-10-20",
    discipline: "bike",
    movingSeconds: 5400,
    distanceM: 40000,
    load: 220,
  },
  {
    localDate: "2026-10-22",
    discipline: "strength",
    movingSeconds: 1500,
    distanceM: 0,
    load: 25,
  },
  {
    localDate: "2026-10-26",
    discipline: "bike",
    movingSeconds: 4800,
    distanceM: 30000,
    load: 140,
  },
  {
    localDate: "2026-10-27",
    discipline: "bike",
    movingSeconds: 5400,
    distanceM: 40000,
    load: 220,
  },
  {
    localDate: "2026-11-01",
    discipline: "strength",
    movingSeconds: 1800,
    distanceM: 0,
    load: 60,
  },
  {
    localDate: "2026-11-02",
    discipline: "run",
    movingSeconds: 600,
    distanceM: 1500,
    load: 10,
  },
];

describe("weeklyVolume", () => {
  const w = weeklyVolume(acts);
  it("buckets into Monday-start weeks", () => {
    expect(w.map((x) => x.weekStart)).toEqual([
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
    ]);
  });
  it("totals match hand-checked numbers", () => {
    expect(w.map((x) => x.total.load)).toEqual([150, 245, 420, 10]);
    expect(w.map((x) => x.total.seconds)).toEqual([5400, 6900, 12000, 600]);
    expect(w.map((x) => x.total.sessions)).toEqual([2, 2, 3, 1]);
  });
  it("splits by discipline", () => {
    expect(w[2].byDiscipline.bike).toEqual({
      sessions: 2,
      seconds: 10200,
      distanceM: 70000,
      load: 360,
    });
    expect(w[2].byDiscipline.strength?.load).toBe(60); // Sunday Nov 1 belongs to week of Oct 26
  });
  it("daily loads feed the fitness series", () => {
    const d = dailyLoads(acts);
    expect(d.get("2026-11-01")).toBe(60);
    expect(d.size).toBe(8);
  });
});
