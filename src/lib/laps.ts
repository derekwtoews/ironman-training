import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { activities, activityLaps } from "@/db/schema";
import {
  classifyLaps,
  type Discipline,
  LAP_FORMULA_VERSION,
  type LapInput,
} from "@/engine";

/** Strava DetailedActivity lap, as stored in activities.raw_json.laps. */
export interface StravaLap {
  elapsed_time: number;
  moving_time: number;
  distance: number;
  average_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  average_watts?: number;
  total_elevation_gain?: number;
}

const int = (n: number | undefined): number | null =>
  n == null ? null : Math.round(n);

/** Pure: Strava laps to integer lap inputs. */
export function mapLaps(raw: StravaLap[] | undefined): (LapInput & {
  elapsedSeconds: number;
  maxHr: number | null;
  avgCadence: number | null;
  elevationGainM: number | null;
})[] {
  return (raw ?? []).map((l) => ({
    elapsedSeconds: Math.round(l.elapsed_time),
    movingSeconds: Math.round(l.moving_time),
    distanceM: Math.round(l.distance ?? 0),
    avgSpeedMmS:
      l.average_speed == null ? null : Math.round(l.average_speed * 1000),
    avgHr: int(l.average_heartrate),
    maxHr: int(l.max_heartrate),
    avgCadence: int(l.average_cadence),
    avgWatts: int(l.average_watts),
    elevationGainM: int(l.total_elevation_gain),
  }));
}

/** Rebuild one activity's lap rows from its stored raw payload. Idempotent, no Strava calls. */
export async function writeLaps(
  db: Db,
  athleteId: number,
  activityId: number,
  discipline: Discipline,
  rawLaps: StravaLap[] | undefined,
) {
  const laps = mapLaps(rawLaps);
  await db
    .delete(activityLaps)
    .where(
      and(
        eq(activityLaps.activityId, activityId),
        eq(activityLaps.formulaVersion, LAP_FORMULA_VERSION),
      ),
    );
  if (!laps.length) return 0;
  const kinds = classifyLaps(discipline, laps);
  await db.insert(activityLaps).values(
    laps.map((l, i) => ({
      athleteId,
      activityId,
      lapIndex: i,
      ...l,
      kind: kinds[i],
      formulaVersion: LAP_FORMULA_VERSION,
    })),
  );
  return laps.length;
}

/** Rebuild laps for every stored activity (after a formula bump or on first rollout). */
export async function rebuildAllLaps(db: Db, athleteId: number) {
  const rows = await db
    .select({
      id: activities.id,
      discipline: activities.discipline,
      raw: activities.rawJson,
    })
    .from(activities)
    .where(eq(activities.athleteId, athleteId));
  let n = 0;
  for (const r of rows)
    n += await writeLaps(
      db,
      athleteId,
      r.id,
      r.discipline as Discipline,
      (r.raw as { laps?: StravaLap[] }).laps,
    );
  return { activities: rows.length, laps: n };
}
