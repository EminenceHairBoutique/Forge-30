import { describe, expect, it } from "vitest";
import {
  adaptiveFromLegacy,
  generateMockAIFeedback,
  MAX_ADAPTIVE_SECTIONS,
  MIN_ADAPTIVE_SECTIONS,
  weeklyArcText,
  type CoachInput,
  type Summary30d,
} from "./mockCoach";
import { buildFollowThrough, coachStyleFromResults, compress30d } from "./coachContext";
import type { AIReview, AssessmentResult, DailyLog } from "@/lib/types";

/** A quiet, ordinary day — enough logged for the mock to have material. */
const baseInput = (over: Partial<CoachInput>): CoachInput => ({
  name: "T",
  dayNumber: 12,
  forgeScore: 68,
  calories: 2100,
  calorieTarget: 2400,
  protein: 120,
  proteinTarget: 140,
  waterMl: 2000,
  waterTarget: 2500,
  workoutStatus: "complete",
  splitLabel: "Push",
  sessionPainScore: 2,
  sleepHours: 7,
  mobilityDone: true,
  mood: 7,
  stress: 4,
  journalDone: true,
  spendingChecked: true,
  totalSpend: 20,
  unnecessarySpend: 5,
  dailySpendingLimit: 50,
  skillMinutes: 20,
  skillMissedTwoDays: false,
  weightTrend7d: 0,
  scoreState: "final",
  hardDay: false,
  journalThemes: [],
  ...over,
});

const summary: Summary30d = {
  daysLogged: 24,
  avgScore: 71,
  workoutDays: 14,
  proteinHitRate: 0.7,
  avgSleep: 7.1,
  avgStress: 4.2,
  journalDays: 18,
  skillMinutes: 420,
  overspendDays: 3,
};

describe("adaptiveFromLegacy (v3 Phase 5)", () => {
  it("returns 3–6 sections, scoreExplanation always first, priority always present", () => {
    const input = baseInput({});
    const adaptive = adaptiveFromLegacy(generateMockAIFeedback(input), input);
    expect(adaptive.sections.length).toBeGreaterThanOrEqual(MIN_ADAPTIVE_SECTIONS);
    expect(adaptive.sections.length).toBeLessThanOrEqual(MAX_ADAPTIVE_SECTIONS);
    expect(adaptive.sections[0]?.key).toBe("scoreExplanation");
    expect(adaptive.tomorrowPriority.length).toBeGreaterThan(0);
  });

  it("is deterministic: same input, same sections", () => {
    const input = baseInput({ stress: 8, protein: 60 });
    const a = adaptiveFromLegacy(generateMockAIFeedback(input), input);
    const b = adaptiveFromLegacy(generateMockAIFeedback(input), input);
    expect(a).toEqual(b);
  });

  it("never audits 'slipped' on hard days or mid-day", () => {
    for (const over of [{ hardDay: true }, { scoreState: "inProgress" as const }]) {
      const input = baseInput(over);
      const adaptive = adaptiveFromLegacy(generateMockAIFeedback(input), input);
      expect(adaptive.sections.some((s) => s.key === "slipped")).toBe(false);
    }
  });

  it("BP crisis always earns the health section", () => {
    const input = baseInput({ bpCrisis: true, elevatedBpCount: 1 });
    const adaptive = adaptiveFromLegacy(generateMockAIFeedback(input), input);
    expect(adaptive.sections.some((s) => s.key === "healthAdjustment")).toBe(true);
  });

  it("patternInsight rides only when patterns exist; weeklyArc only on Sunday", () => {
    const plain = adaptiveFromLegacy(generateMockAIFeedback(baseInput({})), baseInput({}));
    expect(plain.sections.some((s) => s.key === "patternInsight")).toBe(false);
    expect(plain.sections.some((s) => s.key === "weeklyArc")).toBe(false);

    const sunday = baseInput({ isSunday: true, summary30d: summary, patterns: ["Possible pattern: x."] });
    const arc = adaptiveFromLegacy(generateMockAIFeedback(sunday), sunday);
    expect(arc.sections.some((s) => s.key === "weeklyArc")).toBe(true);
    expect(arc.sections.some((s) => s.key === "patternInsight")).toBe(true);
    expect(weeklyArcText(sunday)).toContain("24 days logged");
  });
});

describe("coach memory builders", () => {
  const log = (date: string, over: Partial<DailyLog>): DailyLog => ({
    date,
    forgeScore: 70,
    calories: 2200,
    protein: 135,
    carbs: 200,
    fats: 70,
    waterMl: 2500,
    workoutStatus: "complete",
    steps: 8000,
    sleepHours: 7,
    mobilityDone: true,
    spendingChecked: true,
    mood: 7,
    stress: 4,
    painScore: 1,
    skillMinutes: 15,
    journalDone: true,
    calendarState: "complete",
    ...over,
  });

  it("compress30d summarizes only what was logged", () => {
    const s = compress30d(
      [log("2026-07-01", {}), log("2026-07-02", { protein: 100 }), log("2026-07-03", { calories: 0, mood: 0, workoutStatus: "notStarted", forgeScore: 0, sleepHours: 0, stress: 0, journalDone: false, skillMinutes: 0 })],
      140,
      50
    );
    expect(s.daysLogged).toBe(2);
    expect(s.workoutDays).toBe(2);
    expect(s.avgScore).toBe(70);
    expect(s.proteinHitRate).toBe(0.5); // 135 hits 0.9×140=126; 100 misses
    expect(s.journalDays).toBe(2);
  });

  it("buildFollowThrough pairs each review with the NEXT day's data, last 7 only", () => {
    const reviews = Array.from({ length: 9 }, (_, i) => ({
      id: `r${i}`,
      date: `2026-06-${String(10 + i).padStart(2, "0")}`,
      source: "mock",
      scoreExplanation: "",
      wentWell: "",
      slipped: "",
      physicalAdjustment: "",
      nutritionAdjustment: "",
      moneyAdjustment: "",
      mentalAdjustment: "",
      tomorrowPriority: `P${i}`,
      createdAt: "2026-06-10T20:00:00.000Z",
    })) as AIReview[];
    const logs = [log("2026-06-19", { forgeScore: 55 })];
    const ft = buildFollowThrough(reviews, logs);
    expect(ft).toHaveLength(7);
    expect(ft[0]?.priority).toBe("P8"); // newest first
    const paired = ft.find((f) => f.date === "2026-06-18");
    expect(paired?.nextDayLogged).toBe(true);
    expect(paired?.nextDayScore).toBe(55);
    const unpaired = ft.find((f) => f.date === "2026-06-16");
    expect(unpaired?.nextDayLogged).toBe(false);
    expect(unpaired?.nextDayScore).toBeNull();
  });

  it("coachStyleFromResults maps the latest coachingStyle result to tone dials", () => {
    const result = (createdAt: string, band: "low" | "high"): AssessmentResult => ({
      id: `a-${createdAt}`,
      assessmentId: "coachingStyle",
      date: "2026-07-01",
      traits: ["directness", "structure", "push", "dataOrientation"].map((key) => ({
        key,
        label: key,
        score: band === "high" ? 80 : 20,
        band,
        summary: "",
      })),
      validity: {
        attentionFailed: 0,
        attentionTotal: 1,
        inconsistency: 0,
        acquiescence: 0.5,
        idealization: 0,
        speedFlag: false,
        confidence: 100,
        confidenceLevel: "high",
        notes: [],
      },
      createdAt,
    });
    expect(coachStyleFromResults([])).toBeNull();
    const prefs = coachStyleFromResults([
      result("2026-07-01T10:00:00.000Z", "low"),
      result("2026-07-04T10:00:00.000Z", "high"),
    ]);
    expect(prefs).toEqual({ directness: "high", structure: "high", push: "high", dataOrientation: "high" });
  });
});
