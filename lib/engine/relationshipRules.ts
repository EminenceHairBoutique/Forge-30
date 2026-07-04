import type {
  AssessmentResult,
  ConflictDebrief,
  RelationshipCheckIn,
} from "@/lib/types";
import { possiblePattern } from "./safetyCopy";

/**
 * Relationship Clarity engine (E11) — deterministic heuristics with a locked
 * register:
 *
 *  - Patterns are described as *communication patterns in the text*, never as
 *    diagnoses of a person. No labels (narcissist/borderline/abuser), ever.
 *  - Findings use the "Possible pattern:" / "some people experience this as"
 *    voice from safetyCopy, with counts and the user's own quoted lines.
 *  - The healthy side is first-class: repair attempts, accountability, and
 *    validation are detected and named with equal weight.
 *  - Coercive-control/threat indicators escalate to safety resources — free
 *    at every tier, never gated, never softened.
 *  - Live-AI enhancement stays behind FLAG(ai-key); these heuristics are the
 *    floor, not a placeholder.
 */

// --- Pattern vocabulary --------------------------------------------------------

export interface PatternDef {
  key: string;
  label: string;
  healthy: boolean;
  /** Escalates to safety resources when matched. */
  abuseIndicator?: boolean;
  phrases: RegExp[];
  /** What this pattern generally means — educational, person-neutral. */
  explanation: string;
  /** A constructive next step in the app's suggestion voice. */
  suggestion: string;
}

export const PATTERN_LIBRARY: PatternDef[] = [
  {
    key: "invalidation",
    label: "Invalidation",
    healthy: false,
    phrases: [
      /you'?re (?:overreacting|too sensitive|being dramatic|imagining (?:it|things)|crazy|insane)/i,
      /it'?s not a big deal/i,
      /calm down/i,
      /stop being so emotional/i,
    ],
    explanation:
      "responses that dismiss a stated feeling instead of engaging with it. Repeated often, some people experience this pattern as being talked out of their own experience",
    suggestion: "A useful counter-move is naming the feeling again, once, plainly: \"I'm telling you how it landed for me.\"",
  },
  {
    key: "contempt",
    label: "Contempt-toned language",
    healthy: false,
    phrases: [
      /\b(?:pathetic|worthless|disgusting|idiot|stupid|loser)\b/i,
      /why (?:would|do) i (?:even )?bother with you/i,
      /you'?re (?:such )?an? embarrassment/i,
    ],
    explanation:
      "put-downs aimed at the person rather than the problem. Research on couples treats sustained contempt as the strongest single strain on a relationship",
    suggestion: "Contempt cools when complaints get restated about behavior, not character — that goes for both directions.",
  },
  {
    key: "stonewalling",
    label: "Shutdown / stonewalling",
    healthy: false,
    phrases: [
      /i'?m done (?:talking|with this conversation)/i,
      /\bwhatever\.?$/im,
      /not (?:talking|discussing) (?:about )?this/i,
      /\bend of discussion\b/i,
    ],
    explanation:
      "conversation-ending moves that leave the issue standing. Sometimes it's overwhelm needing a pause; a pause with a return time is the workable version",
    suggestion: "\"I need 20 minutes, then I want to finish this\" keeps the pause without the wall.",
  },
  {
    key: "darvoLike",
    label: "Deny–attack–reverse sequence",
    healthy: false,
    phrases: [
      /(?:i never said|that never happened|you'?re making (?:that|this|it) up)/i,
      /(?:you'?re the (?:one|problem)|this is (?:all )?your fault|i'?m the (?:real )?victim here)/i,
    ],
    explanation:
      "a sequence some people describe as deny → attack → reverse: the original point disappears and the conversation becomes about the person who raised it",
    suggestion: "Writing down what you raised before the conversation makes it easier to notice when the topic gets flipped.",
  },
  {
    key: "guiltTripping",
    label: "Guilt leverage",
    healthy: false,
    phrases: [
      /after (?:everything|all) i'?ve done for you/i,
      /if you (?:really |actually )?loved me,? you(?:'?d| would)/i,
      /i guess i'?m just (?:a terrible|the worst)/i,
    ],
    explanation:
      "obligation or self-blame used as pressure toward a decision, instead of asking for it directly",
    suggestion: "The direct request hiding under the guilt is usually answerable — \"what are you asking me for, exactly?\" surfaces it.",
  },
  {
    key: "coerciveControl",
    label: "Control indicators",
    healthy: false,
    abuseIndicator: true,
    phrases: [
      /you'?re not (?:allowed|permitted) to/i,
      /i (?:will|'?ll) (?:check|go through|read) your (?:phone|messages|email)/i,
      /you (?:can'?t|won'?t) see (?:your|those) friends/i,
      /i(?:'?ll| will) (?:cut you off|take the (?:money|car|kids))/i,
      /if you leave,? i(?:'?ll| will)/i,
      /you(?:'?d| would) be nothing without me/i,
    ],
    explanation:
      "language that restricts money, movement, contact with people, or privacy, or attaches threats to leaving. This is in a different category from ordinary conflict",
    suggestion: "Patterns like this are exactly what domestic-violence advocates are trained to help think through — the resources below are confidential and free.",
  },
  {
    key: "loveBombDevalue",
    label: "Extreme swing (idealize ↔ devalue)",
    healthy: false,
    phrases: [
      /(?:you'?re (?:perfect|everything|my whole world)|never felt like this|soulmate)/i,
      /(?:i (?:hate|can'?t stand) you|you (?:ruin|destroy) everything|worst thing that ever happened)/i,
    ],
    explanation:
      "when the same thread swings between idealizing highs and harsh devaluation, the whiplash itself is the pattern worth noticing — separate from either end",
    suggestion: "Track how you feel across a full week rather than at either extreme — the average tells you more than the peaks.",
  },
  {
    key: "boundaryPressure",
    label: "Boundary pressure",
    healthy: false,
    phrases: [
      /i (?:already )?said no/i,
      /stop asking/i,
      /(?:come on|please),? just this once/i,
      /don'?t be like that,? just/i,
    ],
    explanation:
      "a stated no followed by continued pressure. A boundary that has to be re-defended repeatedly isn't being heard",
    suggestion: "A boundary restated once, then enforced with action (leaving the conversation, changing the plan) teaches faster than repetition.",
  },
  // --- The healthy side, first-class -------------------------------------------
  {
    key: "repairAttempt",
    label: "Repair attempts",
    healthy: true,
    phrases: [
      /(?:can we start (?:over|again)|let me try (?:that )?again|i don'?t want to fight)/i,
      /i'?m sorry(?: for| that| about)?/i,
      /can we talk about (?:this|it) (?:calmly|later|properly)/i,
    ],
    explanation:
      "moves that try to de-escalate and reconnect mid-conflict — the single strongest predictor of conflicts that end well",
    suggestion: "Repair attempts work best when they're accepted out loud, even mid-anger: \"okay — yes, let's start over.\"",
  },
  {
    key: "accountability",
    label: "Accountability",
    healthy: true,
    phrases: [
      /(?:that (?:was|is) on me|i was wrong|my fault,? i)/i,
      /i shouldn'?t have (?:said|done)/i,
      /you'?re right,? i/i,
    ],
    explanation: "ownership of one's own part without deflection — the raw material of trust",
    suggestion: "Naming what you'll do differently next time turns an apology into a change.",
  },
  {
    key: "validation",
    label: "Validation",
    healthy: true,
    phrases: [
      /(?:that makes sense|i (?:hear|get) (?:you|that)|i understand why you)/i,
      /(?:you have every right to|it'?s fair (?:that|to feel))/i,
    ],
    explanation: "engaging with the other person's experience as real before problem-solving it",
    suggestion: "Validation before solutions, every time — it halves the length of most arguments.",
  },
];

// --- Thread analysis --------------------------------------------------------------

export interface PatternFinding {
  key: string;
  label: string;
  healthy: boolean;
  abuseIndicator: boolean;
  count: number;
  /** Matched lines (truncated) so the user sees exactly what triggered it. */
  examples: string[];
  explanation: string;
  suggestion: string;
}

export interface ThreadAnalysis {
  findings: PatternFinding[];
  /** Any control/threat indicator present → safety resources escalate. */
  abuseIndicators: boolean;
  /** Locked-register lines: "Possible pattern: …". */
  summaryLines: string[];
  healthyLines: string[];
  lineCount: number;
}

export function analyzeThread(text: string): ThreadAnalysis {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const findings: PatternFinding[] = [];
  for (const def of PATTERN_LIBRARY) {
    const examples: string[] = [];
    let count = 0;
    for (const line of lines) {
      if (def.phrases.some((p) => p.test(line))) {
        count += 1;
        if (examples.length < 2) {
          examples.push(line.length > 90 ? `${line.slice(0, 87)}…` : line);
        }
      }
    }
    if (count > 0) {
      findings.push({
        key: def.key,
        label: def.label,
        healthy: def.healthy,
        abuseIndicator: def.abuseIndicator ?? false,
        count,
        examples,
        explanation: def.explanation,
        suggestion: def.suggestion,
      });
    }
  }

  findings.sort((a, b) => Number(a.healthy) - Number(b.healthy) || b.count - a.count);
  const abuseIndicators = findings.some((f) => f.abuseIndicator);

  const summaryLines = findings
    .filter((f) => !f.healthy)
    .map((f) =>
      possiblePattern(
        `${f.label.toLowerCase()} appears ${f.count} time${f.count === 1 ? "" : "s"} in this thread — ${f.explanation}.`,
        f.suggestion
      )
    );
  const healthyLines = findings
    .filter((f) => f.healthy)
    .map(
      (f) =>
        `${f.label} show up ${f.count} time${f.count === 1 ? "" : "s"} — worth naming: ${f.explanation}.`
    );

  return { findings, abuseIndicators, summaryLines, healthyLines, lineCount: lines.length };
}

/**
 * Redaction helper: strips emails, phone numbers, and URLs automatically and
 * replaces user-supplied names with neutral placeholders. The user reviews
 * the redacted text before anything is analyzed or saved.
 */
export function redactThread(text: string, names: string[] = []): string {
  let out = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone]")
    .replace(/https?:\/\/\S+/gi, "[link]");
  names
    .map((n) => n.trim())
    .filter((n) => n.length >= 2)
    .forEach((name, i) => {
      const placeholder = `Person ${String.fromCharCode(65 + i)}`;
      out = out.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), placeholder);
    });
  return out;
}

// --- Conflict debrief support -------------------------------------------------------

export interface DebriefSupport {
  summary: string;
  patterns: string[];
  repairLanguage: string;
  calmMessage: string;
  pauseSuggestion: string;
  boundarySuggestion: string;
}

/** Deterministic debrief support — echoes the user's own account, neutrally. */
export function debriefSupport(d: ConflictDebrief): DebriefSupport {
  const threadText = [d.whatHappened, d.whatIFelt, d.didPoorly].join("\n");
  const analysis = analyzeThread(threadText);

  const summary = `As you describe it: something happened (${truncate(d.whatHappened)}), it left you feeling ${truncate(d.whatIFelt) || "something you haven't named yet"}, and what you needed was ${truncate(d.whatINeeded) || "still coming into focus"}. You also made room for their side: ${truncate(d.whatTheyMayHaveNeeded) || "not yet — worth a guess, even a wrong one"}.`;

  const patterns =
    analysis.summaryLines.length > 0
      ? analysis.summaryLines.slice(0, 2)
      : ["No named pattern jumps out of this account — it reads like ordinary friction between two sets of needs."];

  const repairLanguage = d.didWell
    ? `You already did the hard part once (${truncate(d.didWell)}). A repair line that fits: "I care more about us than about this argument — can we take another run at it?"`
    : `A repair line that fits most versions of this: "I didn't like how that went, and I don't think you did either. Can we take another run at it?"`;

  const calmMessage = d.nextCalmMessage
    ? `Your draft, tightened: "${truncate(d.nextCalmMessage, 200)}" — send it when you're at a 4/10 or calmer, not before.`
    : `A starting draft: "I've been thinking about our conversation. I felt ${truncate(d.whatIFelt) || "off"} and what I actually need is ${truncate(d.whatINeeded) || "for us to hear each other"}. When's a good time to talk?"`;

  return {
    summary,
    patterns,
    repairLanguage,
    calmMessage,
    pauseSuggestion:
      "Before sending anything: the 60-second breathing reset, then re-read once. Messages sent above 7/10 activation almost always need a second message.",
    boundarySuggestion: d.boundaryNeeded
      ? `The boundary you named (${truncate(d.boundaryNeeded)}) works best stated once, positively: what you will do, not what they must do.`
      : "If a boundary is needed, phrase it as what you will do (\"I'll step out of conversations that turn into shouting\") — enforceable by you alone.",
  };
}

function truncate(s: string, max = 90): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// --- Couples comparison (reuses E10 results) ------------------------------------------

export interface CouplesComparison {
  similarities: string[];
  differences: string[];
  discussionPrompts: string[];
  frictionPoints: string[];
}

/**
 * Similarities/differences over two people's results on the same assessment —
 * never a compatibility verdict. Differences are framed as things to
 * understand, friction points as things to plan around.
 */
export function couplesComparison(
  mine: AssessmentResult,
  partner: AssessmentResult
): CouplesComparison {
  const similarities: string[] = [];
  const differences: string[] = [];
  const discussionPrompts: string[] = [];
  const frictionPoints: string[] = [];

  for (const t of mine.traits) {
    const theirs = partner.traits.find((p) => p.key === t.key);
    if (!theirs) continue;
    const gap = Math.abs(t.score - theirs.score);
    if (gap <= 15) {
      similarities.push(`${t.label}: you land close together (${t.score} vs ${theirs.score}).`);
    } else if (gap >= 35) {
      differences.push(
        `${t.label}: a real gap (${t.score} vs ${theirs.score}) — not a problem, a difference to understand.`
      );
      discussionPrompts.push(
        `On ${t.label.toLowerCase()}: when has this difference actually helped you two? When has it chafed?`
      );
      frictionPoints.push(
        `${t.label} gaps tend to surface under stress — worth agreeing in calm times how you'll handle it.`
      );
    }
  }

  if (mine.ranking && partner.ranking) {
    const shared = mine.ranking.slice(0, 3).filter((k) => partner.ranking!.slice(0, 3).includes(k));
    if (shared.length > 0) similarities.push(`You share ${shared.length} of your top-3 values.`);
    const mineOnly = mine.ranking.slice(0, 3).filter((k) => !partner.ranking!.slice(0, 3).includes(k));
    for (const k of mineOnly) {
      discussionPrompts.push(`"${k}" is top-3 for one of you and not the other — what does it look like day-to-day for the one who holds it?`);
    }
  }

  if (discussionPrompts.length === 0) {
    discussionPrompts.push("Pick the trait where your scores differ most and swap one story each about where that difference showed up last month.");
  }

  return { similarities, differences, discussionPrompts, frictionPoints };
}

// --- Check-in insight + safety escalation ----------------------------------------------

export interface CheckInInsight {
  lines: string[];
  /** Low felt-safety or a conflict-without-repair run → safety resources. */
  escalateSafety: boolean;
}

export function checkInInsight(recent: RelationshipCheckIn[]): CheckInInsight {
  const lines: string[] = [];
  if (recent.length === 0) return { lines, escalateSafety: false };

  const safeScores = recent.filter((c) => c.feelingSafe > 0).map((c) => c.feelingSafe);
  const lowSafety = safeScores.some((s) => s <= 4);

  const conflicts = recent.filter((c) => c.conflict);
  const unrepaired = conflicts.filter((c) => !c.repairAttempt);
  if (conflicts.length >= 2 && unrepaired.length === conflicts.length) {
    lines.push(
      possiblePattern(
        `${conflicts.length} conflicts logged recently, none followed by a repair attempt.`,
        "The repair-attempts micro-lesson below is the highest-leverage five minutes here."
      )
    );
  }
  const appreciationRate = recent.filter((c) => c.appreciationExpressed).length / recent.length;
  if (recent.length >= 5 && appreciationRate >= 0.6) {
    lines.push("Appreciation is getting said out loud most days — that's the maintenance that prevents the big repairs.");
  }
  const heard = recent.filter((c) => c.feelingHeard > 0).map((c) => c.feelingHeard);
  if (heard.length >= 3 && heard.every((h) => h <= 5)) {
    lines.push(
      possiblePattern(
        "feeling heard has been running at 5/10 or lower across recent check-ins.",
        "The active-listening lesson has a two-person exercise built for exactly this."
      )
    );
  }
  if (lowSafety) {
    lines.push(
      "You've rated feeling safe at 4/10 or lower recently. That number matters more than every other one on this page — the resources below are confidential, free, and staffed by people trained for exactly this."
    );
  }
  return { lines, escalateSafety: lowSafety };
}
