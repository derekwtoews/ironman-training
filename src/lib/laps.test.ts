import { describe, expect, it } from "vitest";
import { mapLaps } from "./laps";

describe("mapLaps", () => {
  it("converts Strava laps to integer units", () => {
    const [l] = mapLaps([
      {
        elapsed_time: 612,
        moving_time: 612,
        distance: 1787.72,
        average_speed: 2.921111,
        average_heartrate: 159.987,
        max_heartrate: 165,
        average_cadence: 85.76,
        total_elevation_gain: 0,
      },
    ]);
    expect(l).toEqual({
      elapsedSeconds: 612,
      movingSeconds: 612,
      distanceM: 1788,
      avgSpeedMmS: 2921,
      avgHr: 160,
      maxHr: 165,
      avgCadence: 86,
      avgWatts: null,
      elevationGainM: 0,
    });
  });
  it("handles missing laps", () => {
    expect(mapLaps(undefined)).toEqual([]);
  });
});
