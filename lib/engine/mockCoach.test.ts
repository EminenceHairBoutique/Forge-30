import { describe, expect, it } from "vitest";
import { generateMockAIFeedback, type CoachInput } from "./mockCoach";

const goodDay: CoachInput = {
  name: "Test",
  dayNumber: 5,
  forgeScore: 92,
  calories: 3000,
  calorieTarget: 3050,
  protein: 168,
  proteinTarget: 170,
  waterMl: 3000,
  waterTarget: 3000,
  workoutStatus: "complete",
  splitLabel: "Upper Push + Shoulders",
  sessionPainScore: 2,
  sleepHours: 7.5,
  mobilityDone: true,
  mood: 7,
  stress: 4,
  journalDone: true,
  spendingChecked: true,
  totalSpend: 22,
  unnecessarySpend: 0,
  dailySpendingLimit: 50,
  skillMinutes: 15,
  skillMissedTwoDays: false,
  weightTrend7d: 1.2,
  scoreState: "final",
};

describe("generateMockAIFeedback", () => {
  it("is deterministic — same input, same output", () => {
    expect(generateMockAIFeedback(goodDay)).toEqual(generateMockAIFeedback(goodDay));
  });

  it("always returns the full 8-part structure with non-empty parts", () => {
    const r = generateMockAIFeedback(goodDay);
    const parts = [
      r.scoreExplanation,
      r.wentWell,
      r.slipped,
      r.physicalAdjustment,
      r.nutritionAdjustment,
      r.moneyAdjustment,
      r.mentalAdjustment,
      r.tomorrowPriority,
    ];
    expect(parts).toHaveLength(8);
    for (const p of parts) expect(p.length).toBeGreaterThan(10);
  });

  it("references the actual score in the explanation", () => {
    expect(generateMockAIFeedback(goodDay).scoreExplanation).toContain("92/100");
  });

  it("recommends the named whey shake when protein is short by >30g", () => {
    const r = generateMockAIFeedback({ ...goodDay, protein: 120 });
    expect(r.nutritionAdjustment.toLowerCase()).toContain("whey shake");
    expect(r.nutritionAdjustment).toContain("50g");
  });

  it("recommends a calorie-dense shake when calories are short by >400", () => {
    const r = generateMockAIFeedback({ ...goodDay, calories: 2500 });
    expect(r.nutritionAdjustment.toLowerCase()).toMatch(/shake|booster/);
    expect(r.nutritionAdjustment).toContain("550");
  });

  it("recommends +250 kcal when the 7-day weight trend is flat", () => {
    const r = generateMockAIFeedback({ ...goodDay, weightTrend7d: 0.2 });
    expect(r.nutritionAdjustment).toContain("250");
  });

  it("reduces load and flags overhead pressing when pain > 6", () => {
    const r = generateMockAIFeedback({ ...goodDay, sessionPainScore: 8 });
    expect(r.physicalAdjustment).toContain("15–25%");
    expect(r.physicalAdjustment.toLowerCase()).toContain("overhead");
    expect(r.tomorrowPriority.toLowerCase()).toContain("pain");
  });

  it("prescribes the breathing reset before charged conversations when stress > 7", () => {
    const r = generateMockAIFeedback({ ...goodDay, stress: 9 });
    expect(r.mentalAdjustment.toLowerCase()).toContain("breathing reset");
    expect(r.mentalAdjustment.toLowerCase()).toContain("conversation");
  });

  it("sets a next-day spending cap when unnecessary spend exceeds the limit", () => {
    const r = generateMockAIFeedback({ ...goodDay, unnecessarySpend: 80 });
    expect(r.moneyAdjustment.toLowerCase()).toContain("cap");
    expect(r.slipped).toContain("$80");
  });

  it("drops to the 10-minute minimum when skills were missed 2 days running", () => {
    const r = generateMockAIFeedback({ ...goodDay, skillMissedTwoDays: true });
    expect(r.tomorrowPriority).toContain("10-minute minimum");
  });

  it("prioritizes pain above everything else", () => {
    const r = generateMockAIFeedback({
      ...goodDay,
      sessionPainScore: 9,
      calories: 2000,
      stress: 9,
      unnecessarySpend: 200,
    });
    expect(r.tomorrowPriority.toLowerCase()).toContain("pain");
  });

  it("asks for logging when nothing was logged", () => {
    const r = generateMockAIFeedback({
      ...goodDay,
      calories: 0,
      protein: 0,
      workoutStatus: "notStarted",
      journalDone: false,
      spendingChecked: false,
      skillMinutes: 0,
      forgeScore: 0,
    });
    expect(r.tomorrowPriority.toLowerCase()).toContain("log");
  });

  it("references what was actually logged in the wins", () => {
    const r = generateMockAIFeedback(goodDay);
    expect(r.wentWell).toContain("Upper Push");
  });

  it("never passes a verdict on an in-progress day, even at 0/100", () => {
    const morning = generateMockAIFeedback({
      ...goodDay,
      scoreState: "inProgress",
      forgeScore: 0,
      calories: 0,
      protein: 0,
      workoutStatus: "notStarted",
      journalDone: false,
      spendingChecked: false,
      skillMinutes: 0,
      mobilityDone: false,
      sleepHours: 0,
    });
    expect(morning.scoreExplanation.toLowerCase()).not.toContain("rough day");
    expect(morning.scoreExplanation.toLowerCase()).toContain("in progress");
    expect(morning.scoreExplanation.toLowerCase()).toContain("not a verdict");
    // Unlogged items read as "still open", not failures.
    expect(morning.slipped.toLowerCase()).toMatch(/yet|still open/);
    expect(morning.slipped.toLowerCase()).not.toContain("didn't happen");
  });

  it("points the #1 priority at the rest of today while in progress", () => {
    const r = generateMockAIFeedback({ ...goodDay, scoreState: "inProgress", calories: 2000 });
    expect(r.tomorrowPriority).toContain("Rest of today's #1");
    expect(r.tomorrowPriority).not.toContain("Tomorrow's #1");
  });

  it("keeps verdict framing for a completed day", () => {
    const r = generateMockAIFeedback({ ...goodDay, forgeScore: 30, calories: 1500, protein: 90 });
    expect(r.scoreExplanation).toContain("Today was a 30/100");
    expect(r.tomorrowPriority).toContain("Tomorrow's #1");
  });
});
