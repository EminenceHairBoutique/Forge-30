import { describe, expect, it } from "vitest";
import { mvdStatus, shouldShowEveningReview, shouldShowMorningPlan } from "./dayPhase";

describe("mvdStatus", () => {
  it("is met with one meal logged + the check-in", () => {
    expect(mvdStatus({ calories: 1150, protein: 65, journalDone: true })).toEqual({
      met: true,
      remaining: [],
    });
  });

  it("counts a protein-only log (e.g. a shake) as the meal", () => {
    expect(mvdStatus({ calories: 0, protein: 46, journalDone: true }).met).toBe(true);
  });

  it("lists what's still open in neutral language", () => {
    const s = mvdStatus({ calories: 0, protein: 0, journalDone: false });
    expect(s.met).toBe(false);
    expect(s.remaining).toEqual(["log one meal", "do the 2-minute check-in"]);
    for (const item of s.remaining) {
      expect(item).not.toMatch(/fail|miss|behind/i);
    }
  });

  it("requires both halves", () => {
    expect(mvdStatus({ calories: 500, protein: 20, journalDone: false }).met).toBe(false);
    expect(mvdStatus({ calories: 0, protein: 0, journalDone: true }).met).toBe(false);
  });
});

describe("ritual visibility", () => {
  it("morning plan shows once, only while the day is in progress", () => {
    expect(shouldShowMorningPlan({ morningPlanSeen: false }, "inProgress")).toBe(true);
    expect(shouldShowMorningPlan({ morningPlanSeen: true }, "inProgress")).toBe(false);
    expect(shouldShowMorningPlan({ morningPlanSeen: false }, "final")).toBe(false);
  });

  it("evening review shows after the boundary until the review exists", () => {
    expect(shouldShowEveningReview("final", false)).toBe(true);
    expect(shouldShowEveningReview("final", true)).toBe(false);
    expect(shouldShowEveningReview("inProgress", false)).toBe(false);
  });
});
