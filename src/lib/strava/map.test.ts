import { describe, expect, it } from "vitest";
import {
  deriveZoneSeconds,
  disciplineFor,
  mapActivity,
  zoneSecondsFromStrava,
} from "./map";

const base = {
  id: 1,
  name: "x",
  start_date: "2026-10-13T11:00:00Z",
  start_date_local: "2026-10-13T07:00:00Z",
  moving_time: 3600.4,
  elapsed_time: 3700,
};
const HR = [
  { min: 0, max: 123 },
  { min: 123, max: 154 },
  { min: 154, max: 169 },
  { min: 169, max: 184 },
  { min: 184, max: -1 },
];
const dist = (t: number[]) => ({
  type: "heartrate",
  distribution_buckets: t.map((time, i) => ({ min: i, max: i + 1, time })),
});

describe("strava mapping", () => {
  it("maps sport types", () => {
    expect(disciplineFor("VirtualRide")).toBe("bike");
    expect(disciplineFor("WeightTraining")).toBe("strength");
    expect(disciplineFor("Yoga")).toBe("other");
  });
  it("uses local date and integer units", () => {
    const m = mapActivity({
      ...base,
      sport_type: "Run",
      distance: 9300.7,
      average_heartrate: 151.6,
    });
    expect(m.localDate).toBe("2026-10-13");
    expect(m.movingSeconds).toBe(3600);
    expect(m.distanceM).toBe(9301);
    expect(m.avgHr).toBe(152);
    expect(m.isTrainer).toBe(false);
  });
  it("flags pool swims (no GPS) and trainer rides", () => {
    expect(
      mapActivity({ ...base, sport_type: "Swim", start_latlng: [] }).isTrainer,
    ).toBe(true);
    expect(
      mapActivity({ ...base, sport_type: "Swim", start_latlng: [45, -75] })
        .isTrainer,
    ).toBe(false);
    expect(
      mapActivity({ ...base, sport_type: "Ride", trainer: true }).isTrainer,
    ).toBe(true);
  });
  it("reads zone distribution, rejects malformed", () => {
    expect(zoneSecondsFromStrava([dist([1800, 2400, 600, 0, 0])])).toEqual([
      1800, 2400, 600, 0, 0,
    ]);
    expect(zoneSecondsFromStrava([dist([1, 2])])).toBeNull();
    expect(zoneSecondsFromStrava([])).toBeNull();
  });
  it("strength uses avg HR; others use Strava distribution", () => {
    expect(
      deriveZoneSeconds(
        { discipline: "strength", movingSeconds: 1500, avgHr: 118 },
        null,
        HR,
      ),
    ).toEqual([1500, 0, 0, 0, 0]);
    expect(
      deriveZoneSeconds(
        { discipline: "strength", movingSeconds: 1500, avgHr: null },
        null,
        HR,
      ),
    ).toBeNull();
    expect(
      deriveZoneSeconds(
        { discipline: "bike", movingSeconds: 4800, avgHr: 140 },
        [dist([1800, 2400, 600, 0, 0])],
        HR,
      ),
    ).toEqual([1800, 2400, 600, 0, 0]);
    expect(
      deriveZoneSeconds(
        { discipline: "run", movingSeconds: 600, avgHr: null },
        null,
        HR,
      ),
    ).toBeNull();
  });
});
