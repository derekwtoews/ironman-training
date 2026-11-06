import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { athlete } from "@/db/schema";
import { env } from "@/lib/env";
import { exchangeCode, StravaClient, saveTokens } from "@/lib/strava/client";
import { BACKFILL_FROM, enqueueSince, epoch } from "@/lib/strava/sync";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("error"))
    return new Response(`Strava denied access: ${p.get("error")}`, {
      status: 400,
    });
  const code = p.get("code");
  if (
    !code ||
    !p.get("state") ||
    p.get("state") !== req.cookies.get("strava_state")?.value
  ) {
    return new Response("Bad OAuth state", { status: 400 });
  }
  const t = await exchangeCode(code);
  if (!t.athlete)
    return new Response("No athlete in token response", { status: 502 });

  const db = getDb();
  const name =
    [t.athlete.firstname, t.athlete.lastname].filter(Boolean).join(" ") ||
    "Derek";
  const [row] = await db
    .insert(athlete)
    .values({ name, stravaAthleteId: t.athlete.id })
    .onConflictDoUpdate({ target: athlete.stravaAthleteId, set: { name } })
    .returning({ id: athlete.id });
  await saveTokens(db, row.id, t);
  // Queue the backfill; it is drained in paced batches by processQueue (cron or manual).
  const queued = await enqueueSince(
    db,
    new StravaClient(db, row.id),
    row.id,
    epoch(BACKFILL_FROM),
    "backfill",
  );
  const res = NextResponse.json({
    connected: true,
    athleteId: row.id,
    queued,
    appUrl: env().APP_URL,
  });
  res.cookies.delete("strava_state");
  return res;
}
