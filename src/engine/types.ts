export type Discipline = "swim" | "bike" | "run" | "strength" | "other";

/** Strava zone as returned by the API; the last zone has max = -1 (open-ended). */
export interface Zone {
  min: number;
  max: number;
}

/** Seconds in zones 1..5, index 0 = zone 1. */
export type ZoneSeconds = readonly [number, number, number, number, number];

export interface ActivityLoadInput {
  localDate: string; // YYYY-MM-DD
  discipline: Discipline;
  movingSeconds: number;
  distanceM: number;
  load: number; // integer, from loadFromZoneSeconds
}
