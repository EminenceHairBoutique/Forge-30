import { describe, expect, it } from "vitest";
import {
  PATTERN_LIBRARY,
  analyzeThread,
  checkInInsight,
  couplesComparison,
  debriefSupport,
  redactThread,
} from "./relationshipRules";
import { checkSafetyCopy } from "./safetyCopy";
import { PROMPT_DECKS, MICRO_LESSONS, SAFETY_RESOURCES } from "@/lib/data/relationships";
import type { AssessmentResult, ConflictDebrief, RelationshipCheckIn } from "@/lib/types";

const THREAD = `
Them: You're overreacting, it's not a big deal
Me: I told you this bothers me
Them: After everything I've done for you
Them: I never said that. You're making it up
Them: You're the one who ruins everything
Me: I already said no
Them: Come on, just this once
Me: I'm sorry, can we start over?
Them: That makes sense, I hear you
Them: That was on me, I was wrong
`;

describe("analyzeThread — pattern vocabulary", () => {
  const analysis = analyzeThread(THREAD);
  const keys = analysis.findings.map((f) => f.key);

  it("detects the unhealthy patterns present, with counts and quoted lines", () => {
    expect(keys).toEqual(expect.arrayContaining(["invalidation", "guiltTripping", "darvoLike", "boundaryPressure"]));
    const inval = analysis.findings.find((f) => f.key === "invalidation")!;
    expect(inval.count).toBeGreaterThanOrEqual(1);
    expect(inval.examples[0]).toContain("overreacting");
  });

  it("detects the healthy side with equal standing", () => {
    expect(keys).toEqual(expect.arrayContaining(["repairAttempt", "validation", "accountability"]));
    expect(analysis.healthyLines.length).toBeGreaterThanOrEqual(3);
  });

  it("uses the locked register: Possible pattern, never verdicts, never labels", () => {
    for (const line of [...analysis.summaryLines, ...analysis.healthyLines]) {
      expect(checkSafetyCopy(line).violations, line).toEqual([]);
    }
    expect(analysis.summaryLines.every((l) => l.startsWith("Possible pattern:"))).toBe(true);
    const all = analysis.summaryLines.join(" ").toLowerCase();
    expect(all).not.toMatch(/narcissist|borderline|abuser|toxic person|they are manipulative/);
  });

  it("clean threads produce no findings; control language sets abuseIndicators", () => {
    expect(analyzeThread("Want pizza tonight?\nSure, 7pm?").findings).toEqual([]);
    const control = analyzeThread("You're not allowed to see your friends\nIf you leave, I'll take the money");
    expect(control.abuseIndicators).toBe(true);
    expect(control.findings.some((f) => f.key === "coerciveControl")).toBe(true);
  });

  it("every library entry has safety-clean explanation and suggestion", () => {
    for (const def of PATTERN_LIBRARY) {
      expect(checkSafetyCopy(def.explanation).violations, def.key).toEqual([]);
      expect(checkSafetyCopy(def.suggestion).violations, def.key).toEqual([]);
    }
  });
});

describe("redactThread", () => {
  it("strips emails, phones, links, and replaces given names", () => {
    const out = redactThread(
      "Call me at 555-123-4567 or mail sam.doe@mail.com — https://example.com/x\nSam said Alex was late. sam agreed.",
      ["Sam", "Alex"]
    );
    expect(out).not.toMatch(/555-123-4567|sam\.doe@mail\.com|example\.com/);
    expect(out).toContain("[phone]");
    expect(out).toContain("[email]");
    expect(out).toContain("[link]");
    expect(out).toContain("Person A said Person B was late. Person A agreed.");
  });
});

describe("debriefSupport", () => {
  const debrief: ConflictDebrief = {
    id: "d1",
    date: "2026-07-01",
    whatHappened: "We argued about the dishes and it spiraled",
    whatIFelt: "dismissed and tired",
    whatINeeded: "acknowledgment that I'd had a long day too",
    whatTheyMayHaveNeeded: "a break before talking logistics",
    didWell: "kept my voice level",
    didPoorly: "said 'you're being dramatic' which I regret",
    repairAttempt: "",
    boundaryNeeded: "no logistics talks after 10pm",
    nextCalmMessage: "",
    createdAt: "2026-07-01T21:00:00.000Z",
  };

  it("echoes the user's own account and finds patterns in their words", () => {
    const s = debriefSupport(debrief);
    expect(s.summary).toContain("dismissed and tired");
    // The user's own "you're being dramatic" gets named as invalidation.
    expect(s.patterns.join(" ")).toMatch(/invalidation/i);
    expect(s.calmMessage).toContain("dismissed and tired");
    expect(s.boundarySuggestion).toContain("no logistics talks after 10pm");
  });

  it("every output field is safety-clean — never diagnoses either person", () => {
    const s = debriefSupport(debrief);
    for (const text of [s.summary, ...s.patterns, s.repairLanguage, s.calmMessage, s.pauseSuggestion, s.boundarySuggestion]) {
      expect(checkSafetyCopy(text).violations, text).toEqual([]);
    }
  });
});

describe("couplesComparison — never a verdict", () => {
  function result(scores: Record<string, number>, ranking?: string[]): AssessmentResult {
    return {
      id: Math.random().toString(36).slice(2),
      assessmentId: "bigFive",
      date: "2026-07-01",
      traits: Object.entries(scores).map(([key, score]) => ({
        key,
        label: key,
        score,
        band: "balanced" as const,
        summary: "",
      })),
      ...(ranking ? { ranking } : {}),
      validity: {
        attentionFailed: 0, attentionTotal: 0, inconsistency: 0, acquiescence: 0,
        idealization: 0, speedFlag: false, confidence: 90, confidenceLevel: "high" as const, notes: [],
      },
      createdAt: "2026-07-01T10:00:00.000Z",
    };
  }

  it("splits traits into similarities and understand-the-difference gaps", () => {
    const cmp = couplesComparison(
      result({ openness: 80, extraversion: 20 }, ["health", "freedom", "family"]),
      result({ openness: 75, extraversion: 70 }, ["health", "wealth", "adventure"])
    );
    expect(cmp.similarities.join(" ")).toContain("openness");
    expect(cmp.differences.join(" ")).toContain("extraversion");
    expect(cmp.discussionPrompts.length).toBeGreaterThan(0);
    expect(cmp.frictionPoints.length).toBeGreaterThan(0);
  });

  it("never emits compatible/incompatible verdicts, all copy safety-clean", () => {
    const cmp = couplesComparison(result({ a: 90 }), result({ a: 10 }));
    const all = [...cmp.similarities, ...cmp.differences, ...cmp.discussionPrompts, ...cmp.frictionPoints];
    for (const line of all) {
      expect(line.toLowerCase()).not.toMatch(/\bincompatible\b|\bcompatible\b|meant to be|doomed|wrong for each other/);
      expect(checkSafetyCopy(line).violations).toEqual([]);
    }
  });
});

describe("checkInInsight — abuse-indicator escalation", () => {
  function checkIn(overrides: Partial<RelationshipCheckIn>): RelationshipCheckIn {
    return {
      id: Math.random().toString(36).slice(2), date: "2026-07-01", mode: "relationship",
      connection: 7, communication: 7, conflict: false, repairAttempt: false,
      appreciationExpressed: true, boundaryRespected: true, feelingHeard: 7, feelingSafe: 9,
      note: "", createdAt: "2026-07-01T20:00:00.000Z",
      ...overrides,
    };
  }

  it("low felt-safety escalates to safety resources", () => {
    const insight = checkInInsight([checkIn({ feelingSafe: 3 }), checkIn({})]);
    expect(insight.escalateSafety).toBe(true);
    expect(insight.lines.join(" ")).toMatch(/confidential/);
  });

  it("normal check-ins never escalate; repeated unrepaired conflict gets a neutral nudge", () => {
    expect(checkInInsight([checkIn({}), checkIn({})]).escalateSafety).toBe(false);
    const insight = checkInInsight([
      checkIn({ conflict: true }),
      checkIn({ conflict: true }),
      checkIn({}),
    ]);
    expect(insight.lines.join(" ")).toMatch(/Possible pattern/);
    for (const line of insight.lines) {
      expect(checkSafetyCopy(line).violations).toEqual([]);
    }
  });
});

describe("seeded content is safety-clean", () => {
  it("every prompt, lesson point, and resource passes the safety check", () => {
    const texts = [
      ...PROMPT_DECKS.flatMap((d) => d.prompts),
      ...MICRO_LESSONS.flatMap((l) => l.points),
      ...SAFETY_RESOURCES.map((r) => `${r.name} ${r.detail}`),
    ];
    expect(texts.length).toBeGreaterThan(80);
    for (const t of texts) {
      expect(checkSafetyCopy(t).violations, t).toEqual([]);
    }
  });
});
