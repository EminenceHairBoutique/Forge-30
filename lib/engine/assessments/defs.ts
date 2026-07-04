import type { AssessmentId } from "@/lib/types";

/**
 * Assessment definition model (E10). One architecture for the whole catalog:
 * likert assessments (statements rated 1–5) with optional reverse-coding,
 * attention checks, and branch rules; rank assessments (order a list).
 *
 * Register (enforced in tests): educational self-report, never diagnostic,
 * never covert. Every question is visible for what it is; attention checks
 * literally say what to press.
 */

export interface TraitDef {
  key: string;
  label: string;
  /** What this trait generally describes — educational, band-neutral. */
  blurb: string;
  /** Band copy shown on results. All three are legitimate places to be. */
  low: string;
  high: string;
  balanced: string;
}

export interface LikertQuestion {
  id: string;
  kind: "likert";
  text: string;
  trait: string;
  /** Reverse-coded: agreement means less of the trait. */
  reverse?: boolean;
}

export interface AttentionQuestion {
  id: string;
  kind: "attention";
  text: string;
  /** The answer the question itself asks for. */
  expected: number;
}

/**
 * Timed mini-task (Phase NEXT B-2): a multiple-choice item under a visible
 * countdown. The runner records a 0–100 score (correctness × speed credit
 * via `timedItemScore`) into the same answers map. Deterministic content —
 * fixed options, fixed correct index; never claims to measure IQ.
 */
export interface TimedQuestion {
  id: string;
  kind: "timed";
  trait: string;
  /** Countdown for the answer phase. */
  timeLimitMs: number;
  /** Task family — drives the renderer's layout only. */
  task: "patternGrid" | "digitRecall" | "verbalOddOne" | "symbolMatch";
  prompt: string;
  /** digitRecall: content flashed for memorizeMs before options appear. */
  memorize?: string;
  memorizeMs?: number;
  options: string[];
  correctIndex: number;
}

export type BankQuestion = LikertQuestion | AttentionQuestion | TimedQuestion;

/** Skip `skipIds` when the answer to `afterId` is ≤/≥ the bound. */
export interface BranchRule {
  afterId: string;
  whenLte?: number;
  whenGte?: number;
  skipIds: string[];
}

export interface RankItem {
  key: string;
  label: string;
  blurb: string;
}

export interface AssessmentDef {
  id: AssessmentId;
  name: string;
  tagline: string;
  minutes: number;
  kind: "likert" | "rank";
  traits: TraitDef[];
  questions: BankQuestion[];
  branchRules?: BranchRule[];
  rankItems?: RankItem[];
  /** Educational framing line shown with every result. */
  resultNote: string;
  /** Framing shown before the first question (e.g. the verbatim
   *  not-an-IQ-test label on the cognitive profile). */
  introNote?: string;
}
