import type { AssessmentResult } from "@/lib/types";
import type { AssessmentDef, LikertQuestion } from "./defs";

/**
 * Cluster B Trait Screening (Phase NEXT B-3) — transparent by name and by
 * design. Screening-informed by public research instruments (MSI-BPD, NPI/
 * PNI, LSRP), trait-adapted; it never administers or claims to administer a
 * clinical instrument, and it never diagnoses. The validity system handles
 * defensive responding the legitimate way: disclosed confidence, never
 * accusation.
 *
 * Safety architecture (tested before anything else in this file shipped):
 * self-harm-adjacent items carry `supportFlag`; an elevated answer on any of
 * them routes support resources inline immediately — free at every tier,
 * independent of the paywall, independent of finishing the screening.
 */

/** Verbatim intro shown before question one (addendum-specified). */
export const CLUSTER_B_INTRO =
  "This screening measures trait patterns associated with the Cluster B personality styles — borderline, narcissistic, antisocial, and histrionic. It is a self-reflection screening, not a diagnostic instrument: only a licensed clinician can diagnose a personality disorder, using structured interviews over time. High scores here mean \"worth exploring,\" never \"you have a disorder.\"";

/** Impression-management interpretation line for low-confidence results. */
export const IMPRESSION_MANAGEMENT_NOTE =
  "Answers on this screening leaned strongly toward idealized responses, which is common and human — but it lowers how much these results can tell you. If you took it to genuinely check on yourself, retaking it in a private, unhurried moment usually gives a more useful picture.";

/** When a licensed evaluation is worth pursuing — shown with every result. */
export const EVALUATION_PATHWAY =
  "A licensed evaluation is worth pursuing when elevations here match real-life costs — relationships that keep breaking the same way, consequences that keep surprising you, or distress that doesn't respond to self-help. A clinician uses structured interviews over time; this screening can be the reason you book that conversation, and the export below is built to bring along.";

/**
 * The screening definition. Four trait scales; the borderline scale
 * necessarily touches abandonment distress and self-harm-adjacent territory —
 * those items carry `supportFlag` and are written plainly, not graphically.
 */
export const CLUSTER_B: AssessmentDef = {
  id: "clusterB",
  name: "Cluster B Trait Screening",
  tagline: "Trait patterns across the four Cluster B styles — named honestly, screened transparently.",
  minutes: 8,
  kind: "likert",
  introNote: CLUSTER_B_INTRO,
  resultNote:
    "Trait elevations are starting points for reflection, not identities and not diagnoses — only a licensed clinician can diagnose a personality disorder, and real people rarely fit one box. Every elevation above links a concrete practice, and the clinician export exists so this screening becomes a bridge to professional care, never a substitute for it.",
  traits: [
    {
      key: "borderlinePattern",
      label: "Borderline-pattern traits",
      blurb: "emotional instability, abandonment sensitivity, shifting sense of self, impulsivity",
      high: "This pattern tends to look like: emotions that hit fast and hard, fear when people pull away, a sense of self that shifts with the relationship, and impulsive moves under pain. What to work on: the regulation skill track and the Mind reset build the pause these moments need; DBT-style skills with a therapist are the gold standard here.",
      low: "Emotional storms, abandonment fear, and identity shifts don't feature much in your answers.",
      balanced: "Some intensity under stress without the full pattern — worth watching in hard seasons, not worth worrying about.",
    },
    {
      key: "narcissisticPattern",
      label: "Narcissistic-pattern traits",
      blurb: "entitlement and admiration-need on the grandiose side; shame sensitivity and criticism-hypersensitivity on the vulnerable side — both count",
      high: "This pattern tends to look like: needing admiration to feel steady, entitlement when others don't deliver it, difficulty feeling others' pain even when understanding it — and on the vulnerable side (the one self-aware people most often miss), intense shame and outsized reactions to criticism. What to work on: the EQ profile's empathy and accountability practices, and the communication track's repair work.",
      low: "Admiration-need, entitlement, and criticism-hypersensitivity don't feature much in your answers.",
      balanced: "Ordinary pride and ordinary sting at criticism — the human baseline, not a pattern.",
    },
    {
      key: "antisocialPattern",
      label: "Antisocial-pattern traits",
      blurb: "callousness, low remorse, manipulativeness-as-behavior, rule-breaking, low accountability",
      high: "This pattern tends to look like: other people's costs not registering, little aftertaste from breaking commitments or rules, and getting what you want by working people rather than working with them. What to work on: accountability reps — the two-sentence ownership practice in the EQ profile — and honestly, this scale more than any other is worth exploring with a professional if it matches your history.",
      low: "Callousness, rule-breaking, and low remorse don't feature much in your answers.",
      balanced: "Occasional sharp elbows without the pattern — normal self-interest, not callousness.",
    },
    {
      key: "histrionicPattern",
      label: "Histrionic-pattern traits",
      blurb: "attention-seeking, emotional intensity that shifts quickly, approval dependence",
      high: "This pattern tends to look like: discomfort when attention moves elsewhere, emotions that run theatrical-bright but shift fast, and approval functioning like oxygen. What to work on: the social confidence track's low-stakes reps build worth that doesn't need an audience; the journal's private pages are practice at being unwitnessed.",
      low: "Attention-need and approval dependence don't feature much in your answers.",
      balanced: "You enjoy attention without needing it — sociability, not a pattern.",
    },
  ],
  questions: [
    // --- Borderline-pattern (MSI-BPD-informed, trait-adapted) ---
    { id: "cbb1", kind: "likert", trait: "borderlinePattern", text: "My emotions can go from fine to overwhelming in minutes." },
    { id: "cbb2", kind: "likert", trait: "borderlinePattern", text: "When someone important pulls back even slightly, it feels like losing them entirely." },
    { id: "cbb3", kind: "likert", trait: "borderlinePattern", text: "Who I am — tastes, goals, even values — can shift depending on who I'm with." },
    { id: "cbb4", kind: "likert", trait: "borderlinePattern", text: "Under emotional pain I do impulsive things I later regret (spending, messages, exits)." },
    { id: "cbb5", kind: "likert", trait: "borderlinePattern", text: "A chronic feeling of emptiness sits under my days." },
    { id: "cbb6", kind: "likert", trait: "borderlinePattern", text: "My moods are steady even when relationships wobble.", reverse: true },
    { id: "cbb7", kind: "likert", trait: "borderlinePattern", supportFlag: true, text: "When emotional pain peaks, I have thoughts of hurting myself." },
    { id: "cbb8", kind: "likert", trait: "borderlinePattern", supportFlag: true, text: "The fear of being left has felt unbearable enough that I've considered drastic ways out." },
    // --- Narcissistic-pattern (NPI/PNI-informed: grandiose + vulnerable) ---
    { id: "cbn1", kind: "likert", trait: "narcissisticPattern", text: "I deserve more recognition than the people around me usually give." },
    { id: "cbn2", kind: "likert", trait: "narcissisticPattern", text: "Being admired matters to me more than I'd say out loud." },
    { id: "cbn3", kind: "likert", trait: "narcissisticPattern", text: "When someone shares their struggles, I understand it but rarely feel much." },
    { id: "cbatt1", kind: "attention", text: "To show you're reading, choose \"Disagree\" for this one.", expected: 2 },
    { id: "cbn4", kind: "likert", trait: "narcissisticPattern", text: "Criticism — even mild — can burn in me for days." },
    { id: "cbn5", kind: "likert", trait: "narcissisticPattern", text: "I sometimes feel humiliated by needing anything from anyone." },
    { id: "cbn6", kind: "likert", trait: "narcissisticPattern", text: "Other people's wins are easy for me to celebrate without comparing.", reverse: true },
    // --- Antisocial-pattern (LSRP-informed) ---
    { id: "cba1", kind: "likert", trait: "antisocialPattern", text: "If a rule is inconvenient and the risk is low, I break it without much thought." },
    { id: "cba2", kind: "likert", trait: "antisocialPattern", text: "I can talk people into things against their interest when it serves mine." },
    { id: "cba3", kind: "likert", trait: "antisocialPattern", text: "After hurting someone's feelings, the discomfort fades for me almost immediately." },
    { id: "cba4", kind: "likert", trait: "antisocialPattern", text: "When something goes wrong, it's usually someone else's doing." },
    { id: "cba5", kind: "likert", trait: "antisocialPattern", text: "I feel a real pull to make things right when I've cost someone something.", reverse: true },
    { id: "cbatt2", kind: "attention", text: "Attention check: choose \"Strongly agree\" here.", expected: 5 },
    // --- Histrionic-pattern ---
    { id: "cbh1", kind: "likert", trait: "histrionicPattern", text: "When I'm not the center of attention, gatherings lose their point." },
    { id: "cbh2", kind: "likert", trait: "histrionicPattern", text: "My feelings are big and visible, and they can change scene to scene." },
    { id: "cbh3", kind: "likert", trait: "histrionicPattern", text: "Disapproval — even from people I barely know — genuinely destabilizes me." },
    { id: "cbh4", kind: "likert", trait: "histrionicPattern", text: "I'm content going unnoticed in a group.", reverse: true },
  ],
};

// --- Self-harm-adjacent support routing (THE first-shipped, first-tested rule) ----

export const SUPPORT_TRIGGER_LEVEL = 4;

/**
 * True the moment any supportFlag item is answered at/above the trigger
 * level. Pure; the runner calls it after every answer and renders support
 * resources inline immediately — before the screening finishes, regardless
 * of tier, regardless of anything.
 */
export function supportTriggered(def: AssessmentDef, answers: Record<string, number>): boolean {
  return def.questions.some(
    (q): q is LikertQuestion =>
      q.kind === "likert" &&
      q.supportFlag === true &&
      (answers[q.id] ?? 0) >= SUPPORT_TRIGGER_LEVEL
  );
}

// --- Overlap / comorbidity view ---------------------------------------------------

/** Facets shared across scales — listed once, never double-counted. */
const SHARED_FACETS: { scales: [string, string]; facet: string }[] = [
  { scales: ["narcissisticPattern", "antisocialPattern"], facet: "low affective empathy" },
  { scales: ["borderlinePattern", "antisocialPattern"], facet: "impulsivity under pressure" },
  { scales: ["narcissisticPattern", "histrionicPattern"], facet: "needing attention or admiration to feel steady" },
  { scales: ["borderlinePattern", "histrionicPattern"], facet: "fast-shifting emotional intensity" },
  { scales: ["borderlinePattern", "narcissisticPattern"], facet: "acute sensitivity to rejection and criticism" },
];

export interface OverlapView {
  show: boolean;
  elevated: string[];
  sharedFacets: string[];
  body: string;
}

/** When 2+ scales run high, render the overlap panel instead of four verdicts. */
export function overlapView(result: AssessmentResult): OverlapView {
  const elevated = result.traits.filter((t) => t.band === "high").map((t) => t.key);
  if (elevated.length < 2) return { show: false, elevated, sharedFacets: [], body: "" };
  const sharedFacets = [
    ...new Set(
      SHARED_FACETS.filter(
        (s) => elevated.includes(s.scales[0]) && elevated.includes(s.scales[1])
      ).map((s) => s.facet)
    ),
  ];
  return {
    show: true,
    elevated,
    sharedFacets,
    body:
      "Trait elevations often span more than one pattern; real people rarely fit one box, which is exactly why clinical assessment looks at the whole person." +
      (sharedFacets.length > 0
        ? ` Some of what elevated here is the same underlying trait appearing in more than one scale — counted once: ${sharedFacets.join("; ")}.`
        : ""),
  };
}

// --- Journal cross-reference (consent-gated upstream, read-only) -------------------

/**
 * Read-only annotation for clusterB results when journal consent allows.
 * Never score-affecting; observation, never diagnosis. The caller passes
 * themes that already went through notesForConsumer — empty means silent.
 */
export function journalAnnotation(result: AssessmentResult, themes: string[]): string | null {
  if (themes.length === 0) return null;
  const volatile = result.traits.find(
    (t) => t.key === "borderlinePattern" || t.key === "histrionicPattern"
  );
  const conflictTheme = themes.find((t) => t === "relationship" || t === "stress" || t === "family");
  if (!conflictTheme || !volatile || volatile.band !== "high") return null;
  return `The journal themes you've allowed Forge30 to use mention ${conflictTheme} in the same period as this elevation — an observation worth carrying into any conversation about it, not an interpretation.`;
}

// --- Clinician-report export --------------------------------------------------------

/**
 * Plain-text summary designed to be brought to an intake appointment — scale
 * scores + disclosed confidence, no narrative claims. A bridge to care.
 */
export function clinicianReportText(result: AssessmentResult): string {
  const lines = [
    "FORGE30 — CLUSTER B TRAIT SCREENING · CLINICIAN SUMMARY",
    `Taken: ${result.date}`,
    "",
    "Self-report trait screening (MSI-BPD / NPI-PNI / LSRP-informed, trait-adapted).",
    "Not a diagnostic instrument. Scores are 0-100 per scale; bands: low <=35,",
    "balanced 36-64, high >=65.",
    "",
    ...result.traits.map((t) => `${t.label}: ${t.score}/100 (${t.band})`),
    "",
    `Response validity: confidence ${result.validity.confidence}/100 (${result.validity.confidenceLevel}).`,
    ...(result.validity.notes.length > 0
      ? ["Validity notes:", ...result.validity.notes.map((n) => `- ${n}`)]
      : []),
    "",
    "Generated by Forge30 for the user to share at their own discretion.",
  ];
  return lines.join("\n");
}
