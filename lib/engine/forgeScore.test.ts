import { describe, expect, it } from "vitest";
import {
  calculateForgeScore,
  calorieProteinCredit,
  type ForgeScoreInputs,
  type ForgeScoreTargets,
} from "./forgeScore";

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
