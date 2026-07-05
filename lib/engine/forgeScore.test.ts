import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAY_BOUNDARY_HOUR,
  DEFAULT_WEIGHTS,
  calculateForgeScore,
  calorieProteinCredit,
  disabledComponents,
  renormalizeWeights,
  resolveScoreState,
  type ForgeScoreInputs,
  type ForgeScoreTargets,
} from "./forgeScore";
import type { ForgeScoreWeights } from "@/lib/types";

const targets: ForgeScoreTargets = {
  calorieTarget: 3050,
  proteinTarget: 170,
  waterTarget: 3000,
  dailySpendingLimit: 50,
};

const perfectDay: ForgeScoreInputs = {
  calories: 3050,
  protein: 170,
  waterMl: 3000,
  workoutStatus: "complete",
  mobilityDone: true,
  sleepHours: 8,
  spendingChecked: true,
  journalDone: true,
  skillMinutes: 20,
  painScore: 0,
  stress: 3,
  unnecessarySpend: 0,
};

describe("calorieProteinCredit", () => {
  it("gives full points within ±10% of target", () => {
    expect(calorieProteinCredit(3050, 3050, 15)).toBe(15);
    expect(calorieProteinCredit(3050 * 0.91, 3050, 15)).toBe(15);
    expect(calorieProteinCredit(3050 * 1.09, 3050, 15)).toBe(15);
  });

  it("gives zero points at ±30% or worse", () => {
    expect(calorieProteinCredit(3050 * 0.7, 3050, 15)).toBe(0);
    expect(calorieProteinCredit(3050 * 1.31, 3050, 15)).toBe(0);
  });

  it("falls off linearly between 10% and 30% deviation", () => {
    // 20% deviation = midpoint of the falloff = half points.
    expect(calorieProteinCredit(3050 * 0.8, 3050, 15)).toBeCloseTo(7.5, 5);
  });

  it("one-sided mode ignores overshoot (protein is a floor)", () => {
    expect(calorieProteinCredit(220, 170, 15, true)).toBe(15);
    expect(calorieProteinCredit(136, 170, 15, true)).toBeLessThan(15);
  });
});

describe("calculateForgeScore", () => {
  it("scores a perfect day at 100", () => {
    const r = calculateForgeScore(perfectDay, targets);
    expect(r.base).toBe(100);
    expect(r.score).toBe(100);
    expect(r.penalties).toHaveLength(0);
  });

  it("scores an empty day at 0", () => {
    const r = calculateForgeScore(
      {
        ...perfectDay,
        calories: 0,
        protein: 0,
        waterMl: 0,
        workoutStatus: "notStarted",
        mobilityDone: false,
        sleepHours: 0,
        spendingChecked: false,
        journalDone: false,
        skillMinutes: 0,
      },
      targets
    );
    expect(r.score).toBe(0);
  });

  it("counts a rest day as workout/recovery completed", () => {
    const r = calculateForgeScore({ ...perfectDay, workoutStatus: "rest" }, targets);
    expect(r.components.find((c) => c.key === "workout")?.points).toBe(15);
  });

  it("gives half sleep credit between 6 and 7 hours", () => {
    const r = calculateForgeScore({ ...perfectDay, sleepHours: 6.5 }, targets);
    expect(r.components.find((c) => c.key === "sleep")?.points).toBe(5);
  });

  it("scales the pain penalty: 7→−5, 8→−10, 9+→−15", () => {
    expect(calculateForgeScore({ ...perfectDay, painScore: 7 }, targets).score).toBe(95);
    expect(calculateForgeScore({ ...perfectDay, painScore: 8 }, targets).score).toBe(90);
    expect(calculateForgeScore({ ...perfectDay, painScore: 9 }, targets).score).toBe(85);
    expect(calculateForgeScore({ ...perfectDay, painScore: 10 }, targets).score).toBe(85);
  });

  it("penalizes very high stress from 8 up", () => {
    expect(calculateForgeScore({ ...perfectDay, stress: 7 }, targets).score).toBe(100);
    expect(calculateForgeScore({ ...perfectDay, stress: 8 }, targets).score).toBe(95);
    expect(calculateForgeScore({ ...perfectDay, stress: 10 }, targets).score).toBe(90);
  });

  it("scales the overspend penalty with the amount over the daily limit", () => {
    expect(calculateForgeScore({ ...perfectDay, unnecessarySpend: 50 }, targets).score).toBe(100);
    expect(calculateForgeScore({ ...perfectDay, unnecessarySpend: 60 }, targets).score).toBe(95);
    expect(calculateForgeScore({ ...perfectDay, unnecessarySpend: 80 }, targets).score).toBe(90);
    expect(calculateForgeScore({ ...perfectDay, unnecessarySpend: 120 }, targets).score).toBe(85);
  });

  it("applies the >40g protein miss penalty on top of lost component points", () => {
    // 100g protein = 41% under target → 0 component points + −5 penalty.
    const r = calculateForgeScore({ ...perfectDay, protein: 100 }, targets);
    expect(r.components.find((c) => c.key === "protein")?.points).toBe(0);
    expect(r.penalties.find((p) => p.key === "proteinMiss")?.points).toBe(-5);
    expect(r.score).toBe(80);
  });

  it("applies the >500 calorie miss penalty", () => {
    const r = calculateForgeScore({ ...perfectDay, calories: 2500 }, targets);
    expect(r.penalties.find((p) => p.key === "calorieMiss")?.points).toBe(-5);
  });

  it("floors the score at 0 even with stacked penalties", () => {
    const r = calculateForgeScore(
      {
        calories: 0,
        protein: 0,
        waterMl: 0,
        workoutStatus: "skipped",
        mobilityDone: false,
        sleepHours: 0,
        spendingChecked: false,
        journalDone: false,
        skillMinutes: 0,
        painScore: 10,
        stress: 10,
        unnecessarySpend: 500,
      },
      targets
    );
    expect(r.score).toBe(0);
  });

  it("matches the spec example ballpark: strong day with low calories", () => {
    // Protein 142/170 (−16.5%), calories 2640/3050 (−13.4%): partial credit on
    // both, everything else done → low-to-mid 90s before any penalty.
    const r = calculateForgeScore({ ...perfectDay, calories: 2640, protein: 142 }, targets);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.score).toBeLessThan(100);
  });
});

describe("configurable weights", () => {
  const sum = (w: ForgeScoreWeights) => Object.values(w).reduce((a, b) => a + b, 0);

  it("default weights sum to 100 and passing them explicitly matches omitting them", () => {
    expect(sum(DEFAULT_WEIGHTS)).toBe(100);
    const a = calculateForgeScore(perfectDay, targets);
    const b = calculateForgeScore(perfectDay, targets, DEFAULT_WEIGHTS);
    expect(b.score).toBe(a.score);
    expect(b.components).toEqual(a.components);
  });

  it("renormalizeWeights is a no-op (up to rounding) when nothing is disabled", () => {
    const r = renormalizeWeights(DEFAULT_WEIGHTS);
    expect(sum(r)).toBeCloseTo(100, 5);
    expect(r).toEqual(DEFAULT_WEIGHTS);
  });

  it("redistributes a disabled domain's weight, keeping the total at 100", () => {
    const r = renormalizeWeights(DEFAULT_WEIGHTS, ["skill"]);
    expect(r.skill).toBe(0);
    expect(sum(r)).toBeCloseTo(100, 5);
    // Remaining components scale up proportionally (15/95 * 100).
    expect(r.calories).toBeCloseTo((15 / 95) * 100, 5);
  });

  it("a perfect day still scores 100 under renormalized weights with a domain off", () => {
    const weights = renormalizeWeights(DEFAULT_WEIGHTS, ["skill"]);
    // No skill logged, but skill is disabled — the day is still perfect.
    const r = calculateForgeScore({ ...perfectDay, skillMinutes: 0 }, targets, weights);
    expect(r.score).toBe(100);
  });

  it("domain toggles map to their score components; absent toggles disable nothing", () => {
    expect(disabledComponents(undefined)).toEqual([]);
    expect(disabledComponents({ nutrition: true, money: true })).toEqual([]);
    expect(disabledComponents({ money: false, skills: false }).sort()).toEqual([
      "skill",
      "spending",
    ]);
    // A perfect day minus the disabled domains still scores 100.
    const weights = renormalizeWeights(DEFAULT_WEIGHTS, disabledComponents({ money: false, skills: false }));
    const r = calculateForgeScore(
      { ...perfectDay, spendingChecked: false, skillMinutes: 0 },
      targets,
      weights
    );
    expect(r.score).toBe(100);
  });

  it("shifts the score when a component is weighted more heavily", () => {
    // Move mobility+skill (15) into sleep → sleep worth 25, total still 100.
    const heavySleep = { ...DEFAULT_WEIGHTS, sleep: 25, mobility: 0, skill: 0 };
    const poorSleep = calculateForgeScore({ ...perfectDay, sleepHours: 5 }, targets, heavySleep);
    // A perfect day but no sleep loses exactly the 25-point sleep component.
    expect(poorSleep.score).toBe(75);
  });
});

describe("resolveScoreState", () => {
  it("is inProgress before the default 8 PM boundary", () => {
    expect(resolveScoreState(0)).toBe("inProgress");
    expect(resolveScoreState(8)).toBe("inProgress");
    expect(resolveScoreState(19)).toBe("inProgress");
  });

  it("is final from the boundary hour onward", () => {
    expect(resolveScoreState(DEFAULT_DAY_BOUNDARY_HOUR)).toBe("final");
    expect(resolveScoreState(23)).toBe("final");
  });

  it("respects a user-configured boundary", () => {
    expect(resolveScoreState(17, 18)).toBe("inProgress");
    expect(resolveScoreState(18, 18)).toBe("final");
    expect(resolveScoreState(1, 0)).toBe("final"); // boundary 0 = always a verdict
  });

  it("clamps out-of-range boundaries instead of misbehaving", () => {
    expect(resolveScoreState(23, 99)).toBe("final"); // clamped to 23
    expect(resolveScoreState(0, -5)).toBe("final"); // clamped to 0
  });
});
