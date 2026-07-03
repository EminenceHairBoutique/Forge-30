import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPENDITURE_OPTIONS,
  estimateExpenditure,
  goalRateFromWeightGoal,
  proteinAnchorG,
  runWeeklyCheckIn,
  type ExpenditureEstimate,
} from "./expenditure";
import { calculateSmoothedWeightTrend } from "./trends";
import { addDays } from "@/lib/utils";
import type { BodyMetric } from "@/lib/types";

const TODAY = "2026-03-15";

function metric(date: string, weightLb: number): BodyMetric {
  return {
    id: date,
    date,
    weightLb,
    waistIn: 0,
    chestIn: 0,
    armsIn: 0,
    legsIn: 0,
    energy: 5,
    soreness: 0,
    photoUrl: "",
  };
}

/** `n` days of logs ending at `end`, each at `kcal` (fn for variation). */
function logs(end: string, n: number, kcal: number | ((i: number) => number)) {
  return Array.from({ length: n }, (_, i) => ({
    date: addDays(end, -(n - 1 - i)),
    calories: typeof kcal === "number" ? kcal : kcal(i),
  }));
}

/** Daily weigh-ins over `n` days ending at `end`, weight from fn(i). */
function weighIns(end: string, n: number, weight: (i: number) => number): BodyMetric[] {
  return Array.from({ length: n }, (_, i) => metric(addDays(end, -(n - 1 - i)), weight(i)));
}

describe("calculateSmoothedWeightTrend (EWMA)", () => {
  it("damps single-day scale noise instead of tracking it", () => {
    // Steady 180 with one 3-lb water spike in the middle.
    const noisy = weighIns(TODAY, 9, (i) => (i === 4 ? 183 : 180));
    const series = calculateSmoothedWeightTrend(noisy);
    const spike = series[4]!;
    expect(spike.weightLb).toBe(183);
    expect(spike.trendLb).toBeLessThan(181.1); // trend absorbs ≤ ~1/3 of the spike
    expect(series.at(-1)!.trendLb).toBeCloseTo(180, 0); // and settles back
  });

  it("still follows a real direction within the window", () => {
    // Genuine ~0.1 lb/day gain with alternating ±0.5 lb noise.
    const series = calculateSmoothedWeightTrend(
      weighIns(TODAY, 21, (i) => 180 + i * 0.1 + (i % 2 === 0 ? 0.5 : -0.5))
    );
    const rise = series.at(-1)!.trendLb - series[0]!.trendLb;
    expect(rise).toBeGreaterThan(1.2); // ~2 lb real rise mostly captured
    expect(rise).toBeLessThan(2.6);
  });

  it("returns an empty series with no weigh-ins", () => {
    expect(calculateSmoothedWeightTrend([])).toEqual([]);
  });
});

describe("estimateExpenditure — calibration threshold", () => {
  it("stays calibrating with fewer than minDaysOfData of history, counting down", () => {
    const e = estimateExpenditure({
      logs: logs(TODAY, 10, 3000),
      metrics: weighIns(TODAY, 10, () => 180),
      today: TODAY,
    });
    expect(e.status).toBe("calibrating");
    expect(e.daysUntilCalibrated).toBe(4); // 14 − 10
    expect(e.tdee).toBeNull();
    expect(e.notes[0]).toMatch(/Calibrating — 4 more days/);
  });

  it("goes live once the window fills with clean data", () => {
    const e = estimateExpenditure({
      logs: logs(TODAY, 21, 3000),
      metrics: weighIns(TODAY, 21, () => 180),
      today: TODAY,
    });
    expect(e.status).toBe("estimated");
    expect(e.daysUntilCalibrated).toBe(0);
    expect(e.notes).toEqual([]);
  });

  it("old-but-sparse data stays calibrating with plain-language notes, never guesses", () => {
    // 30 days old, but only 4 logged days and 2 weigh-ins in the window.
    const e = estimateExpenditure({
      logs: logs(TODAY, 30, 3000).filter((_, i) => i % 7 === 0),
      metrics: [metric(addDays(TODAY, -1), 180), metric(TODAY, 180)],
      today: TODAY,
    });
    expect(e.status).toBe("calibrating");
    expect(e.daysUntilCalibrated).toBe(0); // time isn't the problem
    expect(e.notes.join(" ")).toMatch(/Logging most days/);
    expect(e.notes.join(" ")).toMatch(/weigh-ins a week/i);
    // Neutral register: no failure language.
    expect(e.notes.join(" ").toLowerCase()).not.toMatch(/fail|missed|bad/);
  });
});

describe("estimateExpenditure — partial-day guard", () => {
  it("excludes implausibly low logged days from the intake average", () => {
    // 21 full days at 3000 plus scattered 200-kcal partial entries.
    const full = logs(TODAY, 21, (i) => (i % 5 === 0 ? 200 : 3000));
    const e = estimateExpenditure({
      logs: full,
      metrics: weighIns(TODAY, 21, () => 180),
      today: TODAY,
    });
    expect(e.avgIntake).toBe(3000); // 200-kcal days never touched the mean
    expect(e.completeLogDays).toBe(16);
  });

  it("flat weight on steady intake estimates TDEE ≈ intake", () => {
    const e = estimateExpenditure({
      logs: logs(TODAY, 21, 3000),
      metrics: weighIns(TODAY, 21, () => 180),
      today: TODAY,
    });
    expect(e.tdee).toBe(3000);
    expect(e.weeklyTrendLb).toBe(0);
  });

  it("weight gain on steady intake lowers the TDEE estimate by the surplus", () => {
    // +0.1 lb/day = +0.7 lb/week ≈ 350 kcal/day surplus.
    const e = estimateExpenditure({
      logs: logs(TODAY, 21, 3000),
      metrics: weighIns(TODAY, 21, (i) => 180 + i * 0.1),
      today: TODAY,
    });
    expect(e.status).toBe("estimated");
    expect(e.tdee).toBeGreaterThan(2550);
    expect(e.tdee).toBeLessThan(2800); // EWMA lags the raw rate slightly
  });

  it("falls back to calibrating when the balance math lands outside human range", () => {
    // 1000-kcal "full" days while gaining a pound a day — under-logging.
    const e = estimateExpenditure({
      logs: logs(TODAY, 21, 1000),
      metrics: weighIns(TODAY, 21, (i) => 180 + i),
      today: TODAY,
      options: { minPlausibleCalories: 800 },
    });
    expect(e.status).toBe("calibrating");
    expect(e.tdee).toBeNull();
    expect(e.notes.join(" ")).toMatch(/don't line up yet/);
  });
});

describe("runWeeklyCheckIn — recalibration math", () => {
  const estimated: ExpenditureEstimate = {
    status: "estimated",
    tdee: 2800,
    trendWeightLb: 180,
    weeklyTrendLb: 0.2,
    avgIntake: 2900,
    daysUntilCalibrated: 0,
    completeLogDays: 18,
    weighIns: 12,
    notes: [],
  };

  it("nudges toward tdee + goal surplus, in the suggestion voice", () => {
    // Ideal = 2800 + 250 = 3050; current 2900 → +150 (inside the step cap).
    const c = runWeeklyCheckIn({
      estimate: estimated,
      currentCalorieTarget: 2900,
      goalRateLbPerWeek: 0.5,
    });
    expect(c.suggestedCalorieTarget).toBe(3050);
    expect(c.deltaKcal).toBe(150);
    expect(c.headline).toMatch(/Nudge calories up to 3,050/);
    expect(c.why).toMatch(/expenditure near 2,800/);
  });

  it("step-clamps big corrections so one week never yanks the target", () => {
    // Ideal 3050, current 2500 → raw +550, clamped to +200.
    const c = runWeeklyCheckIn({
      estimate: estimated,
      currentCalorieTarget: 2500,
      goalRateLbPerWeek: 0.5,
    });
    expect(c.deltaKcal).toBe(200);
    expect(c.suggestedCalorieTarget).toBe(2700);
  });

  it("stays the course when the target is already within 75 kcal of ideal", () => {
    const c = runWeeklyCheckIn({
      estimate: estimated,
      currentCalorieTarget: 3050,
      goalRateLbPerWeek: 0.5,
    });
    expect(c.deltaKcal).toBe(0);
    expect(c.suggestedCalorieTarget).toBe(3050);
    expect(c.headline).toMatch(/Stay the course/);
  });

  it("eases down for a deficit goal", () => {
    // Ideal = 2800 − 250 = 2550; current 2700 → −150.
    const c = runWeeklyCheckIn({
      estimate: estimated,
      currentCalorieTarget: 2700,
      goalRateLbPerWeek: -0.5,
    });
    expect(c.deltaKcal).toBe(-150);
    expect(c.headline).toMatch(/Ease calories down to 2,550/);
  });

  it("while calibrating: no target move, but the countdown and protein anchor still show", () => {
    const calibrating: ExpenditureEstimate = {
      ...estimated,
      status: "calibrating",
      tdee: null,
      daysUntilCalibrated: 5,
      notes: ["Calibrating — 5 more days of data and the estimate goes live."],
    };
    const c = runWeeklyCheckIn({
      estimate: calibrating,
      currentCalorieTarget: 3050,
      goalRateLbPerWeek: 0.5,
    });
    expect(c.suggestedCalorieTarget).toBeNull();
    expect(c.deltaKcal).toBe(0);
    expect(c.headline).toMatch(/Calibrating — 5 more days/);
    expect(c.proteinAnchorG).toBe(160); // 180 × 0.9, rounded to 5
  });
});

describe("protein anchor + goal-rate parsing", () => {
  it("anchors protein to trend weight: 0.9 g/lb gaining, 1.1 g/lb cutting", () => {
    expect(proteinAnchorG(180, 0.5)).toBe(160);
    expect(proteinAnchorG(180, -0.5)).toBe(200);
    expect(proteinAnchorG(null, 0.5)).toBeNull();
  });

  it("reads the goal direction from the profile's free-text weight goal", () => {
    expect(goalRateFromWeightGoal("Gain 4–8 lb (lean-mass focus)")).toBe(0.5);
    expect(goalRateFromWeightGoal("Cut to 175")).toBe(-0.5);
    expect(goalRateFromWeightGoal("Feel strong")).toBe(0);
  });
});

describe("options are honored", () => {
  it("a tighter custom window changes what counts", () => {
    const e = estimateExpenditure({
      logs: logs(TODAY, 30, 3000),
      metrics: weighIns(TODAY, 30, () => 180),
      today: TODAY,
      options: { windowDays: 14 },
    });
    expect(e.completeLogDays).toBe(14);
    expect(DEFAULT_EXPENDITURE_OPTIONS.windowDays).toBe(21);
  });
});
