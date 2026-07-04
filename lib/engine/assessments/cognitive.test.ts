import { describe, expect, it } from "vitest";
import { COGNITIVE_SKILLS } from "./bankWave2";
import { getAssessmentDef } from "./bank";
import { computeValidity, scoreAssessment, timedItemScore } from "./scoring";
import type { TimedQuestion } from "./defs";
import { checkSafetyCopy } from "../safetyCopy";

const timedItems = COGNITIVE_SKILLS.questions.filter(
  (q): q is TimedQuestion => q.kind === "timed"
);

/** Answer every timed item with `score`, attention checks correctly. */
function answersWith(score: number): Record<string, number> {
  const a: Record<string, number> = {};
  for (const q of COGNITIVE_SKILLS.questions) {
    a[q.id] = q.kind === "attention" ? q.expected : score;
  }
  return a;
}

describe("timedItemScore", () => {
  it("wrong or unanswered = 0, regardless of speed", () => {
    expect(timedItemScore(false, 100, 10000)).toBe(0);
    expect(timedItemScore(false, 9999, 10000)).toBe(0);
  });

  it("correct = 40 baseline + speed credit, monotonic in speed", () => {
    expect(timedItemScore(true, 0, 10000)).toBe(100);
    expect(timedItemScore(true, 10000, 10000)).toBe(40); // at the limit
    expect(timedItemScore(true, 5000, 10000)).toBe(70); // halfway
    const fast = timedItemScore(true, 2000, 10000);
    const slow = timedItemScore(true, 8000, 10000);
    expect(fast).toBeGreaterThan(slow);
  });

  it("is clamped and deterministic", () => {
    expect(timedItemScore(true, 20000, 10000)).toBe(40); // overtime but correct
    expect(timedItemScore(true, 3000, 10000)).toBe(timedItemScore(true, 3000, 10000));
  });
});

describe("cognitive skills scoring", () => {
  it("is registered, has 4 traits each with 3 timed items", () => {
    expect(getAssessmentDef("cognitiveSkills")).toBe(COGNITIVE_SKILLS);
    expect(COGNITIVE_SKILLS.traits).toHaveLength(4);
    for (const trait of COGNITIVE_SKILLS.traits) {
      expect(timedItems.filter((q) => q.trait === trait.key)).toHaveLength(3);
    }
    // Every option list actually contains the correct index.
    for (const q of timedItems) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
    }
  });

  it("trait scores are the mean of runner-recorded 0–100 item scores", () => {
    const r = scoreAssessment({
      def: COGNITIVE_SKILLS,
      answers: answersWith(80),
      timingsMs: [],
      id: "c1",
      date: "2026-07-04",
      createdAt: "2026-07-04T12:00:00.000Z",
    });
    for (const t of r.traits) {
      expect(t.score).toBe(80);
      expect(t.band).toBe("high");
    }
    const zero = scoreAssessment({
      def: COGNITIVE_SKILLS,
      answers: answersWith(0),
      timingsMs: [],
      id: "c2",
      date: "2026-07-04",
      createdAt: "2026-07-04T12:00:00.000Z",
    });
    for (const t of zero.traits) expect(t.score).toBe(0);
  });

  it("timed answers never pollute likert validity signals (speed/straight-lining/acquiescence)", () => {
    // All timed items answered 100 (fast + correct) — none of that should read
    // as acquiescence, idealization, straight-lining, or a speed flag.
    const v = computeValidity(COGNITIVE_SKILLS, answersWith(100), []);
    expect(v.speedFlag).toBe(false);
    expect(v.acquiescence).toBe(0);
    expect(v.idealization).toBe(0);
    expect(v.confidence).toBe(100);
    expect(v.attentionFailed).toBe(0);
  });

  it("carries the verbatim not-an-IQ-test label in intro and result note", () => {
    const line = "This is not a formal IQ test. It is a self-improvement-oriented cognitive skills profile";
    expect(COGNITIVE_SKILLS.introNote).toContain(line);
    expect(COGNITIVE_SKILLS.resultNote).toContain(line);
  });

  it("all copy is safety-clean and band copy never shames a low score", () => {
    expect(checkSafetyCopy(COGNITIVE_SKILLS.resultNote).violations).toEqual([]);
    for (const t of COGNITIVE_SKILLS.traits) {
      for (const text of [t.blurb, t.low, t.high, t.balanced]) {
        expect(checkSafetyCopy(text).violations).toEqual([]);
      }
      expect(t.low.toLowerCase()).not.toMatch(/stupid|dumb|deficit|below average|iq/);
    }
  });
});
