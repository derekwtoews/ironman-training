import type { Zone, ZoneSeconds } from "./types";

/** Bump when weights or rules change; derived caches are tagged with it and recomputed. */
export const LOAD_FORMULA_VERSION = 1;

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
