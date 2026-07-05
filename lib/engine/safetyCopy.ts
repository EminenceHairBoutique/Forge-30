/**
 * Safety-copy module — the single source for the verbatim disclaimers, the
 * forbidden-output rules, and the required register for every sensitive
 * surface (coach output, assessments, relationship analysis, health copy).
 *
 * This module is a *requirement*, not polish (v2_spec.md §Safety
 * Requirements): sensitive outputs route through checkSafetyCopy in tests so
 * regressions fail CI, and disclaimers render from these constants so the
 * verbatim text can't drift per-page. Crisis and safety copy is never gated
 * behind entitlements (enforced in lib/engine/entitlements.ts tests).
 */

// ---------------------------------------------------------------------------
// Verbatim disclaimers (spec §Safety Requirements — do not edit casually)
// ---------------------------------------------------------------------------

export const DISCLAIMERS = {
  health:
    "Forge30 provides educational wellness insights only. It does not diagnose, treat, cure, or prevent disease. Always consult a qualified healthcare professional for interpretation of bloodwork, symptoms, medications, injuries, or medical concerns.",
  mentalHealth:
    "Forge30 supports reflection and habit-building. It is not therapy, crisis care, or diagnosis. If you are in danger or may harm yourself or someone else, contact emergency services or a crisis hotline immediately.",
  relationships:
    "Forge30 provides relationship education and communication tools. It does not determine whether a relationship is safe, abusive, compatible, or worth continuing. If there is violence, coercion, threats, stalking, or fear, seek professional/legal/domestic violence support.",
  finance:
    "Forge30 provides budgeting and spending awareness tools. It is not professional financial, tax, legal, or investment advice.",
} as const;

// ---------------------------------------------------------------------------
// Forbidden output — phrase-level patterns, tuned against false positives
// (legitimate copy like "not a diagnosis" or "It does not diagnose" must pass)
// ---------------------------------------------------------------------------

export interface SafetyViolation {
  rule: string;
  match: string;
}

const FORBIDDEN: { rule: string; pattern: RegExp }[] = [
  {
    rule: "no-self-diagnosis",
    // "you have NPD / narcissistic personality disorder / BPD…"
    pattern:
      /\byou (?:have|are|are showing signs of|meet the criteria for) (?:npd|bpd|aspd|hpd|ptsd|cptsd|adhd|ocd|a personality disorder|narcissis\w*|borderline|antisocial|histrionic|sociopath\w*|psychopath\w*|bipolar|depress\w+ disorder)\b/i,
  },
  {
    rule: "no-labeling-others",
    // "your partner is a narcissist / they are borderline / your ex is an abuser"
    pattern:
      /\b(?:your (?:partner|spouse|wife|husband|boyfriend|girlfriend|ex|mother|father|mom|dad|parent|sibling|brother|sister|friend|boss)|they|he|she) (?:is|are) (?:a |an )?(?:narcissist\w*|borderline|sociopath\w*|psychopath\w*|abuser|gaslighter|manipulator by nature)\b/i,
  },
  {
    rule: "no-abuse-verdicts",
    pattern: /\bthis (?:proves|confirms) (?:abuse|gaslighting|manipulation)\b/i,
  },
  {
    rule: "no-stay-or-leave-directives",
    pattern: /\byou (?:must|have to|need to|should) (?:leave|stay with|divorce|break up with|go back to) (?:them|him|her|your)\b/i,
  },
  {
    rule: "no-medication-directives",
    pattern: /\b(?:start|stop|increase|decrease|change) (?:taking )?(?:your )?(?:medication|meds|dosage|dose)\b/i,
  },
  {
    rule: "no-treatment-claims",
    pattern: /\b(?:this (?:will|can) (?:cure|treat|heal)|guaranteed to (?:cure|heal|fix) your)\b/i,
  },
  {
    rule: "no-investment-advice",
    pattern: /\b(?:you should (?:buy|invest in|short)|guaranteed returns?)\b/i,
  },
  {
    rule: "no-covert-recording",
    pattern: /\b(?:secretly|covertly) record\b|\brecord (?:them|him|her) without\b/i,
  },
  {
    rule: "no-shame-copy",
    // Verdict-shame on the user for ordinary variance. "cheat day/meal" is the
    // diet-culture framing the spec bans outright.
    pattern: /\b(?:you failed|you're (?:lazy|weak|pathetic)|you ruined|cheat (?:day|meal)|no excuses\b)/i,
  },
  {
    rule: "no-fake-certainty",
    pattern: /\b(?:definitely|100% certain(?:ly)?|without a doubt) (?:have|has|is|are) (?:a |an )?(?:disorder|abus\w+|narcissis\w+)\b/i,
  },
];

/** Checks a piece of user-facing output against the forbidden-output rules. */
export function checkSafetyCopy(text: string): { ok: boolean; violations: SafetyViolation[] } {
  const violations: SafetyViolation[] = [];
  for (const { rule, pattern } of FORBIDDEN) {
    const match = text.match(pattern);
    if (match) violations.push({ rule, match: match[0] });
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Dev/test assertion helper: throws with the offending rule + excerpt.
 * Sensitive engines call this in their test suites; UI never needs it.
 */
export function assertSafeCopy(text: string, context = "output"): void {
  const { ok, violations } = checkSafetyCopy(text);
  if (!ok) {
    const detail = violations.map((v) => `${v.rule}: "${v.match}"`).join("; ");
    throw new Error(`Safety-copy violation in ${context} — ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Required register — helpers so new surfaces phrase things the approved way
// ---------------------------------------------------------------------------

export type Confidence = "low" | "medium" | "high";

/** "Possible pattern" phrasing — the only register LifeGraph findings use. */
export function possiblePattern(finding: string, experiment: string): string {
  return `Possible pattern: ${finding} ${experiment}`;
}

/** Disclosed data-quality note attached to assessment results — never an accusation. */
export function confidenceNote(level: Confidence): string {
  switch (level) {
    case "high":
      return "Confidence: high — your answers were consistent.";
    case "medium":
      return "Confidence: medium — a few answers pulled in different directions, so read this as a sketch, not a portrait.";
    case "low":
      return "Confidence: low — some answers were inconsistent or unusually idealized. Retaking in a reflective moment may give you a more useful picture.";
  }
}

/** The non-diagnosis line every assessment/insight result carries. */
export const NOT_A_DIAGNOSIS =
  "This is a self-reflection tool, not a diagnosis. If these patterns repeatedly affect your life or relationships, exploring them with a licensed professional is worth it.";
