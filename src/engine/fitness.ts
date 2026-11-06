import { eachDay } from "./dates";

export const FITNESS_DAYS = 42;
export const FATIGUE_DAYS = 7;

export interface DailyPoint {
  date: string;
  load: number;
  fitness: number; // 42-day EWMA
  fatigue: number; // 7-day EWMA
  form: number; // fitness - fatigue
}

/** Sum activity loads into a date -> load map. */
export function dailyLoads(
  items: readonly { localDate: string; load: number }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of items) m.set(a.localDate, (m.get(a.localDate) ?? 0) + a.load);
  return m;
}

/**
 * Exponentially weighted averages, one step per day:
 *   x_t = x_{t-1} + (load_t - x_{t-1}) / N
 * Seeded at 0 on `from`; missing days count as 0 load. Backfill warms the seed up.
 */
export function fitnessFatigue(
  loads: ReadonlyMap<string, number>,
  from: string,
  to: string,
  seed: { fitness: number; fatigue: number } = { fitness: 0, fatigue: 0 },
): DailyPoint[] {
  let fitness = seed.fitness;
  let fatigue = seed.fatigue;
  return eachDay(from, to).map((date) => {
    const load = loads.get(date) ?? 0;
    fitness += (load - fitness) / FITNESS_DAYS;
    fatigue += (load - fatigue) / FATIGUE_DAYS;
    return { date, load, fitness, fatigue, form: fitness - fatigue };
  });
}

/** Cache representation: integers only (value * 100, rounded). */
export const toX100 = (v: number): number => Math.round(v * 100);
