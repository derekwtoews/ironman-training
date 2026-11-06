import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import {
  activities,
  activityLoad,
  activityZoneSeconds,
  stravaZones,
  syncEvents,
} from "@/db/schema";
import { LOAD_FORMULA_VERSION, type Zone } from "@/engine";
import { RateLimitError, type StravaClient, StravaHttpError } from "./client";
import {
  deriveLoadZones,
  loadFor,
  mapActivity,
  type StravaActivity,
  type StravaZonesResponse,
} from "./map";

export const BACKFILL_FROM = "2025-01-01";
const PAGE = 100;

type Source = "backfill" | "webhook" | "nightly";

/** Queue activity ids newer than `afterEpoch` that are neither stored nor already queued. */
export async function enqueueSince(
  db: Db,
  client: StravaClient,
  athleteId: number,
  afterEpoch: number,
  source: Source,
): Promise<number> {
  const known = new Set<number>();
  for (const r of await db
    .select({ id: activities.stravaId })
    .from(activities)
    .where(eq(activities.athleteId, athleteId)))
    known.add(r.id);
  for (const r of await db
    .select({ id: syncEvents.stravaObjectId })
    .from(syncEvents)
    .where(
      and(eq(syncEvents.athleteId, athleteId), eq(syncEvents.status, "queued")),
    ))
    if (r.id != null) known.add(r.id);

  let queued = 0;
  for (let page = 1; ; page++) {
    const batch = await client.get<{ id: number }[]>("/athlete/activities", {
      after: afterEpoch,
      per_page: PAGE,
      page,
    });
    const fresh = batch.filter((a) => !known.has(a.id));
    if (fresh.length)
      await db.insert(syncEvents).values(
        fresh.map((a) => ({
          athleteId,
          source,
          stravaObjectId: a.id,
          aspect: "create",
        })),
      );
    queued += fresh.length;
    if (batch.length < PAGE) return queued;
  }
}

export const epoch = (date: string): number =>
  Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);

/** Latest stored HR zones; refreshes from Strava and appends history only when they changed. */
export async function syncHrZones(
  db: Db,
  client: StravaClient,
  athleteId: number,
  today: string,
): Promise<Zone[]> {
  const raw = await client.get<{ heart_rate?: { zones: Zone[] } }>(
    "/athlete/zones",
  );
  const zones = raw.heart_rate?.zones;
  const [latest] = await db
    .select()
    .from(stravaZones)
    .where(
      and(
        eq(stravaZones.athleteId, athleteId),
        eq(stravaZones.kind, "heartrate"),
      ),
    )
    .orderBy(desc(stravaZones.id))
    .limit(1);
  if (zones && JSON.stringify(latest?.zones) !== JSON.stringify(zones)) {
    await db.insert(stravaZones).values({
      athleteId,
      kind: "heartrate",
      effectiveFrom: today,
      zones,
      rawJson: raw,
    });
    return zones;
  }
  if (latest) return latest.zones as Zone[];
  throw new Error("No HR zones available from Strava");
}

async function optional<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof StravaHttpError && [402, 403, 404].includes(e.status))
      return null;
    throw e;
  }
}

/** Store the raw payload and recompute derived caches for one activity. Idempotent. */
export async function ingestActivity(
  db: Db,
  client: StravaClient,
  athleteId: number,
  stravaId: number,
  hrZones: Zone[],
) {
  const raw = await client.get<StravaActivity>(`/activities/${stravaId}`);
  const m = mapActivity(raw);
  const [row] = await db
    .insert(activities)
    .values({ athleteId, ...m, rawJson: raw })
    .onConflictDoUpdate({
      target: [activities.athleteId, activities.stravaId],
      set: { ...m, rawJson: raw },
    })
    .returning({ id: activities.id });

  const zonesRaw =
    m.discipline === "strength"
      ? null
      : await optional(
          client.get<StravaZonesResponse[]>(`/activities/${stravaId}/zones`),
        );
  const derived = deriveLoadZones(m, zonesRaw, hrZones);
  const z = derived?.zoneSeconds;

  await db
    .delete(activityZoneSeconds)
    .where(
      and(
        eq(activityZoneSeconds.activityId, row.id),
        eq(activityZoneSeconds.formulaVersion, LOAD_FORMULA_VERSION),
      ),
    );
  await db
    .delete(activityLoad)
    .where(
      and(
        eq(activityLoad.activityId, row.id),
        eq(activityLoad.formulaVersion, LOAD_FORMULA_VERSION),
      ),
    );
  if (z) {
    await db.insert(activityZoneSeconds).values(
      z.map((seconds, i) => ({
        athleteId,
        activityId: row.id,
        zone: i + 1,
        seconds,
        formulaVersion: LOAD_FORMULA_VERSION,
      })),
    );
    await db.insert(activityLoad).values({
      athleteId,
      activityId: row.id,
      load: loadFor(z),
      estimated: derived?.estimated ?? false,
      formulaVersion: LOAD_FORMULA_VERSION,
    });
  }
}

/** Drain up to `max` queued events, oldest first. Stops cleanly on rate limit. */
export async function processQueue(
  db: Db,
  client: StravaClient,
  athleteId: number,
  today: string,
  max = 40,
) {
  const events = await db
    .select()
    .from(syncEvents)
    .where(
      and(eq(syncEvents.athleteId, athleteId), eq(syncEvents.status, "queued")),
    )
    .orderBy(asc(syncEvents.id))
    .limit(max);
  if (!events.length)
    return { done: 0, errors: 0, rateLimited: false, remaining: 0 };

  const hrZones = await syncHrZones(db, client, athleteId, today);
  let done = 0;
  let errors = 0;
  let rateLimited = false;
  for (const ev of events) {
    try {
      if (ev.stravaObjectId == null) throw new Error("event has no object id");
      if (ev.aspect === "delete") {
        const ids = (
          await db
            .select({ id: activities.id })
            .from(activities)
            .where(
              and(
                eq(activities.athleteId, athleteId),
                eq(activities.stravaId, ev.stravaObjectId),
              ),
            )
        ).map((r) => r.id);
        if (ids.length) {
          await db
            .delete(activityZoneSeconds)
            .where(inArray(activityZoneSeconds.activityId, ids));
          await db
            .delete(activityLoad)
            .where(inArray(activityLoad.activityId, ids));
          await db.delete(activities).where(inArray(activities.id, ids));
        }
      } else {
        await ingestActivity(db, client, athleteId, ev.stravaObjectId, hrZones);
      }
      await db
        .update(syncEvents)
        .set({ status: "done", processedAt: new Date() })
        .where(eq(syncEvents.id, ev.id));
      done++;
    } catch (e) {
      if (e instanceof RateLimitError) {
        rateLimited = true;
        break;
      }
      errors++;
      await db
        .update(syncEvents)
        .set({ status: "error", error: String(e), processedAt: new Date() })
        .where(eq(syncEvents.id, ev.id));
    }
  }
  return {
    done,
    errors,
    rateLimited,
    remaining: events.length - done - errors,
  };
}
