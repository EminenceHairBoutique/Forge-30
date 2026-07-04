import type {
  AssessmentResult,
  AssessmentTraitScore,
  AssessmentValidity,
  ISODate,
} from "@/lib/types";
import { clamp } from "@/lib/utils";
import type { AssessmentDef, BankQuestion, LikertQuestion } from "./defs";

/**
 * Scoring + branching + the validity system (E10). Deterministic throughout.
 *
 * Validity is a disclosed confidence score, never an accusation: every
 * signal (attention checks, mirrored-pair consistency, acquiescence,
 * idealization, straight-lining, speed) becomes a neutral note about how
 * much weight to give the result — the register safetyCopy enforces.
 */

// --- Branching / adaptive selection ---------------------------------------------

/** The question list after branch rules — answers can shrink what's asked. */
export function visibleQuestions(
  def: AssessmentDef,
  answers: Record<string, number>
): BankQuestion[] {
  const skipped = new Set<string>();
  for (const rule of def.branchRules ?? []) {
    const answer = answers[rule.afterId];
    if (answer === undefined) continue;
    if (
      (rule.whenLte !== undefined && answer <= rule.whenLte) ||
      (rule.whenGte !== undefined && answer >= rule.whenGte)
    ) {
      for (const id of rule.skipIds) skipped.add(id);
    }
  }
  return def.questions.filter((q) => !skipped.has(q.id));
}

/** First visible unanswered question, or null when the run is complete. */
export function nextQuestion(
  def: AssessmentDef,
  answers: Record<string, number>
): BankQuestion | null {
  return visibleQuestions(def, answers).find((q) => answers[q.id] === undefined) ?? null;
}

// --- Validity --------------------------------------------------------------------

const SPEED_FLOOR_MS = 1200;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export function computeValidity(
  def: AssessmentDef,
  answers: Record<string, number>,
  timingsMs: number[]
): AssessmentValidity {
  const visible = visibleQuestions(def, answers);
  const attention = visible.filter((q) => q.kind === "attention");
  const attentionFailed = attention.filter((q) => answers[q.id] !== q.expected).length;

  const likert = visible.filter((q): q is LikertQuestion => q.kind === "likert");
  const values = likert.map((q) => answers[q.id]).filter((v): v is number => v !== undefined);

  // Mirrored-pair consistency: same-trait forward vs. reverse items should
  // roughly mirror (forward + reverse ≈ 6). Mean deviation / 4 → 0–1.
  let pairDeviation = 0;
  let pairCount = 0;
  for (const q of likert.filter((q) => q.reverse)) {
    const forward = likert.find((f) => f.trait === q.trait && !f.reverse);
    if (!forward) continue;
    const a = answers[q.id];
    const b = answers[forward.id];
    if (a === undefined || b === undefined) continue;
    pairDeviation += Math.abs(a + b - 6) / 4;
    pairCount += 1;
  }
  const inconsistency = pairCount > 0 ? pairDeviation / pairCount : 0;

  const acquiescence = values.length ? values.filter((v) => v >= 4).length / values.length : 0;
  const idealization = values.length ? values.filter((v) => v === 5).length / values.length : 0;
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 3;
  const variance = values.length
    ? values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    : 1;
  const straightLining = values.length >= 6 && variance < 0.2;
  const speedFlag = timingsMs.length >= 5 && median(timingsMs) < SPEED_FLOOR_MS;

  const notes: string[] = [];
  let confidence = 100;
  if (attentionFailed > 0) {
    confidence -= 25 * attentionFailed;
    notes.push(
      `${attentionFailed} of ${attention.length} attention checks didn't match — possibly answered on autopilot for a stretch.`
    );
  }
  if (inconsistency > 0.4) {
    confidence -= 20;
    notes.push(
      "Mirrored questions got similar answers instead of opposite ones — the result may be blurrier than usual."
    );
  }
  if (straightLining) {
    confidence -= 20;
    notes.push("Answers barely varied across very different questions.");
  }
  if (acquiescence > 0.85) {
    confidence -= 15;
    notes.push("Nearly everything got an agree — a common pattern that can flatten real differences.");
  }
  if (idealization > 0.6) {
    confidence -= 10;
    notes.push(
      "A very high share of maximum answers — sometimes the day's optimism talking. Worth a retake on an ordinary day."
    );
  }
  if (speedFlag) {
    confidence -= 15;
    notes.push("Responses came very fast — a slower retake may read truer.");
  }
  confidence = clamp(confidence, 10, 100);
  const confidenceLevel = confidence >= 75 ? "high" : confidence >= 45 ? "medium" : "low";

  return {
    attentionFailed,
    attentionTotal: attention.length,
    inconsistency: Math.round(inconsistency * 100) / 100,
    acquiescence: Math.round(acquiescence * 100) / 100,
    idealization: Math.round(idealization * 100) / 100,
    speedFlag,
    confidence,
    confidenceLevel,
    notes,
  };
}

// --- Scoring ----------------------------------------------------------------------

function band(score: number): "low" | "balanced" | "high" {
  if (score >= 65) return "high";
  if (score <= 35) return "low";
  return "balanced";
}

/** Score a likert assessment: per-trait mean → 0–100, reverse-coded flipped. */
export function scoreAssessment(args: {
  def: AssessmentDef;
  answers: Record<string, number>;
  timingsMs: number[];
  ranking?: string[];
  id: string;
  date: ISODate;
  createdAt: string;
}): AssessmentResult {
  const { def, answers, timingsMs, ranking } = args;

  const traits: AssessmentTraitScore[] = def.traits.map((trait) => {
    const items = visibleQuestions(def, answers).filter(
      (q): q is LikertQuestion => q.kind === "likert" && q.trait === trait.key
    );
    const scores = items
      .map((q) => {
        const raw = answers[q.id];
        if (raw === undefined) return null;
        return q.reverse ? 6 - raw : raw;
      })
      .filter((v): v is number => v !== null);
    const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 3;
    const score = Math.round(((mean - 1) / 4) * 100);
    const b = band(score);
    return {
      key: trait.key,
      label: trait.label,
      score,
      band: b,
      summary: trait[b],
    };
  });

  return {
    id: args.id,
    assessmentId: def.id,
    date: args.date,
    traits,
    ...(ranking ? { ranking } : {}),
    validity: computeValidity(def, answers, timingsMs),
    createdAt: args.createdAt,
  };
}

// --- Retake scheduling + test-retest comparison -------------------------------------

export const RETAKE_INTERVAL_DAYS = 30;

export function retakeDue(lastDate: ISODate, today: ISODate): boolean {
  const ms = new Date(`${today}T00:00:00`).getTime() - new Date(`${lastDate}T00:00:00`).getTime();
  return ms / 86400000 >= RETAKE_INTERVAL_DAYS;
}

export interface TraitDelta {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
}

export interface RetestComparison {
  deltas: TraitDelta[];
  /** Neutral framing for the comparison card. */
  framing: string;
}

/** Test-retest framing: movement is expected, not error and not verdict. */
export function compareResults(prev: AssessmentResult, next: AssessmentResult): RetestComparison {
  const deltas: TraitDelta[] = next.traits.map((t) => {
    const before = prev.traits.find((p) => p.key === t.key)?.score ?? t.score;
    return { key: t.key, label: t.label, before, after: t.score, delta: t.score - before };
  });
  const biggest = [...deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const framing =
    biggest && Math.abs(biggest.delta) >= 15
      ? `${biggest.label} moved ${biggest.delta > 0 ? "up" : "down"} ${Math.abs(biggest.delta)} points since last time. Scores shift with season and stress — that's normal measurement behavior, not a contradiction.`
      : "Your results held steady since last time — typical for these traits over a month.";
  return { deltas, framing };
}
