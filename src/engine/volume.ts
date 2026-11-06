import { weekStart } from "./dates";
import type { ActivityLoadInput, Discipline } from "./types";

export interface Bucket {
  sessions: number;
  seconds: number;
  distanceM: number;
  load: number;
}

export interface WeekVolume {
  weekStart: string; // Monday
  total: Bucket;
  byDiscipline: Partial<Record<Discipline, Bucket>>;
}

const empty = (): Bucket => ({
  sessions: 0,
  seconds: 0,
  distanceM: 0,
  load: 0,
});

function add(b: Bucket, a: ActivityLoadInput): void {
  b.sessions += 1;
  b.seconds += a.movingSeconds;
  b.distanceM += a.distanceM;
  b.load += a.load;
}

/** Weekly (Mon-Sun) volume by discipline, sorted by week. Weeks with no activity are omitted. */
export function weeklyVolume(
  activities: readonly ActivityLoadInput[],
): WeekVolume[] {
  const weeks = new Map<string, WeekVolume>();
  for (const a of activities) {
    const ws = weekStart(a.localDate);
    let w = weeks.get(ws);
    if (!w) {
      w = { weekStart: ws, total: empty(), byDiscipline: {} };
      weeks.set(ws, w);
    }
    add(w.total, a);
    const d = w.byDiscipline[a.discipline] ?? empty();
    w.byDiscipline[a.discipline] = d;
    add(d, a);
  }
  return [...weeks.values()].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
}
