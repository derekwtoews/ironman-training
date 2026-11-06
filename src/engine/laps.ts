import type { Discipline } from "./types";

/** Bump when classification rules change; lap rows are tagged with it. */
export const LAP_FORMULA_VERSION = 2; // v2: auto-lap detection

export type LapKind =
  | "warmup"
  | "work"
  | "rest"
  | "cooldown"
  | "steady"
  | "set"
  | "other";

export interface LapInput {
  movingSeconds: number;
  distanceM: number;
  avgSpeedMmS: number | null;
  avgHr: number | null;
  avgWatts: number | null;
}

export interface LapRules {
  minWorkSeconds: number; // shorter laps are "other" (lap-button taps, tail ends)
  minHrGap: number; // bpm between easy and hard groups to count as intervals
  minRelGap: number; // same, as a fraction, for speed or watts
  autoLapTolerance: number; // laps within this fraction of each other count as auto-lap
}

export const DEFAULT_LAP_RULES: LapRules = {
  minWorkSeconds: 60,
  minHrGap: 8,
  minRelGap: 0.08,
  autoLapTolerance: 0.02,
};

/**
 * Garmin auto-lap (every 1 km, 5 km, or N minutes): every lap except the last partial one has
 * the same distance or the same duration. Those laps say nothing about reps.
 */
export function isAutoLap(
  laps: readonly LapInput[],
  tol = DEFAULT_LAP_RULES.autoLapTolerance,
): boolean {
  const body = laps.slice(0, -1);
  if (body.length < 3) return false;
  const same = (xs: number[], floor: number) => {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    return mid >= floor && xs.every((x) => Math.abs(x - mid) <= mid * tol);
  };
  return (
    same(
      body.map((l) => l.distanceM),
      400,
    ) ||
    same(
      body.map((l) => l.movingSeconds),
      60,
    )
  );
}

/** Effort signal per discipline: bike watts, else HR, else speed. */
function signal(
  d: Discipline,
  lap: LapInput,
): { value: number; kind: "hr" | "rel" } | null {
  if (d === "bike" && lap.avgWatts != null)
    return { value: lap.avgWatts, kind: "rel" };
  if (lap.avgHr != null) return { value: lap.avgHr, kind: "hr" };
  if (lap.avgSpeedMmS != null && lap.avgSpeedMmS > 0)
    return { value: lap.avgSpeedMmS, kind: "rel" };
  return null;
}

/**
 * Label each lap. Auto-lap sessions are all steady. Pool swims: laps with distance are sets, zero-distance laps are rest.
 * Otherwise laps long enough to count are split into a hard and an easy group at the
 * largest gap in effort; if that gap is small (auto-lap on a steady run) everything is
 * "steady". Easy laps before the first hard lap are warm-up, after the last are cool-down,
 * and between hard laps are rest.
 */
export function classifyLaps(
  d: Discipline,
  laps: readonly LapInput[],
  rules: LapRules = DEFAULT_LAP_RULES,
): LapKind[] {
  if (d === "swim") return laps.map((l) => (l.distanceM > 0 ? "set" : "rest"));

  const out: LapKind[] = laps.map((l) =>
    l.movingSeconds < rules.minWorkSeconds ? "other" : "steady",
  );
  if (isAutoLap(laps, rules.autoLapTolerance)) return out;
  const eligible = laps
    .map((l, i) => ({ i, s: out[i] === "steady" ? signal(d, l) : null }))
    .filter(
      (x): x is { i: number; s: { value: number; kind: "hr" | "rel" } } =>
        x.s != null,
    );
  if (eligible.length < 3) return out; // intervals need at least warm-up, effort, and one more lap

  const sorted = [...eligible].sort((a, b) => a.s.value - b.s.value);
  let gap = 0;
  let cut = 0;
  for (let k = 1; k < sorted.length; k++) {
    const g = sorted[k].s.value - sorted[k - 1].s.value;
    if (g > gap) {
      gap = g;
      cut = sorted[k].s.value;
    }
  }
  const lowTop = sorted.filter((x) => x.s.value < cut).at(-1)?.s.value ?? cut;
  const big =
    sorted[0].s.kind === "hr"
      ? gap >= rules.minHrGap
      : gap / lowTop >= rules.minRelGap;
  if (!big) return out;

  const hard = new Set(
    eligible.filter((x) => x.s.value >= cut).map((x) => x.i),
  );
  const first = Math.min(...hard);
  const last = Math.max(...hard);
  return out.map((k, i) => {
    if (k === "other") return k;
    if (hard.has(i)) return "work";
    if (i < first) return "warmup";
    if (i > last) return "cooldown";
    return "rest";
  });
}

export interface RepSummary {
  reps: number;
  /** Seconds per km for runs, null otherwise. */
  paceSecPerKm: (number | null)[];
  avgHr: (number | null)[];
  avgWatts: (number | null)[];
  /** Last rep minus first rep: seconds per km (run, positive = slower) or watts (bike, negative = fewer). */
  fade: number | null;
}

export const paceSecPerKm = (mmS: number | null): number | null =>
  mmS && mmS > 0 ? Math.round(1_000_000 / mmS) : null;

/** Per-rep numbers for the work laps, in order. */
export function summarizeReps(
  d: Discipline,
  laps: readonly LapInput[],
  kinds: readonly LapKind[],
): RepSummary {
  const work = laps.filter((_, i) => kinds[i] === "work");
  const pace = work.map((l) =>
    d === "run" ? paceSecPerKm(l.avgSpeedMmS) : null,
  );
  const watts = work.map((l) => l.avgWatts);
  let fade: number | null = null;
  if (work.length >= 2) {
    if (d === "run" && pace[0] != null && pace.at(-1) != null)
      fade = (pace.at(-1) as number) - (pace[0] as number);
    if (d === "bike" && watts[0] != null && watts.at(-1) != null)
      fade = (watts.at(-1) as number) - (watts[0] as number);
  }
  return {
    reps: work.length,
    paceSecPerKm: pace,
    avgHr: work.map((l) => l.avgHr),
    avgWatts: watts,
    fade,
  };
}
