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
  /**
   * Self-harm-adjacent item (B-3): an elevated answer immediately routes
   * support resources inline — free at every tier, independent of the
   * paywall and of finishing the assessment.
   */
  supportFlag?: boolean;
}

export interface AttentionQuestion {
  id: string;
  kind: "attention";
  text: string;
  /** The answer the question itself asks for. */
  expected: number;
}

export type BankQuestion = LikertQuestion | AttentionQuestion;

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
