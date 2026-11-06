export interface WeightEntry {
  date: string; // YYYY-MM-DD
  grams: number;
}

/** Most recent weigh-in on or before `date`; manual entries win over Strava on the same day. */
export function weightOn(
  entries: readonly (WeightEntry & { source?: string })[],
  date: string,
): number | null {
  let best: (WeightEntry & { source?: string }) | null = null;
  for (const e of entries) {
    if (e.date > date) continue;
    if (
      !best ||
      e.date > best.date ||
      (e.date === best.date && e.source === "manual")
    )
      best = e;
  }
  return best?.grams ?? null;
}

/** Watts per kg x100, as an integer (e.g. 412 = 4.12 W/kg). */
export const wattsPerKgX100 = (watts: number, grams: number): number =>
  Math.round((watts * 100_000) / grams);
