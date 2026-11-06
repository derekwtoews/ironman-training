import { describe, expect, it } from "vitest";
import {
  checkGuardrails,
  maxAllowedLoad,
  recoveryRange,
  type WeekPlan,
} from "./guardrails";

const wk = (
  n: number,
  load: number,
  extra: Partial<WeekPlan> = {},
): WeekPlan => ({
  weekStart: `w${n}`,
  load,
  phase: "build",
  isRecovery: false,
  ...extra,
});

describe("guardrails", () => {
  it("computes caps", () => {
    expect(maxAllowedLoad(120)).toBe(134); // floor(134.4)
    expect(recoveryRange(135)).toEqual([81, 94]); // ceil(81), floor(94.5)
  });
  it("flags ramp over 12% and missing recovery", () => {
    const w = checkGuardrails([wk(1, 100), wk(2, 110), wk(3, 120), wk(4, 135)]);
    expect(w.map((x) => x.code)).toEqual(["ramp", "recovery_missing"]);
    expect(w[0].weekStart).toBe("w4");
  });
  it("accepts a clean 3+1 block", () => {
    const w = checkGuardrails([
      wk(1, 100),
      wk(2, 110),
      wk(3, 120),
      wk(4, 80, { isRecovery: true }),
      wk(5, 125), // 125 <= floor(120*1.12)=134, ramp is vs last non-recovery week
    ]);
    expect(w).toEqual([]);
  });
  it("flags recovery depth outside 60-70%", () => {
    const w = checkGuardrails([wk(1, 100), wk(2, 50, { isRecovery: true })]);
    expect(w.map((x) => x.code)).toEqual(["recovery_depth"]);
  });
  it("flags taper shorter than 2 or longer than 3 weeks", () => {
    const taper = (n: number, load: number) => wk(n, load, { phase: "taper" });
    expect(
      checkGuardrails([wk(1, 100), taper(2, 70)]).map((x) => x.code),
    ).toEqual(["taper_length"]);
    expect(checkGuardrails([wk(1, 100), taper(2, 70), taper(3, 50)])).toEqual(
      [],
    );
    expect(
      checkGuardrails([
        wk(1, 100),
        taper(2, 80),
        taper(3, 60),
        taper(4, 40),
        taper(5, 30),
      ]).map((x) => x.code),
    ).toEqual(["taper_length"]);
  });
  it("is tunable", () => {
    const g = {
      ...{
        maxRampPct: 5,
        recoveryEveryNWeeks: 4,
        recoveryMinPct: 60,
        recoveryMaxPct: 70,
        taperWeeksMin: 2,
        taperWeeksMax: 3,
      },
    };
    expect(
      checkGuardrails([wk(1, 100), wk(2, 110)], g).map((x) => x.code),
    ).toEqual(["ramp"]);
  });
});
