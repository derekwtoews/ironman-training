import { and, count, desc, eq, gte, lte, max, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  activities,
  activityLoad,
  activityOverrides,
  athlete,
  syncEvents,
} from "@/db/schema";
import {
  type ActivityLoadInput,
  addDays,
  type DailyPoint,
  type Discipline,
  dailyLoads,
  daysBetween,
  fitnessFatigue,
  type Insight,
  LOAD_FORMULA_VERSION,
  weekInsights,
  weeklyVolume,
  weekStart,
} from "@/engine";

/** Today's date in the athlete's timezone, as YYYY-MM-DD. Pages pass this into the engine. */
export function localToday(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function getAthlete(db: Db) {
  const [a] = await db.select().from(athlete).orderBy(athlete.id).limit(1);
  return a ?? null;
}

export interface ActivityRow {
  id: number;
  localDate: string;
  startUtc: Date;
  discipline: Discipline;
  sportType: string;
  name: string;
  movingSeconds: number; // effective (override or recorded)
  distanceM: number;
  avgHr: number | null;
  isTrainer: boolean;
  load: number | null; // null = no load (e.g. no heart rate)
  estimated: boolean;
}

/** Activities between two local dates inclusive, newest first, with effective duration and load. */
export async function activitiesBetween(
  db: Db,
  athleteId: number,
  from: string,
  to: string,
): Promise<ActivityRow[]> {
  const rows = await db
    .select({
      id: activities.id,
      localDate: activities.localDate,
      startUtc: activities.startUtc,
      discipline: activities.discipline,
      sportType: activities.sportType,
      name: activities.name,
      movingSeconds: sql<number>`coalesce(${activityOverrides.movingSeconds}, ${activities.movingSeconds})`,
      distanceM: activities.distanceM,
      avgHr: activities.avgHr,
      isTrainer: activities.isTrainer,
      load: activityLoad.load,
      estimated: sql<boolean>`coalesce(${activityLoad.estimated}, false)`,
    })
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
        eq(activities.athleteId, athleteId),
        gte(activities.localDate, from),
        lte(activities.localDate, to),
      ),
    )
    .orderBy(desc(activities.startUtc));
  return rows as ActivityRow[];
}

const toLoadInput = (r: ActivityRow): ActivityLoadInput => ({
  localDate: r.localDate,
  discipline: r.discipline,
  movingSeconds: r.movingSeconds,
  distanceM: r.distanceM,
  load: r.load ?? 0,
});

export interface WeekTotals {
  weekStart: string;
  seconds: number;
  load: number;
  sessions: number;
}

/** `weeks` consecutive weeks ending with the week of `today`, zero-filled, oldest first. */
export function weekTotals(
  rows: ActivityRow[],
  today: string,
  weeks: number,
): WeekTotals[] {
  const byWeek = new Map(
    weeklyVolume(rows.map(toLoadInput)).map((w) => [w.weekStart, w]),
  );
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, k) => {
    const ws = addDays(current, -7 * (weeks - 1 - k));
    const w = byWeek.get(ws);
    return {
      weekStart: ws,
      seconds: w?.total.seconds ?? 0,
      load: w?.total.load ?? 0,
      sessions: w?.total.sessions ?? 0,
    };
  });
}

export interface ThisWeek {
  today: string;
  weekStart: string;
  weekEnd: string;
  race: { date: string; daysToGo: number } | null;
  thisWeek: ActivityRow[]; // newest first
  totals: WeekTotals; // current week
  weeks: WeekTotals[]; // last 8 weeks, oldest first
  fitness: DailyPoint[]; // last ~12 weeks
  historyStart: string | null; // earliest synced activity date
  secondsByDiscipline: Partial<Record<Discipline, number>>; // average per full week, last 3 completed weeks
  insights: Insight[];
  sync: {
    queued: number;
    lastActivityDate: string | null;
    activityCount: number;
  };
}

export async function getThisWeek(
  db: Db,
  a: { id: number; raceDate: string | null },
  today: string,
): Promise<ThisWeek> {
  const ws = weekStart(today);
  const we = addDays(ws, 6);
  const horizon = addDays(ws, -7 * 12); // 12 weeks back for charts
  const recent = await activitiesBetween(db, a.id, horizon, today);

  const [first] = await db
    .select({ d: sql<string | null>`min(${activities.localDate})` })
    .from(activities)
    .where(eq(activities.athleteId, a.id));
  const historyStart = first?.d ?? null;

  // Fitness/fatigue need the full history so the averages are warmed up.
  const all = historyStart
    ? await activitiesBetween(db, a.id, historyStart, today)
    : [];
  const series = historyStart
    ? fitnessFatigue(
        dailyLoads(
          all.map((r) => ({ localDate: r.localDate, load: r.load ?? 0 })),
        ),
        historyStart,
        today,
      )
    : [];
  const fitness = series.filter((p) => p.date >= horizon);

  const weeks = weekTotals(recent, today, 8);
  const thisWeek = recent.filter((r) => r.localDate >= ws);

  // Average hours per discipline over the last 3 completed weeks.
  const from3 = addDays(ws, -21);
  const seconds: Partial<Record<Discipline, number>> = {};
  for (const r of recent)
    if (r.localDate >= from3 && r.localDate < ws)
      seconds[r.discipline] =
        (seconds[r.discipline] ?? 0) + r.movingSeconds / 3;

  const lastRows = await db
    .select({
      discipline: activities.discipline,
      last: max(activities.localDate),
    })
    .from(activities)
    .where(eq(activities.athleteId, a.id))
    .groupBy(activities.discipline);
  const lastDateBySport: Partial<Record<Discipline, string>> = {};
  for (const r of lastRows)
    if (r.last) lastDateBySport[r.discipline as Discipline] = r.last;

  const noHrCount = all.filter(
    (r) =>
      r.localDate >= addDays(today, -28) &&
      r.discipline !== "swim" &&
      r.load == null,
  ).length;
  const insights = weekInsights({
    today,
    lastDateBySport,
    completedWeekLoads: weeks.slice(0, -1).map((w) => w.load),
    noHrCount,
  });

  const [q] = await db
    .select({ n: count() })
    .from(syncEvents)
    .where(
      and(eq(syncEvents.athleteId, a.id), eq(syncEvents.status, "queued")),
    );
  const [c] = await db
    .select({ n: count() })
    .from(activities)
    .where(eq(activities.athleteId, a.id));

  return {
    today,
    weekStart: ws,
    weekEnd: we,
    race: a.raceDate
      ? { date: a.raceDate, daysToGo: daysBetween(today, a.raceDate) }
      : null,
    thisWeek,
    totals: weeks[weeks.length - 1],
    weeks,
    fitness,
    historyStart,
    secondsByDiscipline: seconds,
    insights,
    sync: {
      queued: q.n,
      lastActivityDate:
        lastRows
          .map((r) => r.last)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
      activityCount: c.n,
    },
  };
}
