import { describe, expect, it } from "vitest";
import { estimateTargets } from "./targets";

describe("estimateTargets", () => {
  const fullStats = {
    weightLb: 180,
    heightIn: 71,
    age: 30,
    sex: "male" as const,
    activityLevel: "moderate" as const,
    primaryGoal: "gainMuscle" as const,
  };

  it("uses Mifflin-St Jeor with full stats and lands in a sane range", () => {
    const t = estimateTargets(fullStats);
    expect(t.basis).toBe("mifflin");
    // BMR ~1815 × 1.55 ≈ 2813 + 250 surplus ≈ 3050–3100, rounded to 50.
    expect(t.calorieTarget).toBeGreaterThanOrEqual(2900);
    expect(t.calorieTarget).toBeLessThanOrEqual(3200);
    expect(t.calorieTarget % 50).toBe(0);
    expect(t.proteinTarget).toBe(160); // 180 × 0.9, rounded to 5
  });

  it("sex constants differ, and unspecified takes the midpoint", () => {
    const male = estimateTargets(fullStats).calorieTarget;
    const female = estimateTargets({ ...fullStats, sex: "female" }).calorieTarget;
    const unspecified = estimateTargets({ ...fullStats, sex: "unspecified" }).calorieTarget;
    expect(male).toBeGreaterThan(female);
    expect(unspecified).toBeGreaterThan(female);
    expect(unspecified).toBeLessThan(male);
  });

  it("a fat-loss goal cuts calories and raises the protein floor", () => {
    const gain = estimateTargets(fullStats);
    const lose = estimateTargets({ ...fullStats, primaryGoal: "loseFat" });
    expect(lose.calorieTarget).toBeLessThan(gain.calorieTarget - 500);
    expect(lose.proteinTarget).toBe(200); // 180 × 1.1, rounded to 5
  });

  it("falls back to the body-weight shortcut without height/age", () => {
    const t = estimateTargets({ ...fullStats, heightIn: null, age: null });
    expect(t.basis).toBe("bodyweight");
    expect(t.calorieTarget).toBeGreaterThan(2500);
    expect(t.proteinTarget).toBe(160);
  });

  it("falls back to neutral defaults with no stats at all", () => {
    const t = estimateTargets({
      weightLb: null,
      heightIn: null,
      age: null,
      sex: "unspecified",
      activityLevel: "moderate",
      primaryGoal: "generalReset",
    });
    expect(t.basis).toBe("default");
    expect(t.calorieTarget).toBe(2400);
    expect(t.proteinTarget).toBe(140);
  });

  it("activity level scales the estimate", () => {
    const sedentary = estimateTargets({ ...fullStats, activityLevel: "sedentary" });
    const veryActive = estimateTargets({ ...fullStats, activityLevel: "veryActive" });
    expect(veryActive.calorieTarget).toBeGreaterThan(sedentary.calorieTarget + 800);
  });
});
