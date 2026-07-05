import { describe, expect, it } from "vitest";
import {
  DISCLAIMERS,
  NOT_A_DIAGNOSIS,
  checkSafetyCopy,
  confidenceNote,
  possiblePattern,
} from "./safetyCopy";
import { generateMockAIFeedback, type CoachInput } from "./mockCoach";

describe("DISCLAIMERS", () => {
  it("ships the four verbatim disclaimers", () => {
    expect(DISCLAIMERS.health).toContain("does not diagnose, treat, cure, or prevent disease");
    expect(DISCLAIMERS.mentalHealth).toContain("not therapy, crisis care, or diagnosis");
    expect(DISCLAIMERS.mentalHealth).toContain("crisis hotline");
    expect(DISCLAIMERS.relationships).toContain("violence, coercion, threats, stalking, or fear");
    expect(DISCLAIMERS.finance).toContain("not professional financial, tax, legal, or investment advice");
  });

  it("the disclaimers themselves pass the forbidden-output check", () => {
    for (const text of Object.values(DISCLAIMERS)) {
      expect(checkSafetyCopy(text).ok).toBe(true);
    }
    expect(checkSafetyCopy(NOT_A_DIAGNOSIS).ok).toBe(true);
  });
});

describe("checkSafetyCopy", () => {
  it("catches diagnosis claims about the user", () => {
    expect(checkSafetyCopy("Based on this, you have NPD.").ok).toBe(false);
    expect(checkSafetyCopy("You are showing signs of borderline.").ok).toBe(false);
    expect(checkSafetyCopy("you meet the criteria for a personality disorder").ok).toBe(false);
  });

  it("catches disorder labels applied to other people", () => {
    expect(checkSafetyCopy("Your partner is a narcissist.").ok).toBe(false);
    expect(checkSafetyCopy("She is a gaslighter.").ok).toBe(false);
    expect(checkSafetyCopy("your ex is an abuser").ok).toBe(false);
  });

  it("catches abuse verdicts, stay/leave directives, and covert recording", () => {
    expect(checkSafetyCopy("This proves abuse.").ok).toBe(false);
    expect(checkSafetyCopy("You must leave them tonight.").ok).toBe(false);
    expect(checkSafetyCopy("Secretly record the next argument.").ok).toBe(false);
  });

  it("catches medication directives, shame copy, and fake certainty", () => {
    expect(checkSafetyCopy("Stop taking your medication for a week.").ok).toBe(false);
    expect(checkSafetyCopy("You failed today. No excuses.").ok).toBe(false);
    expect(checkSafetyCopy("Schedule a cheat day on Sunday.").ok).toBe(false);
    expect(checkSafetyCopy("They definitely have a disorder.").ok).toBe(false);
  });

  it("does not false-positive on the approved register", () => {
    const legit = [
      DISCLAIMERS.health,
      NOT_A_DIAGNOSIS,
      "This exchange includes repeated denial of your stated experience and a shift of responsibility back onto you. Some people experience this pattern as gaslighting-like. Consider saving the exchange and speaking with a trusted professional if this pattern repeats.",
      "Possible pattern: your highest spending days happened after low sleep and high stress.",
      "Pain was 8/10: cut loads 15–25% tomorrow, skip heavy overhead pressing.",
      "It may be useful to explore these patterns with a licensed mental-health professional.",
      "Elevated readings are worth discussing with a clinician — this is not a diagnosis.",
      "If you feel unsafe, seek professional, legal, or domestic violence support.",
    ];
    for (const text of legit) {
      const result = checkSafetyCopy(text);
      expect(result.violations).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });

  it("reports which rule matched", () => {
    const { violations } = checkSafetyCopy("Your partner is a narcissist.");
    expect(violations[0]?.rule).toBe("no-labeling-others");
  });
});

describe("register helpers", () => {
  it("possiblePattern uses the locked phrasing", () => {
    expect(possiblePattern("conflict is followed by skipped workouts.", "Try a 10-minute minimum workout on conflict days.")).toMatch(
      /^Possible pattern: /
    );
  });

  it("confidence notes are disclosed data-quality info, never accusations", () => {
    for (const level of ["low", "medium", "high"] as const) {
      const note = confidenceNote(level);
      expect(note).toMatch(/^Confidence: /);
      expect(checkSafetyCopy(note).ok).toBe(true);
      expect(note.toLowerCase()).not.toContain("lying");
      expect(note.toLowerCase()).not.toContain("dishonest");
    }
  });
});

describe("mock coach output routes clean through the safety check", () => {
  const base: CoachInput = {
    name: "Test",
    dayNumber: 12,
    forgeScore: 40,
    calories: 1800,
    calorieTarget: 3050,
    protein: 90,
    proteinTarget: 170,
    waterMl: 1000,
    waterTarget: 3000,
    workoutStatus: "notStarted",
    splitLabel: "Lower Strength",
    sessionPainScore: 8,
    sleepHours: 5,
    mobilityDone: false,
    mood: 3,
    stress: 9,
    journalDone: false,
    spendingChecked: true,
    totalSpend: 210,
    unnecessarySpend: 180,
    dailySpendingLimit: 50,
    skillMinutes: 0,
    skillMissedTwoDays: true,
    weightTrend7d: 0.1,
    scoreState: "final",
    hardDay: false,
    journalThemes: [],
  };

  it("every part passes on the harshest realistic day — final, in-progress, and hard-day", () => {
    for (const variant of [
      { ...base, scoreState: "final" as const },
      { ...base, scoreState: "inProgress" as const },
      { ...base, hardDay: true },
      { ...base, hardDay: true, scoreState: "inProgress" as const },
      { ...base, stress: 3, journalThemes: ["relationship", "money"] },
    ]) {
      const review = generateMockAIFeedback(variant);
      for (const [part, text] of Object.entries(review)) {
        const result = checkSafetyCopy(text);
        expect(result.violations, `${variant.scoreState}/hard:${variant.hardDay}/${part}: ${text}`).toEqual([]);
      }
    }
  });
});
