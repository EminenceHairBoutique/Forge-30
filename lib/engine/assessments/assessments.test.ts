import { describe, expect, it } from "vitest";
import { ASSESSMENT_BANK, getAssessmentDef } from "./bank";
import {
  compareResults,
  computeValidity,
  nextQuestion,
  retakeDue,
  scoreAssessment,
  visibleQuestions,
} from "./scoring";
import { buildPsycheReport, PSYCHE_REPORT_MIN_ASSESSMENTS } from "./report";
import { checkSafetyCopy } from "../safetyCopy";
import { notesForConsumer } from "../journalRules";
import type { AssessmentResult, JournalNote } from "@/lib/types";
import type { LikertQuestion } from "./defs";

const bigFive = getAssessmentDef("bigFive")!;

/** Answer every visible question with `value` (attention checks answered correctly). */
function uniformAnswers(defId: string, value: number, correctAttention = true) {
  const def = getAssessmentDef(defId)!;
  const answers: Record<string, number> = {};
  // Two passes so branch rules settle.
  for (let pass = 0; pass < 2; pass++) {
    for (const q of visibleQuestions(def, answers)) {
      answers[q.id] = q.kind === "attention" && correctAttention ? q.expected : value;
    }
  }
  return answers;
}

function score(defId: string, answers: Record<string, number>, timings = [3000, 3000, 3000, 3000, 3000]) {
  return scoreAssessment({
    def: getAssessmentDef(defId)!,
    answers,
    timingsMs: timings,
    id: "r1",
    date: "2026-07-01",
    createdAt: "2026-07-01T10:00:00.000Z",
  });
}

describe("bank integrity", () => {
  it("every likert assessment has traits, reverse items, and an attention check", () => {
    for (const def of ASSESSMENT_BANK.filter((d) => d.kind === "likert")) {
      expect(def.traits.length, def.id).toBeGreaterThanOrEqual(4);
      // Statement banks need mirrored-pair material; timed banks (B-2) have
      // no likert statements, so the reverse-item rule doesn't apply there.
      if (def.questions.some((q) => q.kind === "likert")) {
        expect(def.questions.some((q) => q.kind === "likert" && q.reverse), def.id).toBe(true);
      }
      expect(def.questions.some((q) => q.kind === "attention"), def.id).toBe(true);
    }
  });

  it("every trait referenced by a question exists", () => {
    for (const def of ASSESSMENT_BANK) {
      const traitKeys = new Set(def.traits.map((t) => t.key));
      for (const q of def.questions) {
        if (q.kind === "likert") expect(traitKeys.has(q.trait), `${def.id}/${q.id}`).toBe(true);
      }
    }
  });

  it("all bank copy routes clean through the safety check — no disorder framing", () => {
    for (const def of ASSESSMENT_BANK) {
      const texts = [
        def.tagline,
        def.resultNote,
        ...def.questions.map((q) => q.text),
        ...def.traits.flatMap((t) => [t.blurb, t.low, t.high, t.balanced]),
        ...(def.rankItems ?? []).map((i) => i.blurb),
      ];
      for (const text of texts) {
        expect(checkSafetyCopy(text).violations, `${def.id}: ${text}`).toEqual([]);
      }
    }
  });
});

describe("scoring + reverse scoring", () => {
  it("all-agree scores forward items high and reverse items pull the mean down", () => {
    const result = score("bigFive", uniformAnswers("bigFive", 5));
    // 3 forward 5s (→100) + 1 reverse 5 (→ 6-5 = 1 → 0): mean 75.
    for (const t of result.traits) expect(t.score).toBe(75);
  });

  it("perfectly consistent answers (forward 5, reverse 1) score 100", () => {
    const def = bigFive;
    const answers: Record<string, number> = {};
    for (const q of def.questions) {
      if (q.kind === "attention") answers[q.id] = q.expected;
      else answers[q.id] = (q as LikertQuestion).reverse ? 1 : 5;
    }
    const result = score("bigFive", answers);
    for (const t of result.traits) expect(t.score).toBe(100);
    expect(result.validity.inconsistency).toBe(0);
    expect(result.validity.confidence).toBeGreaterThanOrEqual(75);
  });

  it("bands carry the matching educational summary", () => {
    const result = score("bigFive", uniformAnswers("bigFive", 3));
    for (const t of result.traits) {
      expect(t.band).toBe("balanced");
      expect(t.summary.length).toBeGreaterThan(10);
    }
  });
});

describe("branching / adaptive selection", () => {
  const attachment = getAssessmentDef("attachmentStyle")!;

  it("a low screener answer skips the partner-specific items", () => {
    const withHistory = visibleQuestions(attachment, { scr1: 5 }).map((q) => q.id);
    const without = visibleQuestions(attachment, { scr1: 1 }).map((q) => q.id);
    expect(withHistory).toContain("ax2");
    expect(without).not.toContain("ax2");
    expect(without).not.toContain("av2");
    expect(without.length).toBe(withHistory.length - 3);
  });

  it("nextQuestion walks visible unanswered questions to completion", () => {
    const answers: Record<string, number> = {};
    let steps = 0;
    for (let q = nextQuestion(attachment, answers); q; q = nextQuestion(attachment, answers)) {
      answers[q.id] = q.kind === "attention" ? q.expected : 3;
      steps += 1;
      expect(steps).toBeLessThan(50);
    }
    expect(nextQuestion(attachment, answers)).toBeNull();
  });
});

describe("validity system — disclosed confidence, never an accusation", () => {
  it("failed attention checks cut confidence with a neutral note", () => {
    const answers = uniformAnswers("bigFive", 3, false); // attention answered 3, not expected
    const v = computeValidity(bigFive, answers, [3000, 3000, 3000, 3000, 3000]);
    expect(v.attentionFailed).toBe(2);
    expect(v.confidence).toBeLessThanOrEqual(50);
    expect(v.confidenceLevel).not.toBe("high");
  });

  it("straight-lining and acquiescence lower confidence", () => {
    const allFive = computeValidity(bigFive, uniformAnswers("bigFive", 5), [3000, 3000, 3000, 3000, 3000]);
    expect(allFive.acquiescence).toBe(1);
    expect(allFive.idealization).toBe(1);
    expect(allFive.confidence).toBeLessThan(80);
  });

  it("very fast responses flag speed", () => {
    const v = computeValidity(bigFive, uniformAnswers("bigFive", 3), [400, 500, 450, 480, 520, 300]);
    expect(v.speedFlag).toBe(true);
  });

  it("every validity note is neutral: safety-clean, no accusation words", () => {
    const worst = computeValidity(bigFive, uniformAnswers("bigFive", 5, false), [300, 300, 300, 300, 300]);
    expect(worst.notes.length).toBeGreaterThanOrEqual(3);
    for (const note of worst.notes) {
      expect(checkSafetyCopy(note).violations).toEqual([]);
      expect(note.toLowerCase()).not.toMatch(/lying|dishonest|cheat|invalid|careless/);
    }
  });
});

describe("retake + test-retest", () => {
  it("retake is due after 30 days", () => {
    expect(retakeDue("2026-06-01", "2026-07-01")).toBe(true);
    expect(retakeDue("2026-06-20", "2026-07-01")).toBe(false);
  });

  it("comparison frames movement as normal, never as contradiction", () => {
    const a = score("bigFive", uniformAnswers("bigFive", 2));
    const b = score("bigFive", uniformAnswers("bigFive", 4));
    const cmp = compareResults(a, b);
    expect(cmp.deltas.every((d) => d.delta !== 0)).toBe(true);
    expect(cmp.framing).toMatch(/normal measurement behavior/);
    expect(checkSafetyCopy(cmp.framing).violations).toEqual([]);
  });
});

describe("psyche report", () => {
  function completedResults(): AssessmentResult[] {
    const bf = score("bigFive", uniformAnswers("bigFive", 4));
    const cf = score("conflictStyle", uniformAnswers("conflictStyle", 4));
    const values = scoreAssessment({
      def: getAssessmentDef("values")!,
      answers: {},
      timingsMs: [],
      ranking: ["health", "freedom", "growth", "family"],
      id: "rv",
      date: "2026-07-01",
      createdAt: "2026-07-01T10:05:00.000Z",
    });
    return [bf, cf, values];
  }

  it("requires 3+ assessments and says how many remain", () => {
    const notReady = buildPsycheReport([score("bigFive", uniformAnswers("bigFive", 3))]);
    expect(notReady.ready).toBe(false);
    expect(notReady.remaining).toBe(PSYCHE_REPORT_MIN_ASSESSMENTS - 1);
  });

  it("builds a deterministic narrative + growth plan from 3 results", () => {
    const report = buildPsycheReport(completedResults());
    expect(report.ready).toBe(true);
    expect(report.sections.length).toBeGreaterThanOrEqual(3);
    expect(report.sections.some((s) => s.body.includes("Health & vitality"))).toBe(true);
    expect(report.growthPlan.length).toBeGreaterThan(0);
    expect(buildPsycheReport(completedResults())).toEqual(report); // deterministic
  });

  it("every report line routes clean through the safety check", () => {
    const report = buildPsycheReport(completedResults(), ["work"]);
    for (const s of report.sections) {
      expect(checkSafetyCopy(`${s.heading}. ${s.body}`).violations).toEqual([]);
    }
    for (const g of report.growthPlan) {
      expect(checkSafetyCopy(g).violations).toEqual([]);
    }
  });

  it("journal themes only reach the report through the consent gate", () => {
    const notes: JournalNote[] = [
      { id: "1", date: "2026-07-01", kind: "freewrite", text: "work stress again", tags: [], private: false, createdAt: "2026-07-01T09:00:00.000Z" },
    ];
    // Consent off → gate yields nothing → report has no journal section.
    const gatedOff = notesForConsumer(notes, { coach: false, assessments: false, lifeGraph: false }, "assessments");
    const without = buildPsycheReport(completedResults(), gatedOff.length ? ["work"] : []);
    expect(without.journalInformed).toBe(false);
    expect(without.sections.some((s) => s.heading.includes("journal"))).toBe(false);
    // Consent on → themes flow, attribution flag set.
    const gatedOn = notesForConsumer(notes, { coach: false, assessments: true, lifeGraph: false }, "assessments");
    const withThemes = buildPsycheReport(completedResults(), gatedOn.length ? ["work"] : []);
    expect(withThemes.journalInformed).toBe(true);
  });
});
