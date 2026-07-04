import { describe, expect, it } from "vitest";
import {
  COACH_MODES,
  journalReflectionMode,
  patternReviewMode,
  relationshipDebriefMode,
  tomorrowPlanMode,
  weeklyReviewMode,
} from "./coachModes";
import { checkSafetyCopy } from "./safetyCopy";
import type { ConflictDebrief, TomorrowPlan, UserProfile, WeeklySummary } from "@/lib/types";
import type { DetectedPattern } from "./lifeGraph";

const profile = {
  name: "Test",
  startDate: "2026-07-01",
  calorieTarget: 2400,
  proteinTarget: 140,
  waterTarget: 2500,
  weightGoal: "Maintain current weight",
  dailySpendingLimit: 50,
} as UserProfile;

describe("mode registry", () => {
  it("covers all seven modes with daily review first", () => {
    expect(COACH_MODES).toHaveLength(7);
    expect(COACH_MODES[0]!.id).toBe("dailyReview");
    const ids = COACH_MODES.map((m) => m.id);
    for (const id of [
      "weeklyReview",
      "tomorrowPlan",
      "hardDay",
      "relationshipDebrief",
      "journalReflection",
      "patternReview",
    ]) {
      expect(ids).toContain(id);
    }
  });
});

describe("weeklyReviewMode", () => {
  const summary: WeeklySummary = {
    weekStart: "2026-06-29",
    weekEnd: "2026-07-05",
    avgCalories: 2350,
    avgProtein: 138,
    weightTrendLb: 0.4,
    workoutCompletionPct: 80,
    prCount: 1,
    spendingTotal: 210,
    unnecessarySpendingTotal: 40,
    avgStress: 5,
    avgSleep: 7.1,
    avgForgeScore: 78,
    mostMissedHabit: "mobility",
  };

  it("renders summary, numbers, and the most-missed habit neutrally", () => {
    const sections = weeklyReviewMode(summary, profile);
    expect(sections.length).toBeGreaterThanOrEqual(3);
    const habit = sections.find((s) => s.label.toLowerCase().includes("missed"))!;
    expect(habit.text).toContain("mobility");
    expect(habit.text.toLowerCase()).toContain("not a verdict");
    for (const s of sections) expect(checkSafetyCopy(s.text).violations).toEqual([]);
  });

  it("empty week → gentle empty state, no fake numbers", () => {
    const sections = weeklyReviewMode(null, profile);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.text.toLowerCase()).toContain("not enough");
  });
});

describe("tomorrowPlanMode", () => {
  it("reads a plan back with focus, meals, and spending intention", () => {
    const plan: TomorrowPlan = {
      date: "2026-07-05",
      focus: "protein before 2pm",
      intendedMeals: ["eggs + oats", "chicken bowl"],
      spendingIntention: 20,
      createdAt: "2026-07-04T21:00:00.000Z",
    };
    const sections = tomorrowPlanMode(plan);
    expect(sections[0]!.text).toContain("protein before 2pm");
    expect(sections.some((s) => s.text.includes("chicken bowl"))).toBe(true);
    expect(sections.some((s) => s.text.includes("$20"))).toBe(true);
  });

  it("no plan → points at the flow, never invents one", () => {
    const sections = tomorrowPlanMode(null);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.text.toLowerCase()).toContain("plan");
  });
});

describe("relationshipDebriefMode", () => {
  it("wraps debriefSupport output in coach sections, safety-clean", () => {
    const debrief: ConflictDebrief = {
      id: "d1",
      date: "2026-07-03",
      whatHappened: "argument about chores",
      whatIFelt: "unheard",
      whatINeeded: "acknowledgment",
      whatTheyMayHaveNeeded: "rest",
      didWell: "stayed calm at first",
      didPoorly: "raised my voice",
      repairAttempt: "",
      boundaryNeeded: "",
      nextCalmMessage: "",
      createdAt: "2026-07-03T20:00:00.000Z",
    };
    const sections = relationshipDebriefMode(debrief);
    expect(sections.some((s) => s.label === "Repair language")).toBe(true);
    for (const s of sections) {
      expect(checkSafetyCopy(s.text).violations).toEqual([]);
      expect(s.text.toLowerCase()).not.toMatch(/toxic|narcissist|their fault/);
    }
  });

  it("no debrief → doorway copy", () => {
    expect(relationshipDebriefMode(null)[0]!.text.toLowerCase()).toContain("relationships tab");
  });
});

describe("journalReflectionMode — consent gate", () => {
  it("without consent it explains and NEVER renders journal content", () => {
    const sections = journalReflectionMode(false, {
      entryCount: 5,
      daysWithEntries: 4,
      topThemes: [{ theme: "work", count: 3 }],
      topTags: [],
      thoughtRecords: 1,
      lines: ["stress came up in 3 of 5 entries"],
    });
    expect(sections).toHaveLength(1);
    expect(sections[0]!.text.toLowerCase()).toContain("off");
    expect(JSON.stringify(sections)).not.toContain("stress came up");
  });

  it("with consent it renders the deterministic observations + attribution", () => {
    const sections = journalReflectionMode(true, {
      entryCount: 5,
      daysWithEntries: 4,
      topThemes: [{ theme: "work", count: 3 }],
      topTags: [],
      thoughtRecords: 1,
      lines: ["stress came up in 3 of 5 entries"],
    });
    expect(sections.some((s) => s.text.includes("stress came up"))).toBe(true);
    expect(sections.some((s) => s.text.toLowerCase().includes("journal privacy"))).toBe(true);
  });
});

describe("patternReviewMode", () => {
  it("renders detected patterns with the honesty caveat, max three", () => {
    const p = (id: string, share: number): DetectedPattern => ({
      id,
      window: 30,
      qualifyingDays: 8,
      hits: Math.round(share * 8),
      share,
      line: `Possible pattern: on ${Math.round(share * 8)} of your 8 high-stress days in the last 30 days, a stress purchase got logged. Park the next one.`,
      journalInformed: false,
    });
    const sections = patternReviewMode([p("a", 1), p("b", 0.9), p("c", 0.8), p("d", 0.7)]);
    expect(sections).toHaveLength(3);
    expect(sections[0]!.text).toContain("not causation");
  });

  it("empty → explains the guard instead of inventing patterns", () => {
    const sections = patternReviewMode([]);
    expect(sections[0]!.text.toLowerCase()).toContain("five qualifying days");
  });
});
