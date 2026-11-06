import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { bodyWeight } from "@/db/schema";

export const weightInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kg: z.number().min(30).max(200),
});

/** Manual weigh-in; re-entering the same day replaces it. */
export async function logWeight(
  db: Db,
  athleteId: number,
  input: z.infer<typeof weightInput>,
) {
  const { date, kg } = weightInput.parse(input);
  const grams = Math.round(kg * 1000);
  await db
    .insert(bodyWeight)
    .values({ athleteId, date, grams, source: "manual" })
    .onConflictDoUpdate({
      target: [bodyWeight.athleteId, bodyWeight.date, bodyWeight.source],
      set: { grams },
    });
}

/** Save Strava's profile weight with today's date, only when it changed. */
export async function snapshotStravaWeight(
  db: Db,
  athleteId: number,
  kg: number | null | undefined,
  today: string,
) {
  if (!kg) return false;
  const grams = Math.round(kg * 1000);
  const [last] = await db
    .select({ grams: bodyWeight.grams })
    .from(bodyWeight)
    .where(
      and(eq(bodyWeight.athleteId, athleteId), eq(bodyWeight.source, "strava")),
    )
    .orderBy(desc(bodyWeight.date))
    .limit(1);
  if (last?.grams === grams) return false;
  await db
    .insert(bodyWeight)
    .values({ athleteId, date: today, grams, source: "strava" })
    .onConflictDoUpdate({
      target: [bodyWeight.athleteId, bodyWeight.date, bodyWeight.source],
      set: { grams },
    });
  return true;
}
