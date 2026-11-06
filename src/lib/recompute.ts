import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { activities, activityLoad, activityZoneSeconds } from "@/db/schema";
import {
  estimateSwimZoneSeconds,
  LOAD_FORMULA_VERSION,
  loadFromZoneSeconds,
  type ZoneSeconds,
} from "@/engine";

/**
 * Bring stored loads up to LOAD_FORMULA_VERSION without calling Strava. Activities with HR zone
 * rows from an older version keep those zones (their math did not change); swims with no HR get
 * an estimate. Idempotent.
 */
export async function recomputeLoads(
  db: Db,
  athleteId: number,
): Promise<{ copied: number; estimated: number }> {
  const acts = await db
    .select()
    .from(activities)
    .where(eq(activities.athleteId, athleteId));
  const have = new Set(
    (
      await db
        .select({ id: activityLoad.activityId })
        .from(activityLoad)
        .where(
          and(
            eq(activityLoad.athleteId, athleteId),
            eq(activityLoad.formulaVersion, LOAD_FORMULA_VERSION),
          ),
        )
    ).map((r) => r.id),
  );
  const todo = acts.filter((a) => !have.has(a.id));
  if (!todo.length) return { copied: 0, estimated: 0 };

  const old = await db
    .select()
    .from(activityZoneSeconds)
    .where(
      inArray(
        activityZoneSeconds.activityId,
        todo.map((a) => a.id),
      ),
    );
  const byAct = new Map<number, ZoneSeconds>();
  const latest = new Map<number, number>();
  for (const r of old) {
    if (r.formulaVersion < (latest.get(r.activityId) ?? 0)) continue;
    if (r.formulaVersion > (latest.get(r.activityId) ?? 0))
      byAct.delete(r.activityId);
    latest.set(r.activityId, r.formulaVersion);
    const z =
      byAct.get(r.activityId) ?? ([0, 0, 0, 0, 0] as unknown as number[]);
    (z as number[])[r.zone - 1] = r.seconds;
    byAct.set(r.activityId, z as unknown as ZoneSeconds);
  }

  let copied = 0;
  let estimated = 0;
  for (const a of todo) {
    let z = byAct.get(a.id);
    let est = false;
    if (!z && a.discipline === "swim") {
      z = estimateSwimZoneSeconds(a.movingSeconds);
      est = true;
    }
    if (!z) continue;
    await db
      .delete(activityZoneSeconds)
      .where(
        and(
          eq(activityZoneSeconds.activityId, a.id),
          eq(activityZoneSeconds.formulaVersion, LOAD_FORMULA_VERSION),
        ),
      );
    await db.insert(activityZoneSeconds).values(
      z.map((seconds, i) => ({
        athleteId,
        activityId: a.id,
        zone: i + 1,
        seconds,
        formulaVersion: LOAD_FORMULA_VERSION,
      })),
    );
    await db.insert(activityLoad).values({
      athleteId,
      activityId: a.id,
      load: loadFromZoneSeconds(z),
      estimated: est,
      formulaVersion: LOAD_FORMULA_VERSION,
    });
    est ? estimated++ : copied++;
  }
  return { copied, estimated };
}
