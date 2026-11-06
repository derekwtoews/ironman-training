import type { Zone, ZoneSeconds } from "./types";

/** Bump when weights or rules change; derived caches are tagged with it and recomputed. */
export const LOAD_FORMULA_VERSION = 2; // v2: estimated load for swims without heart rate

export type ZoneWeights = readonly [number, number, number, number, number];
export const DEFAULT_ZONE_WEIGHTS: ZoneWeights = [1, 2, 3, 4, 5];

/** Load = sum(minutes in zone * weight), rounded to an integer. */
export function loadFromZoneSeconds(
  zoneSeconds: ZoneSeconds,
  weights: ZoneWeights = DEFAULT_ZONE_WEIGHTS,
): number {
  let weighted = 0;
  for (let i = 0; i < 5; i++) weighted += zoneSeconds[i] * weights[i];
  return Math.round(weighted / 60);
}

/**
 * Zone (1..5) containing `hr`. A zone covers [min, max); max = -1 means open-ended.
 * Below the first zone's min clamps to 1.
 */
export function zoneForHr(hr: number, zones: readonly Zone[]): number {
  for (let i = 0; i < zones.length; i++) {
    const { min, max } = zones[i];
    if (hr >= min && (max === -1 || hr < max)) return i + 1;
  }
  return hr < zones[0].min ? 1 : zones.length;
}

/** Strength rule: average HR picks one zone and all moving seconds go in it. */
export function strengthZoneSeconds(
  movingSeconds: number,
  avgHr: number,
  zones: readonly Zone[],
): ZoneSeconds {
  const out = [0, 0, 0, 0, 0];
  out[zoneForHr(avgHr, zones) - 1] = movingSeconds;
  return out as unknown as ZoneSeconds;
}

/** All moving seconds in one zone (1..5). Used for strength and for estimates. */
export function singleZoneSeconds(
  movingSeconds: number,
  zone: number,
): ZoneSeconds {
  const out = [0, 0, 0, 0, 0];
  out[Math.min(5, Math.max(1, zone)) - 1] = movingSeconds;
  return out as unknown as ZoneSeconds;
}

/** Intended effort of a no-HR session -> zone to count it in. Tunable setting. */
export type EffortLevel = "easy" | "threshold";
export const SWIM_EFFORT_ZONE: Record<EffortLevel, number> = {
  easy: 2,
  threshold: 3,
};
export const DEFAULT_SWIM_EFFORT: EffortLevel = "easy";

/** Estimated zone seconds for a swim with no heart rate, from its intended effort. */
export function estimateSwimZoneSeconds(
  movingSeconds: number,
  effort: EffortLevel = DEFAULT_SWIM_EFFORT,
  map: Record<EffortLevel, number> = SWIM_EFFORT_ZONE,
): ZoneSeconds {
  return singleZoneSeconds(movingSeconds, map[effort]);
}
