import { describe, expect, it } from "vitest";
import {
  CLUSTER_B,
  CLUSTER_B_INTRO,
  EVALUATION_PATHWAY,
  IMPRESSION_MANAGEMENT_NOTE,
  SUPPORT_TRIGGER_LEVEL,
  clinicianReportText,
  journalAnnotation,
  overlapView,
  supportTriggered,
} from "./clusterB";
import { getAssessmentDef } from "./bank";
import { computeValidity, scoreAssessment } from "./scoring";
import type { LikertQuestion } from "./defs";
import { checkSafetyCopy } from "../safetyCopy";

const flagged = CLUSTER_B.questions.filter(
  (q): q is LikertQuestion => q.kind === "likert" && q.supportFlag === true
);

function score(answers: Record<string, number>, timings = [2000, 2100, 2000, 2200, 2050]) {
  return scoreAssessment({
    def: CLUSTER_B,
    answers,
    timingsMs: timings,
    id: "cb1",
    date: "2026-07-04",
    createdAt: "2026-07-04T12:00:00.000Z",
  });
}

function answersAll(v: number, overrides: Record<string, number> = {}): Record<string, number> {
  const a: Record<string, number> = {};
  for (const q of CLUSTER_B.questions) a[q.id] = q.kind === "attention" ? q.expected : v;
  return { ...a, ...overrides };
}

/*
 * THE FIRST-SHIPPED RULE: self-harm-adjacent routing. Per the addendum this
 * test exists before anything else in the scale — support surfaces on an
 * elevated flagged answer, immediately, mid-run, unconditionally.
 */
describe("self-harm-adjacent support routing (ships first)", () => {
  it("the borderline scale carries flagged self-harm-adjacent items", () => {
    expect(flagged.length).toBeGreaterThanOrEqual(2);
    for (const q of flagged) expect(q.trait).toBe("borderlinePattern");
  });

  it("an elevated answer on a flagged item triggers support — mid-run, one answer in", () => {
    const first = flagged[0]!;
    expect(supportTriggered(CLUSTER_B, { [first.id]: SUPPORT_TRIGGER_LEVEL })).toBe(true);
    expect(supportTriggered(CLUSTER_B, { [first.id]: 5 })).toBe(true);
  });

  it("does NOT trigger on low answers, unflagged items, or other assessments' items", () => {
    const first = flagged[0]!;
    expect(supportTriggered(CLUSTER_B, {})).toBe(false);
    expect(supportTriggered(CLUSTER_B, { [first.id]: 3 })).toBe(false);
    expect(supportTriggered(CLUSTER_B, { cbb1: 5, cbn4: 5 })).toBe(false); // elevated but unflagged
  });

  it("trigger is independent of completion — a run abandoned after one answer still routed", () => {
    // Only one answer exists; scoring hasn't happened; the trigger already fired.
    const partial = { [flagged[1]!.id]: 5 };
    expect(supportTriggered(CLUSTER_B, partial)).toBe(true);
    expect(Object.keys(partial)).toHaveLength(1);
  });
});

describe("screening structure + transparency", () => {
  it("is registered, shows the verbatim transparency intro before question one", () => {
    expect(getAssessmentDef("clusterB")).toBe(CLUSTER_B);
    expect(CLUSTER_B.introNote).toBe(CLUSTER_B_INTRO);
    expect(CLUSTER_B_INTRO).toContain("not a diagnostic instrument");
    expect(CLUSTER_B_INTRO).toContain("only a licensed clinician can diagnose");
    expect(CLUSTER_B_INTRO).toContain("worth exploring");
  });

  it("four scales, each with mirrored-pair material; narcissistic covers vulnerable presentation", () => {
    expect(CLUSTER_B.traits.map((t) => t.key)).toEqual([
      "borderlinePattern",
      "narcissisticPattern",
      "antisocialPattern",
      "histrionicPattern",
    ]);
    for (const trait of CLUSTER_B.traits) {
      const items = CLUSTER_B.questions.filter(
        (q): q is LikertQuestion => q.kind === "likert" && q.trait === trait.key
      );
      expect(items.some((q) => q.reverse), trait.key).toBe(true);
      expect(items.some((q) => !q.reverse), trait.key).toBe(true);
    }
    const narc = CLUSTER_B.traits.find((t) => t.key === "narcissisticPattern")!;
    expect(`${narc.blurb} ${narc.high}`.toLowerCase()).toContain("vulnerable");
    expect(`${narc.blurb} ${narc.high}`.toLowerCase()).toMatch(/shame|criticism/);
  });

  it("scores deterministically; neutral answers stay out of the high band", () => {
    const r = score(answersAll(3));
    expect(r).toEqual(score(answersAll(3)));
    for (const t of r.traits) expect(t.band).toBe("balanced");
  });
});

describe("impression management + overlap", () => {
  it("idealized responding lowers confidence and the disclosed note applies", () => {
    // All 1s on forward items = maximally idealized self-presentation; reverse
    // items also 1 → mirrored-pair inconsistency + idealization signals fire.
    const v = computeValidity(CLUSTER_B, answersAll(1), [800, 700, 900, 800, 750, 820]);
    expect(v.confidenceLevel).not.toBe("high");
    expect(checkSafetyCopy(IMPRESSION_MANAGEMENT_NOTE).violations).toEqual([]);
    expect(IMPRESSION_MANAGEMENT_NOTE).toContain("common and human");
    expect(IMPRESSION_MANAGEMENT_NOTE.toLowerCase()).not.toMatch(/lying|dishonest|faking/);
  });

  it("overlap panel appears only at 2+ elevated scales, shared facets counted once", () => {
    const one = overlapView(score(answersAll(3, { cbb1: 5, cbb2: 5, cbb3: 5, cbb4: 5, cbb5: 5, cbb6: 1, cbb7: 5, cbb8: 5 })));
    expect(one.show).toBe(false);

    const many = overlapView(score(answersAll(5)));
    expect(many.show).toBe(true);
    expect(many.elevated.length).toBeGreaterThanOrEqual(2);
    expect(many.body).toContain("rarely fit one box");
    // No duplicated facet strings.
    expect(new Set(many.sharedFacets).size).toBe(many.sharedFacets.length);
    expect(checkSafetyCopy(many.body).violations).toEqual([]);
  });
});

describe("register + pathways (safetyCopy-enforced)", () => {
  it("every scale's copy is safety-clean and never assigns a disorder", () => {
    for (const text of [
      CLUSTER_B.tagline,
      CLUSTER_B.resultNote,
      CLUSTER_B_INTRO,
      EVALUATION_PATHWAY,
      ...CLUSTER_B.traits.flatMap((t) => [t.blurb, t.low, t.high, t.balanced]),
      ...CLUSTER_B.questions.map((q) => (q.kind === "timed" ? q.prompt : q.text)),
    ]) {
      expect(checkSafetyCopy(text).violations, text.slice(0, 60)).toEqual([]);
    }
    for (const t of CLUSTER_B.traits) {
      expect(t.high.toLowerCase()).toContain("what to work on");
      expect(t.high.toLowerCase()).not.toMatch(/you are a narcissist|you have bpd|diagnosis of/);
    }
  });

  it("evaluation pathway + result note route toward professional care, not away", () => {
    expect(EVALUATION_PATHWAY.toLowerCase()).toContain("licensed evaluation");
    expect(CLUSTER_B.resultNote.toLowerCase()).toContain("bridge to professional care");
  });
});

describe("journal cross-reference (consent-gated upstream, read-only)", () => {
  const elevated = score(answersAll(3, { cbb1: 5, cbb2: 5, cbb3: 5, cbb4: 5, cbb5: 5, cbb6: 1, cbb7: 5, cbb8: 5 }));

  it("no themes (no consent) → silent; themes without elevation → silent", () => {
    expect(journalAnnotation(elevated, [])).toBeNull();
    expect(journalAnnotation(score(answersAll(2)), ["relationship"])).toBeNull();
  });

  it("consented conflict theme + volatility elevation → observation, never interpretation", () => {
    const line = journalAnnotation(elevated, ["relationship", "work"]);
    expect(line).not.toBeNull();
    expect(line!).toContain("you've allowed Forge30 to use");
    expect(line!.toLowerCase()).toContain("observation");
    expect(checkSafetyCopy(line!).violations).toEqual([]);
  });

  it("annotation never changes scores — results are byte-identical with and without themes", () => {
    const a = score(answersAll(3));
    journalAnnotation(a, ["relationship"]);
    expect(a).toEqual(score(answersAll(3)));
  });
});

describe("clinician-report export", () => {
  it("carries scores, bands, confidence — and stays non-diagnostic", () => {
    const r = score(answersAll(4));
    const text = clinicianReportText(r);
    expect(text).toContain("CLINICIAN SUMMARY");
    expect(text).toContain("Not a diagnostic instrument");
    for (const t of r.traits) expect(text).toContain(`${t.label}: ${t.score}/100`);
    expect(text).toContain(`confidence ${r.validity.confidence}/100`);
    expect(checkSafetyCopy(text).violations).toEqual([]);
  });
});
