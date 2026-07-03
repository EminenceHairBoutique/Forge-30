import { describe, expect, it } from "vitest";
import { mvdStatus, shouldShowEveningReview, shouldShowMorningPlan, type MvdLog } from "./dayPhase";

/** Full MvdLog fixture; override just what a test cares about. */
function log(overrides: Partial<MvdLog> = {}): MvdLog {
  return {
    calories: 0,
    protein: 0,
    journalDone: false,
    waterMl: 0,
    workoutStatus: "notStarted",
    steps: 0,
    ...overrides,
  };
}

describe("mvdStatus — default definition", () => {
  it("is met with one meal logged + the check-in", () => {
    expect(mvdStatus(log({ calories: 1150, protein: 65, journalDone: true }))).toEqual({
      met: true,
      remaining: [],
    });
  });

  it("counts a protein-only log (e.g. a shake) as the meal", () => {
    expect(mvdStatus(log({ protein: 46, journalDone: true })).met).toBe(true);
  });

  it("lists what's still open in neutral language", () => {
    const s = mvdStatus(log());
    expect(s.met).toBe(false);
    expect(s.remaining).toEqual(["log one meal", "do the 2-minute check-in"]);
    for (const item of s.remaining) {
      expect(item).not.toMatch(/fail|miss|behind/i);
    }
  });

  it("requires both halves", () => {
    expect(mvdStatus(log({ calories: 500, protein: 20 })).met).toBe(false);
    expect(mvdStatus(log({ journalDone: true })).met).toBe(false);
  });
});

describe("mvdStatus — user-defined MVD (E5)", () => {
  it("honors a custom definition with water + movement", () => {
    const def = { meal: false, checkIn: false, water: true, movement: true };
    expect(mvdStatus(log(), def).remaining).toEqual([
      "log some water",
      "move a little — any workout or a walk",
    ]);
    expect(mvdStatus(log({ waterMl: 500, steps: 2000 }), def).met).toBe(true);
  });

  it("counts a rest day as movement — recovery is a plan, not a miss", () => {
    const def = { meal: false, checkIn: false, water: false, movement: true };
    expect(mvdStatus(log({ workoutStatus: "rest" }), def).met).toBe(true);
  });

  it("an all-unchecked definition falls back to the default, never trivially met", () => {
    const empty = { meal: false, checkIn: false, water: false, movement: false };
    const s = mvdStatus(log(), empty);
    expect(s.met).toBe(false);
    expect(s.remaining).toContain("log one meal");
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
