import { desc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { activities, athlete } from "@/db/schema";
import { addDays } from "@/engine";
import { env } from "@/lib/env";
import { StravaClient } from "@/lib/strava/client";
import {
  BACKFILL_FROM,
  enqueueSince,
  epoch,
  processQueue,
} from "@/lib/strava/sync";
import { snapshotStravaWeight } from "@/lib/weight";

export const maxDuration = 60;

// Daily: DB keepalive (Supabase pause), catch-up for missed webhooks, drain one paced batch.
// Also callable manually (Authorization: Bearer <CRON_SECRET>) to keep draining a backfill.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${env().CRON_SECRET}`)
    return new Response("Forbidden", { status: 403 });
  const db = getDb();
  await db.execute(sql`select 1`);
  const [a] = await db.select({ id: athlete.id }).from(athlete).limit(1);
  if (!a) return Response.json({ ok: true, note: "no athlete connected" });

  const client = new StravaClient(db, a.id);
  const today = new Date().toISOString().slice(0, 10);
  const [last] = await db
    .select({ d: activities.localDate })
    .from(activities)
    .where(eq(activities.athleteId, a.id))
    .orderBy(desc(activities.localDate))
    .limit(1);
  const since = last ? addDays(last.d, -7) : BACKFILL_FROM;
  const queued = await enqueueSince(db, client, a.id, epoch(since), "nightly");
  const profile = await client.get<{ weight?: number }>("/athlete");
  const weightSaved = await snapshotStravaWeight(
    db,
    a.id,
    profile.weight,
    today,
  );
  const result = await processQueue(db, client, a.id, today, 40);
  return Response.json({ ok: true, queued, weightSaved, ...result });
}
