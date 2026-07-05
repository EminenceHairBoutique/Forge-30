import { describe, expect, it } from "vitest";
import { COACHING_STYLE } from "./coachingStyle";
import { scoreAssessment, supportTriggered } from "./scoring";
import { checkSafetyCopy } from "@/lib/engine/safetyCopy";
import type { AssessmentDef } from "./defs";

/**
 * Coaching Style & Values (v3 §A3 replacement): preferences that tune the
 * coach — never clinical, never a score of the person. These tests pin the
 * register and the scoring plumbing, plus the generic support routing that
 * moved into scoring.ts when the removed screeners left.
 */

const answersAt = (value: number): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const q of COACHING_STYLE.questions) {
    out[q.id] = q.kind === "attention" ? q.expected : value;
  }
  return out;
};

describe("coaching style assessment", () => {
  it("is a short, non-clinical preferences bank (10–15 items)", () => {
    expect(COACHING_STYLE.questions.length).toBeGreaterThanOrEqual(10);
    expect(COACHING_STYLE.questions.length).toBeLessThanOrEqual(15);
    expect(COACHING_STYLE.introNote).toContain("tunes your coach, not you");
    // No item carries a self-harm support flag — this bank has no clinical reach.
    expect(COACHING_STYLE.questions.some((q) => q.kind === "likert" && q.supportFlag)).toBe(false);
  });

  it("scores each dial from its own items, with reverse-coding honored", () => {
    const result = scoreAssessment({
      def: COACHING_STYLE,
      answers: answersAt(5),
      timingsMs: [3000, 3000, 3000, 3000, 3000],
      id: "t1",
      date: "2026-07-05",
      createdAt: "2026-07-05T10:00:00.000Z",
    });
    expect(result.traits).toHaveLength(4);
    // All-5s with reverse items present lands each dial mid-high, not maxed.
    for (const t of result.traits) {
      expect(t.score).toBeGreaterThan(50);
      expect(t.score).toBeLessThan(100);
    }
  });

  it("keeps the preferences register — no diagnosis, no verdicts on the person", () => {
    const copy = [
      COACHING_STYLE.tagline,
      COACHING_STYLE.introNote ?? "",
      COACHING_STYLE.resultNote,
      ...COACHING_STYLE.traits.flatMap((t) => [t.blurb, t.low, t.high, t.balanced]),
    ].join(" ");
    expect(checkSafetyCopy(copy).violations).toEqual([]);
    // "diagnoses" appears only inside the explicit not-a-diagnosis disclaimer
    // (which checkSafetyCopy vets); clinical labels never appear at all.
    expect(copy.toLowerCase()).not.toContain("disorder");
    expect(copy.toLowerCase()).not.toContain("screening");
  });
});

describe("support routing (generic, in scoring.ts)", () => {
  const flaggedDef: AssessmentDef = {
    id: "traumaCoping",
    name: "x",
    tagline: "x",
    minutes: 1,
    kind: "likert",
    traits: [{ key: "k", label: "K", blurb: "b", low: "l", high: "h", balanced: "m" }],
    resultNote: "x",
    questions: [
      { id: "q1", kind: "likert", trait: "k", text: "plain item" },
      { id: "q2", kind: "likert", trait: "k", text: "flagged item", supportFlag: true },
    ],
  };

  it("fires only on an elevated flagged answer", () => {
    expect(supportTriggered(flaggedDef, {})).toBe(false);
    expect(supportTriggered(flaggedDef, { q1: 5 })).toBe(false);
    expect(supportTriggered(flaggedDef, { q2: 3 })).toBe(false);
    expect(supportTriggered(flaggedDef, { q2: 4 })).toBe(true);
    expect(supportTriggered(flaggedDef, { q2: 5 })).toBe(true);
  });
});
