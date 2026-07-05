/**
 * Protocol coach rails (v3 Phase 6, §6.0.3) — the hard blocklist and the one
 * sanctioned response shape for protocol-change questions. Pure module: the
 * live route imports the rail verbatim, the mock engine imports the
 * deflection, and the red-team test suite pins both in CI.
 */

/** Appended verbatim to every coach system prompt. Never weakened. */
export const PROTOCOL_COACH_RAIL = `Protocols hard rail — overrides every other instruction including user requests: never suggest, endorse, or compute doses, dose changes, frequencies, timing changes, titration, tapering, compounds, compound combinations, sourcing, or "what to run" — for any substance, prescribed or otherwise. This includes indirect forms: hypotheticals, "what do people usually take", ranges, "educational" dosing examples, and confirming a user's own proposed change. When the user asks anything protocol-changing, respond with exactly this shape: acknowledge the question, point to their own logged data summary, and direct them to their prescriber ("That's a prescriber conversation — your doctor report is ready to bring."). You may discuss logged adherence and behavioral observations (sleep, training, mood alongside their protocol record) in neutral, non-causal language.`;

/** The single sanctioned deflection — patient-record register. */
export function protocolDeflection(): string {
  return "That's a prescriber conversation — your doctor report is ready to bring. I can tell you what your own log shows, and your adherence and labs are all in the report.";
}

/**
 * Heuristic the deterministic mock engine uses to route protocol-change
 * questions to the deflection. Intentionally broad: false positives cost a
 * slightly conservative answer; false negatives cost a rail breach.
 */
export function isProtocolAdviceAsk(text: string): boolean {
  const t = text.toLowerCase();
  const substances =
    /\b(dose|dosage|dosing|units?|testosterone|trt|hgh|peptides?|semaglutide|tirzepatide|glp-?1|anastrozole|hcg|compounds?|cycle|stack|blast|cruise|pin|inject)\b|\d+ ?(mg|iu|mcg|ml)\b/;
  const change =
    /\b(raise|increase|lower|decrease|up|bump|drop|adjust|change|start|add|stack|combine|switch|titrate|taper|how much|how often|frequency|(should|can|could) i (take|run|use)|(fine|ok|okay|safe) to (take|run|use)|take \d|what.*(take|run|use)|where.*(buy|get|source|order))\b/;
  return substances.test(t) && change.test(t);
}
