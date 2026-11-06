import { describe, expect, it } from "vitest";
import {
  loadFromZoneSeconds,
  scaleZoneSeconds,
  singleZoneSeconds,
  strengthZoneSeconds,
  zoneForHr,
} from "./load";
import type { Zone } from "./types";

// Strava-style HR zones: [min, max), last max = -1.
const HR: Zone[] = [
  { min: 0, max: 123 },
  { min: 123, max: 154 },
  { min: 154, max: 169 },
  { min: 169, max: 184 },
  { min: 184, max: -1 },
];

describe("loadFromZoneSeconds", () => {
  it("weights minutes 1..5", () => {
    // 30*1 + 40*2 + 10*3 = 140
    expect(loadFromZoneSeconds([1800, 2400, 600, 0, 0])).toBe(140);
    // 60*2 + 20*3 + 10*4 = 220
    expect(loadFromZoneSeconds([0, 3600, 1200, 600, 0])).toBe(220);
  });
  it("rounds to an integer (1.5 -> 2)", () => {
    expect(loadFromZoneSeconds([90, 0, 0, 0, 0])).toBe(2);
  });
  it("supports custom weights", () => {
    expect(loadFromZoneSeconds([600, 0, 0, 0, 600], [1, 1, 1, 1, 10])).toBe(
      110,
    );
  });
});

describe("strength rule", () => {
  it("zoneForHr uses [min, max) boundaries", () => {
    expect(zoneForHr(122, HR)).toBe(1);
    expect(zoneForHr(123, HR)).toBe(2);
    expect(zoneForHr(200, HR)).toBe(5);
    expect(zoneForHr(50, HR)).toBe(1);
  });
  it("puts all moving seconds in the avg-HR zone", () => {
    expect(strengthZoneSeconds(1500, 118, HR)).toEqual([1500, 0, 0, 0, 0]);
    expect(strengthZoneSeconds(1800, 140, HR)).toEqual([0, 1800, 0, 0, 0]);
    // 25 min in z1 = 25; 30 min in z2 = 60
    expect(loadFromZoneSeconds(strengthZoneSeconds(1500, 118, HR))).toBe(25);
    expect(loadFromZoneSeconds(strengthZoneSeconds(1800, 140, HR))).toBe(60);
  });
});

describe("scaleZoneSeconds", () => {
  it("trims a 3 h 5 m strength session to 1 h (Oct 19), all Z1: load 186 -> 60", () => {
    const recorded = singleZoneSeconds(11130, 1);
    expect(loadFromZoneSeconds(recorded)).toBe(186);
    const fixed = scaleZoneSeconds(recorded, 11130, 3600);
    expect(fixed).toEqual([3600, 0, 0, 0, 0]);
    expect(loadFromZoneSeconds(fixed)).toBe(60);
  });
  it("keeps the zone mix and rounds to whole seconds", () => {
    expect(scaleZoneSeconds([100, 200, 0, 0, 0], 300, 150)).toEqual([
      50, 100, 0, 0, 0,
    ]);
    expect(scaleZoneSeconds([1, 1, 1, 0, 0], 3, 2)).toEqual([1, 1, 1, 0, 0]);
  });
  it("is a no-op for the same duration", () => {
    const z: [number, number, number, number, number] = [10, 20, 30, 0, 0];
    expect(scaleZoneSeconds(z, 60, 60)).toBe(z);
  });
});
