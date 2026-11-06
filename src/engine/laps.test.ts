import { describe, expect, it } from "vitest";
import { classifyLaps, isAutoLap, type LapInput, summarizeReps } from "./laps";

// Real laps from Derek's Nov 5, 2026 run (3 x 10 min threshold), via Strava.
const nov5: LapInput[] = [
  {
    movingSeconds: 422,
    distanceM: 1081,
    avgSpeedMmS: 2561,
    avgHr: 139,
    avgWatts: null,
  },
  {
    movingSeconds: 612,
    distanceM: 1788,
    avgSpeedMmS: 2921,
    avgHr: 160,
    avgWatts: null,
  },
  {
    movingSeconds: 179,
    distanceM: 269,
    avgSpeedMmS: 1502,
    avgHr: 130,
    avgWatts: null,
  },
  {
    movingSeconds: 600,
    distanceM: 1630,
    avgSpeedMmS: 2717,
    avgHr: 161,
    avgWatts: null,
  },
  {
    movingSeconds: 180,
    distanceM: 282,
    avgSpeedMmS: 1568,
    avgHr: 130,
    avgWatts: null,
  },
  {
    movingSeconds: 602,
    distanceM: 1629,
    avgSpeedMmS: 2707,
    avgHr: 159,
    avgWatts: null,
  },
  {
    movingSeconds: 15,
    distanceM: 23,
    avgSpeedMmS: 1513,
    avgHr: 162,
    avgWatts: null,
  },
];

const lap = (
  s: number,
  hr: number | null,
  w: number | null = null,
  mmS: number | null = 2800,
): LapInput => ({
  movingSeconds: s,
  distanceM: Math.round((s * (mmS ?? 2800)) / 1000),
  avgSpeedMmS: mmS,
  avgHr: hr,
  avgWatts: w,
});

describe("classifyLaps", () => {
  it("finds warm-up, three reps and rests in the real Nov 5 run", () => {
    expect(classifyLaps("run", nov5)).toEqual([
      "warmup",
      "work",
      "rest",
      "work",
      "rest",
      "work",
      "other",
    ]);
  });
  it("summarizes reps: 5:42, 6:08, 6:09 per km, 27 s fade", () => {
    const s = summarizeReps("run", nov5, classifyLaps("run", nov5));
    expect(s.reps).toBe(3);
    expect(s.paceSecPerKm).toEqual([342, 368, 369]); // 5:42, 6:08, 6:09
    expect(s.avgHr).toEqual([160, 161, 159]);
    expect(s.fade).toBe(27);
  });
  it("treats auto-lap kilometers on a steady run as steady", () => {
    const easy = [
      lap(410, 140),
      lap(412, 142),
      lap(408, 145),
      lap(415, 146),
      lap(411, 147),
    ];
    expect(classifyLaps("run", easy)).toEqual([
      "steady",
      "steady",
      "steady",
      "steady",
      "steady",
    ]);
  });
  it("uses watts on the bike (ERG threshold set)", () => {
    const ride = [
      lap(600, 120, 180),
      lap(600, 165, 305),
      lap(300, 140, 130),
      lap(600, 168, 308),
      lap(300, 140, 128),
      lap(600, 170, 306),
      lap(600, 125, 150),
    ];
    const kinds = classifyLaps("bike", ride);
    expect(kinds).toEqual([
      "warmup",
      "work",
      "rest",
      "work",
      "rest",
      "work",
      "cooldown",
    ]);
    expect(summarizeReps("bike", ride, kinds)).toMatchObject({
      reps: 3,
      avgWatts: [305, 308, 306],
      fade: 1,
    });
  });
  it("finds a single tempo block", () => {
    expect(
      classifyLaps("run", [lap(600, 135), lap(1200, 158), lap(600, 136)]),
    ).toEqual(["warmup", "work", "cooldown"]);
  });
  it("labels pool swims as sets and rests (real Oct 30 shape)", () => {
    const swim = [100, 0, 200, 0, 450, 0, 200, 0, 150].map((m) => ({
      ...lap(60, null, null, null),
      distanceM: m,
    }));
    expect(classifyLaps("swim", swim)).toEqual([
      "set",
      "rest",
      "set",
      "rest",
      "set",
      "rest",
      "set",
      "rest",
      "set",
    ]);
  });
  it("leaves too-few or signal-less laps as steady", () => {
    expect(classifyLaps("run", [lap(3600, 145)])).toEqual(["steady"]);
    // two laps (e.g. one press at a turnaround) are never intervals
    expect(classifyLaps("run", [lap(1500, 138), lap(1400, 152)])).toEqual([
      "steady",
      "steady",
    ]);
    expect(
      classifyLaps("run", [
        lap(600, null, null, null),
        lap(600, null, null, null),
      ]),
    ).toEqual(["steady", "steady"]);
  });
  it("treats Garmin 5 km auto-laps as steady (real Nov 1 ride)", () => {
    const nov1 = [
      [5000, 672, 204, 128],
      [5000, 815, 226, 136],
      [5000, 658, 202, 129],
      [5000, 690, 218, 133],
      [5000, 623, 218, 134],
      [5000, 596, 215, 135],
      [2437, 340, 158, 127],
    ].map(([m, s, w, hr]) => ({
      movingSeconds: s,
      distanceM: m,
      avgSpeedMmS: Math.round((m / s) * 1000),
      avgHr: hr,
      avgWatts: w,
    }));
    expect(isAutoLap(nov1)).toBe(true);
    expect(classifyLaps("bike", nov1).every((k) => k === "steady")).toBe(true);
  });
  it("does not mistake manual reps for auto-lap", () => {
    expect(isAutoLap(nov5)).toBe(false);
  });
  it("detects auto-lap by time", () => {
    expect(
      isAutoLap([lap(300, 140), lap(300, 150), lap(301, 145), lap(120, 130)]),
    ).toBe(true);
  });
});
