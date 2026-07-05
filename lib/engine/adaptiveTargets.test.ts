import { describe, expect, it } from "vitest";
import { MAX_TARGET_STEP_KCAL, sundayTargetSuggestion } from "./adaptiveTargets";
import type { ExpenditureEstimate } from "./expenditure";

const estimated = (over: Partial<ExpenditureEstimate>): ExpenditureEstimate => ({
  status: "estimated",
  tdee: 2600,
  avgIntake: 2400,
  trendWeightLb: 185,
  weeklyTrendLb: -0.4,
  daysUntilCalibrated: 0,
  completeLogDays: 7,
  weighIns: 6,
  notes: [],
  ...over,
});

describe("adaptive target suggestions (v3 Phase 4)", () => {
  it("suggests a capped ≤150 kcal step toward the goal", () => {
    // TDEE 2600, goal +0 (maintain), current target 2200 → raw delta +400 → cap +150.
    const s = sundayTargetSuggestion({
      estimate: estimated({}),
      currentCalorieTarget: 2200,
      goalRateLbPerWeek: 0,
    });
    expect(s).not.toBeNull();
    expect(s!.delta).toBe(MAX_TARGET_STEP_KCAL);
    expect(s!.suggested).toBe(2350);
    expect(s!.why).toContain("expenditure");
  });

  it("returns null while calibrating — nothing to decide yet", () => {
    const s = sundayTargetSuggestion({
      estimate: estimated({ status: "calibrating", tdee: null, daysUntilCalibrated: 3 }),
      currentCalorieTarget: 2400,
      goalRateLbPerWeek: 0,
    });
    expect(s).toBeNull();
  });

  it("returns null when already on track (delta < the engine's dead zone)", () => {
    const s = sundayTargetSuggestion({
      estimate: estimated({ tdee: 2430 }),
      currentCalorieTarget: 2400,
      goalRateLbPerWeek: 0,
    });
    expect(s).toBeNull();
  });

  it("steps down for a deficit goal without exceeding the cap", () => {
    // TDEE 2600, goal -1 lb/wk → ideal 2100; current 2600 → raw -500 → cap -150.
    const s = sundayTargetSuggestion({
      estimate: estimated({}),
      currentCalorieTarget: 2600,
      goalRateLbPerWeek: -1,
    });
    expect(s!.delta).toBe(-MAX_TARGET_STEP_KCAL);
    expect(s!.suggested).toBe(2450);
    expect(s!.proteinAnchorG).toBeGreaterThan(0);
  });
});
