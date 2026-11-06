import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  activities,
  activityLaps,
  activityLoad,
  activityOverrides,
  activityZoneSeconds,
  bodyWeight,
} from "@/db/schema";
import {
  addDays,
  type Discipline,
  LAP_FORMULA_VERSION,
  type LapKind,
  LOAD_FORMULA_VERSION,
  type RepSummary,
  summarizeReps,
  type ZoneSeconds,
} from "@/engine";
import { HISTORY_START } from "@/lib/history";

export const SPORT_FILTERS = [
  "swim",
  "bike",
  "run",
  "row",
  "strength",
  "other",
] as const;
export type SportFilter = (typeof SPORT_FILTERS)[number];

export interface WorkoutRow {
  id: number;
  stravaId: number;
  localDate: string;
  startUtc: Date;
  discipline: Discipline;
  sportType: string;
  name: string;
  recordedSeconds: number;
  movingSeconds: number; // effective
  distanceM: number;
  avgHr: number | null;
  avgWatts: number | null;
  isTrainer: boolean;
  load: number | null;
  estimated: boolean;
  corrected: boolean;
  excluded: boolean;
  zones: ZoneSeconds | null;
}

const selectRow = {
  id: activities.id,
  stravaId: activities.stravaId,
  localDate: activities.localDate,
  startUtc: activities.startUtc,
  discipline: activities.discipline,
  sportType: activities.sportType,
  name: activities.name,
  recordedSeconds: activities.movingSeconds,
  movingSeconds: sql<number>`coalesce(${activityOverrides.movingSeconds}, ${activities.movingSeconds})`,
  distanceM: activities.distanceM,
  avgHr: activities.avgHr,
  avgWatts: activities.avgWatts,
  isTrainer: activities.isTrainer,
  load: activityLoad.load,
  estimated: sql<boolean>`coalesce(${activityLoad.estimated}, false)`,
  corrected: sql<boolean>`${activityOverrides.movingSeconds} is not null`,
  excluded: sql<boolean>`coalesce(${activityOverrides.excludeFromLoad}, false)`,
};

async function zonesFor(
  db: Db,
  ids: number[],
): Promise<Map<number, ZoneSeconds>> {
  const out = new Map<number, ZoneSeconds>();
  if (!ids.length) return out;
  const rows = await db
    .select()
    .from(activityZoneSeconds)
    .where(
      and(
        inArray(activityZoneSeconds.activityId, ids),
        eq(activityZoneSeconds.formulaVersion, LOAD_FORMULA_VERSION),
      ),
    );
  for (const r of rows) {
    const z = (out.get(r.activityId) ?? [0, 0, 0, 0, 0]) as unknown as number[];
    z[r.zone - 1] = r.seconds;
    out.set(r.activityId, z as unknown as ZoneSeconds);
  }
  return out;
}

const base = (athleteId: number) =>
  and(
    eq(activities.athleteId, athleteId),
    gte(activities.localDate, HISTORY_START),
  );

/** Newest first, optionally one sport, paged. */
export async function listWorkouts(
  db: Db,
  athleteId: number,
  opts: { sport?: SportFilter; limit: number; offset: number },
) {
  const where = opts.sport
    ? and(base(athleteId), eq(activities.discipline, opts.sport))
    : base(athleteId);
  const rows = (await db
    .select(selectRow)
    .from(activities)
    .leftJoin(
      activityOverrides,
      eq(activityOverrides.activityId, activities.id),
    )
    .leftJoin(
      activityLoad,
      and(
        eq(activityLoad.activityId, activities.id),
        eq(activityLoad.formulaVersion, LOAD_FORMULA_VERSION),
      ),
    )
    .where(where)
    .orderBy(desc(activities.startUtc))
    .limit(opts.limit + 1)
    .offset(opts.offset)) as Omit<WorkoutRow, "zones">[];
  const page = rows.slice(0, opts.limit);
  const zones = await zonesFor(
    db,
    page.map((r) => r.id),
  );
  return {
    rows: page.map((r) => ({
      ...r,
      zones: zones.get(r.id) ?? null,
    })) as WorkoutRow[],
    hasMore: rows.length > opts.limit,
  };
}

/** Last 28 days, for the summary cards. */
export async function summary28(db: Db, athleteId: number, today: string) {
  const from = addDays(today, -27);
  const rows = (await db
    .select(selectRow)
    .from(activities)
    .leftJoin(
      activityOverrides,
      eq(activityOverrides.activityId, activities.id),
    )
    .leftJoin(
      activityLoad,
      and(
        eq(activityLoad.activityId, activities.id),
        eq(activityLoad.formulaVersion, LOAD_FORMULA_VERSION),
      ),
    )
    .where(
      and(
        base(athleteId),
        gte(activities.localDate, from),
        lte(activities.localDate, today),
      ),
    )) as Omit<WorkoutRow, "zones">[];
  return {
    count: rows.length,
    seconds: rows.reduce((s, r) => s + r.movingSeconds, 0),
    load: rows.reduce((s, r) => s + (r.load ?? 0), 0),
    noLoad: rows.filter((r) => r.load == null).map((r) => r.name),
    estimated: rows.filter((r) => r.estimated).length,
  };
}

export interface LapRow {
  lapIndex: number;
  kind: LapKind;
  movingSeconds: number;
  elapsedSeconds: number;
  distanceM: number;
  avgSpeedMmS: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgWatts: number | null;
  avgCadence: number | null;
}

export async function workoutDetail(db: Db, athleteId: number, id: number) {
  const [row] = (await db
    .select({ ...selectRow, note: activityOverrides.note })
    .from(activities)
    .leftJoin(
      activityOverrides,
      eq(activityOverrides.activityId, activities.id),
    )
    .leftJoin(
      activityLoad,
      and(
        eq(activityLoad.activityId, activities.id),
        eq(activityLoad.formulaVersion, LOAD_FORMULA_VERSION),
      ),
    )
    .where(
      and(eq(activities.athleteId, athleteId), eq(activities.id, id)),
    )) as (Omit<WorkoutRow, "zones"> & { note: string | null })[];
  if (!row) return null;
  const zones = (await zonesFor(db, [id])).get(id) ?? null;
  const laps = (await db
    .select({
      lapIndex: activityLaps.lapIndex,
      kind: activityLaps.kind,
      movingSeconds: activityLaps.movingSeconds,
      elapsedSeconds: activityLaps.elapsedSeconds,
      distanceM: activityLaps.distanceM,
      avgSpeedMmS: activityLaps.avgSpeedMmS,
      avgHr: activityLaps.avgHr,
      maxHr: activityLaps.maxHr,
      avgWatts: activityLaps.avgWatts,
      avgCadence: activityLaps.avgCadence,
    })
    .from(activityLaps)
    .where(
      and(
        eq(activityLaps.activityId, id),
        eq(activityLaps.formulaVersion, LAP_FORMULA_VERSION),
      ),
    )
    .orderBy(activityLaps.lapIndex)) as LapRow[];
  const reps: RepSummary | null = laps.some((l) => l.kind === "work")
    ? summarizeReps(
        row.discipline,
        laps,
        laps.map((l) => l.kind),
      )
    : null;
  return { ...row, zones, laps, reps };
}

export async function recentWeights(db: Db, athleteId: number, limit = 6) {
  return db
    .select({
      date: bodyWeight.date,
      grams: bodyWeight.grams,
      source: bodyWeight.source,
    })
    .from(bodyWeight)
    .where(eq(bodyWeight.athleteId, athleteId))
    .orderBy(desc(bodyWeight.date), desc(bodyWeight.createdAt))
    .limit(limit);
}

export async function countWorkouts(db: Db, athleteId: number) {
  const [c] = await db
    .select({ n: count() })
    .from(activities)
    .where(base(athleteId));
  return c.n;
}
