import { describe, expect, it } from "vitest";
import { EMOTIONAL_INTELLIGENCE, TRAUMA_COPING } from "./bankWave2";
import { getAssessmentDef } from "./bank";
import { scoreAssessment } from "./scoring";
import type { LikertQuestion } from "./defs";
import { checkSafetyCopy } from "../safetyCopy";

const DEFS = [EMOTIONAL_INTELLIGENCE, TRAUMA_COPING];

/** Answer every visible question with `v` (attention checks answered right). */
function answersAll(def: (typeof DEFS)[number], v: number): Record<string, number> {
  const a: Record<string, number> = {};
  for (const q of def.questions) a[q.id] = q.kind === "attention" ? q.expected : v;
  return a;
}

describe("wave 2 bank integrity", () => {
  it("both assessments are registered in the bank", () => {
    expect(getAssessmentDef("emotionalIntelligence")).toBe(EMOTIONAL_INTELLIGENCE);
    expect(getAssessmentDef("traumaCoping")).toBe(TRAUMA_COPING);
  });

  for (const def of DEFS) {
    it(`${def.id}: unique ids, ≥2 attention checks, every trait has items incl. a reverse`, () => {
      const ids = def.questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(def.questions.filter((q) => q.kind === "attention").length).toBeGreaterThanOrEqual(2);
      for (const trait of def.traits) {
        const items = def.questions.filter(
          (q): q is LikertQuestion => q.kind === "likert" && q.trait === trait.key
        );
        expect(items.length, `${def.id}/${trait.key}`).toBeGreaterThanOrEqual(2);
        // Mirrored-pair material for the validity system: ≥1 reverse + ≥1 forward.
        expect(items.some((q) => q.reverse), `${def.id}/${trait.key} reverse`).toBe(true);
        expect(items.some((q) => !q.reverse), `${def.id}/${trait.key} forward`).toBe(true);
      }
    });
  }
});

describe("wave 2 scoring", () => {
  it("is deterministic and reverse-codes: all-agree ≠ 100 on traits with reverse items", () => {
    for (const def of DEFS) {
      const args = {
        def,
        answers: answersAll(def, 5),
        timingsMs: [2000, 2100, 2200, 2000, 2300],
        id: "r1",
        date: "2026-07-04" as const,
        createdAt: "2026-07-04T12:00:00.000Z",
      };
      const a = scoreAssessment(args);
      const b = scoreAssessment(args);
      expect(a).toEqual(b);
      // Every trait has ≥1 reverse item, so uniform max agreement lands mid-range.
      for (const t of a.traits) {
        expect(t.score, `${def.id}/${t.key}`).toBeLessThan(100);
        expect(t.score).toBeGreaterThan(0);
      }
    }
  });

  it("neutral answers land in the balanced band with its copy", () => {
    const r = scoreAssessment({
      def: EMOTIONAL_INTELLIGENCE,
      answers: answersAll(EMOTIONAL_INTELLIGENCE, 3),
      timingsMs: [2000, 2000, 2000, 2000, 2000],
      id: "r2",
      date: "2026-07-04",
      createdAt: "2026-07-04T12:00:00.000Z",
    });
    for (const t of r.traits) {
      expect(t.band).toBe("balanced");
      expect(t.summary.length).toBeGreaterThan(0);
    }
  });
});

describe("wave 2 register (safetyCopy-enforced)", () => {
  it("every blurb, band copy, and result note is safety-clean", () => {
    for (const def of DEFS) {
      expect(checkSafetyCopy(def.resultNote).violations).toEqual([]);
      for (const t of def.traits) {
        for (const text of [t.blurb, t.low, t.high, t.balanced]) {
          expect(checkSafetyCopy(text).violations, `${def.id}/${t.key}`).toEqual([]);
        }
      }
    }
  });

  it("trauma profile never claims a diagnosis and routes to professional support", () => {
    expect(TRAUMA_COPING.resultNote.toLowerCase()).toContain("cannot assess or rule out ptsd");
    expect(TRAUMA_COPING.resultNote.toLowerCase()).toContain("licensed clinician");
    expect(TRAUMA_COPING.resultNote.toLowerCase()).toContain("therapist");
    for (const t of TRAUMA_COPING.traits) {
      expect(`${t.high} ${t.low} ${t.balanced}`.toLowerCase()).not.toMatch(
        /you have (?:ptsd|cptsd|trauma disorder)|diagnos/
      );
    }
  });

  it("EQ empathy copy renders the cognitive-vs-affective distinction", () => {
    const empathy = EMOTIONAL_INTELLIGENCE.traits.find((t) => t.key === "empathy")!;
    const all = `${empathy.blurb} ${empathy.high}`;
    expect(all).toContain("cognitive");
    expect(all).toContain("affective");
  });
});
