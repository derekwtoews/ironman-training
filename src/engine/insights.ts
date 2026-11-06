import { daysBetween } from "./dates";
import {
  DEFAULT_GUARDRAILS,
  type Guardrails,
  maxAllowedLoad,
} from "./guardrails";
import type { Discipline } from "./types";

export interface Insight {
  id: string;
  kind: "ramp" | "gap" | "data";
  title: string;
  detail: string;
}

export interface InsightInput {
  today: string; // YYYY-MM-DD
  /** Latest activity date per discipline. */
  lastDateBySport: Partial<Record<Discipline, string>>;
  /** Totals of completed weeks, oldest first (exclude the week in progress). */
  completedWeekLoads: number[];
  /** Workouts in the last 28 days that are not swims and have no heart-rate load. */
  noHrCount: number;
}

const SPORT_GAP: Discipline[] = ["swim", "bike", "run"];
const GAP_DAYS = 8;

/** Simple, explainable checks. Pure: same input, same output. */
export function weekInsights(
  i: InsightInput,
  g: Guardrails = DEFAULT_GUARDRAILS,
): Insight[] {
  const out: Insight[] = [];

  const loads = i.completedWeekLoads;
  if (loads.length >= 2) {
    const prev = loads[loads.length - 2];
    const last = loads[loads.length - 1];
    if (prev > 0 && last > maxAllowedLoad(prev, g)) {
      const pct = Math.round(((last - prev) / prev) * 100);
      out.push({
        id: "ramp",
        kind: "ramp",
        title: `Last week's load was +${pct}%`,
        detail: `${prev} to ${last}; the cap is ${g.maxRampPct}% (max ${maxAllowedLoad(prev, g)}). A warning only.`,
      });
    }
  }

  for (const sport of SPORT_GAP) {
    const last = i.lastDateBySport[sport];
    if (!last) continue;
    const days = daysBetween(last, i.today);
    if (days >= GAP_DAYS) {
      out.push({
        id: `gap-${sport}`,
        kind: "gap",
        title: `No ${sport} in ${days} days`,
        detail: `Your last ${sport} was ${last}.`,
      });
    }
  }

  if (i.noHrCount > 0) {
    out.push({
      id: "no-hr",
      kind: "data",
      title: `${i.noHrCount} workout${i.noHrCount === 1 ? " has" : "s have"} no heart rate`,
      detail:
        "They add no load. Swims are estimated separately and not counted here.",
    });
  }
  return out;
}
