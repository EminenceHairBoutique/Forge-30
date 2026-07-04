import type { AssessmentResult } from "@/lib/types";
import { getAssessmentDef } from "./bank";

/**
 * Overall Psyche Report (E10) — the deterministic mock: a unified narrative
 * over 3+ completed assessments plus a growth plan that feeds Skills. The
 * live-AI narrative ships later behind FLAG(psycheReportLive) as an
 * enhancement, never a replacement. Journal themes arrive here ONLY through
 * the E6 consent gate (the caller passes what the gate allowed).
 */

export const PSYCHE_REPORT_MIN_ASSESSMENTS = 3;

export interface PsycheSection {
  heading: string;
  body: string;
}

export interface PsycheReport {
  ready: boolean;
  /** How many more assessments are needed when not ready. */
  remaining: number;
  sections: PsycheSection[];
  /** Growth plan bullets — concrete, skill-shaped, feeds the Skills tab. */
  growthPlan: string[];
  /** Overall confidence: the lowest contributing confidence level. */
  confidenceLevel: "low" | "medium" | "high";
  /** True when consented journal themes shaped the report (attribution shows). */
  journalInformed: boolean;
}

/** Latest result per assessment. */
function latestByAssessment(results: AssessmentResult[]): Map<string, AssessmentResult> {
  const map = new Map<string, AssessmentResult>();
  for (const r of [...results].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    map.set(r.assessmentId, r);
  }
  return map;
}

function trait(r: AssessmentResult | undefined, key: string) {
  return r?.traits.find((t) => t.key === key);
}

export function buildPsycheReport(
  results: AssessmentResult[],
  journalThemes: string[] = []
): PsycheReport {
  const latest = latestByAssessment(results);
  if (latest.size < PSYCHE_REPORT_MIN_ASSESSMENTS) {
    return {
      ready: false,
      remaining: PSYCHE_REPORT_MIN_ASSESSMENTS - latest.size,
      sections: [],
      growthPlan: [],
      confidenceLevel: "low",
      journalInformed: false,
    };
  }

  const bigFive = latest.get("bigFive");
  const values = latest.get("values");
  const conflict = latest.get("conflictStyle");
  const communication = latest.get("communicationStyle");
  const attachment = latest.get("attachmentStyle");

  const sections: PsycheSection[] = [];
  const growthPlan: string[] = [];

  if (bigFive) {
    const parts = bigFive.traits.map((t) => t.summary);
    sections.push({
      heading: "The shape of you",
      body: parts.slice(0, 3).join(" "),
    });
    const reactive = trait(bigFive, "neuroticism");
    if (reactive?.band === "high") {
      growthPlan.push(
        "Daily downshift practice: the 60-second breathing reset once a day, before you need it — reactivity trains down with repetitions."
      );
    }
    const consc = trait(bigFive, "conscientiousness");
    if (consc?.band === "low") {
      growthPlan.push(
        "Externalize structure: let the Morning Plan and streak carry the organizing — 10 minutes of skill work daily beats a perfect system used twice."
      );
    }
  }

  if (values?.ranking && values.ranking.length >= 3) {
    const defs = getAssessmentDef("values");
    const labels = values.ranking
      .slice(0, 3)
      .map((k) => defs?.rankItems?.find((i) => i.key === k)?.label ?? k);
    sections.push({
      heading: "What you're actually optimizing for",
      body: `Your top three: ${labels.join(", ")}. Decisions that serve these will feel light even when they're hard; decisions that fight them will feel heavy even when they look right on paper. Use that as a compass check.`,
    });
    growthPlan.push(
      `Once this week, run one real decision through the top-three filter (${labels.join(", ")}) before deciding.`
    );
  }

  if (conflict || communication) {
    const domConflict = conflict
      ? [...conflict.traits].sort((a, b) => b.score - a.score)[0]
      : undefined;
    const assertive = trait(communication, "assertive");
    const bodyParts: string[] = [];
    if (domConflict) {
      bodyParts.push(`Under friction, your strongest pattern is ${domConflict.label.toLowerCase()}: ${domConflict.summary}`);
    }
    if (assertive) bodyParts.push(assertive.summary);
    sections.push({ heading: "How you handle friction", body: bodyParts.join(" ") });
    if (assertive && assertive.band !== "high") {
      growthPlan.push(
        "Practice one clean assertive sentence per week (\"I need X — can we make that work?\") — the boundary script tool in Mind builds these."
      );
    }
  }

  if (attachment) {
    const dominant = [...attachment.traits]
      .filter((t) => t.key !== "secure")
      .sort((a, b) => b.score - a.score)[0];
    const secure = trait(attachment, "secure");
    sections.push({
      heading: "Closeness and distance",
      body: `${secure?.summary ?? ""} ${dominant && dominant.band === "high" ? dominant.summary : ""}`.trim(),
    });
  }

  if (journalThemes.length > 0) {
    sections.push({
      heading: "What your journal keeps circling",
      body: `Recent entries keep touching ${journalThemes.slice(0, 2).join(" and ")} — worth noticing next to the patterns above. An observation, not an interpretation.`,
    });
  }

  if (growthPlan.length === 0) {
    growthPlan.push(
      "Keep the daily loop running and retake in a month — the comparison is where the insight compounds."
    );
  }

  const levels = ["low", "medium", "high"] as const;
  const confidenceLevel = [...latest.values()]
    .map((r) => r.validity.confidenceLevel)
    .reduce<(typeof levels)[number]>(
      (worst, l) => (levels.indexOf(l) < levels.indexOf(worst) ? l : worst),
      "high"
    );

  return {
    ready: true,
    remaining: 0,
    sections,
    growthPlan,
    confidenceLevel,
    journalInformed: journalThemes.length > 0,
  };
}
