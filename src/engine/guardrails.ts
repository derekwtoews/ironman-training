export interface Guardrails {
  maxRampPct: number; // weekly load increase cap vs. last non-recovery week
  recoveryEveryNWeeks: number; // every Nth week is a recovery week
  recoveryMinPct: number; // recovery week load as % of prior week
  recoveryMaxPct: number;
  taperWeeksMin: number;
  taperWeeksMax: number;
}

export const DEFAULT_GUARDRAILS: Guardrails = {
  maxRampPct: 12,
  recoveryEveryNWeeks: 4,
  recoveryMinPct: 60,
  recoveryMaxPct: 70,
  taperWeeksMin: 2,
  taperWeeksMax: 3,
};

export type Phase = "base" | "build" | "peak" | "taper" | "race";

export interface WeekPlan {
  weekStart: string;
  load: number;
  phase: Phase;
  isRecovery: boolean;
}

export type WarningCode =
  | "ramp"
  | "recovery_depth"
  | "recovery_missing"
  | "taper_length";

/** Guardrails warn, never block. */
export interface GuardrailWarning {
  code: WarningCode;
  weekStart: string;
  message: string;
}

/** Highest load allowed next week given the baseline week. */
export const maxAllowedLoad = (
  baseline: number,
  g: Guardrails = DEFAULT_GUARDRAILS,
): number => Math.floor((baseline * (100 + g.maxRampPct)) / 100);

/** Recovery-week load range [min, max] given the prior week. */
export const recoveryRange = (
  prior: number,
  g: Guardrails = DEFAULT_GUARDRAILS,
): [number, number] => [
  Math.ceil((prior * g.recoveryMinPct) / 100),
  Math.floor((prior * g.recoveryMaxPct) / 100),
];

/** Check a chronological sequence of weeks. Pure; returns all warnings found. */
export function checkGuardrails(
  weeks: readonly WeekPlan[],
  g: Guardrails = DEFAULT_GUARDRAILS,
): GuardrailWarning[] {
  const out: GuardrailWarning[] = [];
  let baseline: number | null = null; // last non-recovery, non-taper week
  let buildRun = 0; // consecutive non-recovery build-ish weeks
  const maxRun = g.recoveryEveryNWeeks - 1;

  weeks.forEach((w, i) => {
    const prev = i > 0 ? weeks[i - 1] : null;
    const training = w.phase !== "taper" && w.phase !== "race";

    if (w.isRecovery) {
      if (prev && prev.load > 0) {
        const [lo, hi] = recoveryRange(prev.load, g);
        if (w.load < lo || w.load > hi) {
          out.push({
            code: "recovery_depth",
            weekStart: w.weekStart,
            message: `Recovery week load ${w.load} is outside ${lo}-${hi} (${g.recoveryMinPct}-${g.recoveryMaxPct}% of ${prev.load}).`,
          });
        }
      }
      buildRun = 0;
      return;
    }

    if (training) {
      if (baseline !== null && w.load > maxAllowedLoad(baseline, g)) {
        const pct = Math.round(((w.load - baseline) / baseline) * 100);
        out.push({
          code: "ramp",
          weekStart: w.weekStart,
          message: `Load ${w.load} is +${pct}% over ${baseline}; cap is ${g.maxRampPct}% (max ${maxAllowedLoad(baseline, g)}).`,
        });
      }
      baseline = w.load;
      buildRun += 1;
      if (buildRun > maxRun) {
        out.push({
          code: "recovery_missing",
          weekStart: w.weekStart,
          message: `${buildRun} build weeks in a row; recovery needed every ${g.recoveryEveryNWeeks} weeks.`,
        });
      }
    }
  });

  const taper = weeks.filter((w) => w.phase === "taper");
  if (
    taper.length > 0 &&
    (taper.length < g.taperWeeksMin || taper.length > g.taperWeeksMax)
  ) {
    out.push({
      code: "taper_length",
      weekStart: taper[0].weekStart,
      message: `Taper is ${taper.length} weeks; target ${g.taperWeeksMin}-${g.taperWeeksMax}.`,
    });
  }
  return out;
}
