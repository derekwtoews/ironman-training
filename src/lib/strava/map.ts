import type { Discipline, Zone, ZoneSeconds } from "@/engine";
import {
  type EffortLevel,
  estimateSwimZoneSeconds,
  loadFromZoneSeconds,
  strengthZoneSeconds,
} from "@/engine";

// Pure mapping from Strava payloads to our rows. No network, no db.

export interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  start_date_local: string; // local wall-clock time, labelled Z by Strava
  moving_time: number;
  elapsed_time: number;
  distance?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  trainer?: boolean;
  start_latlng?: number[] | null;
}

const BIKE = new Set([
  "Ride",
  "VirtualRide",
  "EBikeRide",
  "GravelRide",
  "MountainBikeRide",
  "EMountainBikeRide",
  "Handcycle",
]);
const RUN = new Set(["Run", "VirtualRun", "TrailRun"]);
const ROW = new Set(["Rowing", "VirtualRow"]);
const STRENGTH = new Set([
  "WeightTraining",
  "Workout",
  "Crossfit",
  "HighIntensityIntervalTraining",
]);

export function disciplineFor(sportType: string): Discipline {
  if (sportType === "Swim") return "swim";
  if (BIKE.has(sportType)) return "bike";
  if (RUN.has(sportType)) return "run";
  if (ROW.has(sportType)) return "row";
  if (STRENGTH.has(sportType)) return "strength";
  return "other";
}

const round = (n: number | undefined): number | null =>
  n == null ? null : Math.round(n);

export function mapActivity(raw: StravaActivity) {
  const sportType = raw.sport_type ?? raw.type ?? "Unknown";
  const discipline = disciplineFor(sportType);
  // Pool swims have no GPS start point; indoor rides/runs carry Strava's trainer flag.
  const isTrainer =
    discipline === "swim" ? !raw.start_latlng?.length : Boolean(raw.trainer);
  return {
    stravaId: raw.id,
    discipline,
    sportType,
    name: raw.name,
    startUtc: new Date(raw.start_date),
    localDate: raw.start_date_local.slice(0, 10),
    movingSeconds: Math.round(raw.moving_time),
    elapsedSeconds: Math.round(raw.elapsed_time),
    distanceM: Math.round(raw.distance ?? 0),
    avgHr: round(raw.average_heartrate),
    maxHr: round(raw.max_heartrate),
    avgWatts: round(raw.average_watts),
    isTrainer,
  };
}

/** Strava /activities/{id}/zones response (only the heartrate entry is used). */
export interface StravaZonesResponse {
  type: string;
  distribution_buckets: { min: number; max: number; time: number }[];
}

/** Seconds in zones 1..5 from Strava's heartrate distribution; null if absent. */
export function zoneSecondsFromStrava(
  zones: StravaZonesResponse[],
): ZoneSeconds | null {
  const hr = zones.find((z) => z.type === "heartrate");
  if (!hr || hr.distribution_buckets.length !== 5) return null;
  return hr.distribution_buckets.map((b) =>
    Math.round(b.time),
  ) as unknown as ZoneSeconds;
}

/**
 * Zone seconds for an activity: strength uses the avg-HR rule; others use Strava's
 * distribution. Returns null when neither is available (no HR data).
 */
export function deriveZoneSeconds(
  a: { discipline: Discipline; movingSeconds: number; avgHr: number | null },
  stravaZones: StravaZonesResponse[] | null,
  hrZones: readonly Zone[],
): ZoneSeconds | null {
  if (a.discipline === "strength") {
    return a.avgHr == null
      ? null
      : strengthZoneSeconds(a.movingSeconds, a.avgHr, hrZones);
  }
  return stravaZones ? zoneSecondsFromStrava(stravaZones) : null;
}

export const loadFor = (z: ZoneSeconds): number => loadFromZoneSeconds(z);

/**
 * Like deriveZoneSeconds, but swims with no heart rate get an estimate from their intended
 * effort (easy = Z2, threshold = Z3; default easy). `estimated` is stored so the UI can say so.
 */
export function deriveLoadZones(
  a: { discipline: Discipline; movingSeconds: number; avgHr: number | null },
  stravaZones: StravaZonesResponse[] | null,
  hrZones: readonly Zone[],
  effort?: EffortLevel,
): { zoneSeconds: ZoneSeconds; estimated: boolean } | null {
  const z = deriveZoneSeconds(a, stravaZones, hrZones);
  if (z) return { zoneSeconds: z, estimated: false };
  if (a.discipline === "swim")
    return {
      zoneSeconds: estimateSwimZoneSeconds(a.movingSeconds, effort),
      estimated: true,
    };
  return null;
}
