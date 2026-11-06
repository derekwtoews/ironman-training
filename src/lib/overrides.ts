import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import {
  activities,
  activityLoad,
  activityOverrides,
  activityZoneSeconds,
} from "@/db/schema";
import {
  LOAD_FORMULA_VERSION,
  loadFromZoneSeconds,
  scaleZoneSeconds,
  type ZoneSeconds,
} from "@/engine";

export const overrideInput = z.object({
  movingSeconds: z.number().int().min(60).max(86_400).nullable().optional(),
  excludeFromLoad: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

/**
 * Recompute one activity's load from its stored zone seconds, honoring any override.
 * Zone rows always stay as recorded; the override is applied here. No Strava calls.
 */
export async function refreshActivityLoad(
  db: Db,
  athleteId: number,
  activityId: number,
) {
  const [a] = await db
    .select()
    .from(activities)
    .where(
      and(eq(activities.id, activityId), eq(activities.athleteId, athleteId)),
    );
  if (!a) return null;
  const [o] = await db
    .select()
    .from(activityOverrides)
    .where(eq(activityOverrides.activityId, activityId));
  const rows = await db
    .select()
    .from(activityZoneSeconds)
    .where(
      and(
        eq(activityZoneSeconds.activityId, activityId),
        eq(activityZoneSeconds.formulaVersion, LOAD_FORMULA_VERSION),
      ),
    );
  if (!rows.length) return null;

  const zones = [0, 0, 0, 0, 0] as number[];
  for (const r of rows) zones[r.zone - 1] = r.seconds;
  let z = zones as unknown as ZoneSeconds;
  if (o?.movingSeconds)
    z = scaleZoneSeconds(z, a.movingSeconds, o.movingSeconds);
  const load = o?.excludeFromLoad ? 0 : loadFromZoneSeconds(z);

  const [prev] = await db
    .select({ estimated: activityLoad.estimated })
    .from(activityLoad)
    .where(
      and(
        eq(activityLoad.activityId, activityId),
        eq(activityLoad.formulaVersion, LOAD_FORMULA_VERSION),
      ),
    );
  await db
    .delete(activityLoad)
    .where(
      and(
        eq(activityLoad.activityId, activityId),
        eq(activityLoad.formulaVersion, LOAD_FORMULA_VERSION),
      ),
    );
  await db.insert(activityLoad).values({
    athleteId,
    activityId,
    load,
    estimated: prev?.estimated ?? false,
    formulaVersion: LOAD_FORMULA_VERSION,
  });
  return load;
}

/** Save a correction (or clear it by passing movingSeconds: null and excludeFromLoad: false). */
export async function setActivityOverride(
  db: Db,
  athleteId: number,
  activityId: number,
  input: z.infer<typeof overrideInput>,
) {
  const v = overrideInput.parse(input);
  const set = {
    movingSeconds: v.movingSeconds ?? null,
    excludeFromLoad: v.excludeFromLoad ?? false,
    note: v.note ?? null,
    updatedAt: new Date(),
  };
  await db
    .insert(activityOverrides)
    .values({ athleteId, activityId, ...set })
    .onConflictDoUpdate({ target: activityOverrides.activityId, set });
  return refreshActivityLoad(db, athleteId, activityId);
}
