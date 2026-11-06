import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { athlete, syncEvents } from "@/db/schema";
import { env } from "@/lib/env";

// Subscription handshake: Strava sends GET with hub.* params.
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    p.get("hub.verify_token") === env().STRAVA_WEBHOOK_VERIFY_TOKEN
  ) {
    return Response.json({ "hub.challenge": p.get("hub.challenge") });
  }
  return new Response("Forbidden", { status: 403 });
}

const event = z.object({
  object_type: z.string(),
  object_id: z.number(),
  aspect_type: z.enum(["create", "update", "delete"]),
  owner_id: z.number(),
});

// Only enqueue; processing happens in the queue so we answer within Strava's 2s limit.
export async function POST(req: NextRequest) {
  const parsed = event.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("ok");
  const e = parsed.data;
  if (e.object_type !== "activity") return new Response("ok");
  const db = getDb();
  const [a] = await db
    .select({ id: athlete.id })
    .from(athlete)
    .where(eq(athlete.stravaAthleteId, e.owner_id));
  if (a) {
    await db.insert(syncEvents).values({
      athleteId: a.id,
      source: "webhook",
      stravaObjectId: e.object_id,
      aspect: e.aspect_type,
      payload: e,
    });
  }
  return new Response("ok");
}
