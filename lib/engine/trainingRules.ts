import type {
  CautionTag,
  ExerciseDef,
  InjuryProfile,
  PainFlags,
  PersonalRecord,
  WorkoutEntry,
} from "@/lib/types";
import { PAIN_RELIEF_DRILLS, allExercises } from "@/lib/data/workoutPlan";
import { cautionTagsForInjuries } from "./workoutBuilder";
import { clamp } from "@/lib/utils";

/**
 * Pain-aware training rules (Section 5.3).
 *
 * Session pain > 6/10 →
 *  - reduce prescribed load 15–25% (scales with pain),
 *  - hide/flag heavy overhead pressing,
 *  - warn against shrugging through reps,
 *  - promote chest-supported rows + neutral-grip pulldowns as swaps,
 *  - append serratus wall slides, dead bugs, side planks, breathing drills.
 */

export interface PainAdjustment {
  active: boolean;
  /** Percent load reduction to apply to prescribed loads (0 when inactive). */
  loadReductionPct: number;
  avoidOverheadPressing: boolean;
  warnAgainstShrugging: boolean;
  /** Exercise ids to promote as pain-safe swaps. */
  suggestedSwapIds: string[];
  /** Prehab drills appended to the session. */
  appendedDrills: ExerciseDef[];
  messages: string[];
}

const NO_ADJUSTMENT: PainAdjustment = {
  active: false,
  loadReductionPct: 0,
  avoidOverheadPressing: false,
  warnAgainstShrugging: false,
  suggestedSwapIds: [],
  appendedDrills: [],
  messages: [],
};

/** The load-scaling math both pain engines share: 7 → 15%, 8 → 20%, 9+ → 25%. */
export function loadReductionForPain(sessionPainScore: number): number {
  if (sessionPainScore <= 6) return 0;
  return Math.min(25, 15 + (sessionPainScore - 7) * 5);
}

/** RIR is RPE's inverse: RPE 8 ≈ 2 reps in reserve (E8-T). */
export function rirFromRpe(rpe: number): number {
  return Math.max(0, Math.min(10, Math.round(10 - rpe)));
}

export function getPainAwareWorkoutAdjustment(args: {
  sessionPainScore: number;
  painFlags: PainFlags;
}): PainAdjustment {
  const { sessionPainScore, painFlags } = args;
  if (sessionPainScore <= 6) return NO_ADJUSTMENT;

  const loadReductionPct = loadReductionForPain(sessionPainScore);

  const messages: string[] = [
    `Pain is ${sessionPainScore}/10 — reduce prescribed loads by ~${loadReductionPct}% today.`,
    "Skip or lighten heavy overhead pressing.",
  ];
  if (painFlags.upperTrapDominant) {
    messages.push("Do not shrug through reps — keep the shoulder blades set and let the target muscle work.");
  }
  if (painFlags.thoracic || painFlags.rib || painFlags.scapular) {
    messages.push("Favor chest-supported rows and neutral-grip pulldowns over free-standing pulls.");
  }
  messages.push("Serratus wall slides, dead bugs, side planks, and breathing drills are added to today's session.");

  return {
    active: true,
    loadReductionPct,
    avoidOverheadPressing: true,
    warnAgainstShrugging: true,
    suggestedSwapIds: ["chest-supported-row", "neutral-grip-pulldown"],
    appendedDrills: PAIN_RELIEF_DRILLS,
    messages,
  };
}

/**
 * Derived view (E5): the boolean PainFlags expressed as structured
 * InjuryProfile records. PainFlags remains the authoritative input to
 * getPainAwareWorkoutAdjustment until E8-T flips the training engine onto
 * InjuryProfile directly; deterministic ids keep the view stable across runs.
 */
export function injuriesFromPainFlags(flags: PainFlags): InjuryProfile[] {
  const defs: { key: keyof PainFlags; bodyArea: string; symptoms: string; aggravating: string[] }[] = [
    { key: "thoracic", bodyArea: "thoracic spine (mid-back)", symptoms: "mid-back pain", aggravating: ["heavy overhead pressing"] },
    { key: "rib", bodyArea: "ribs", symptoms: "rib pain", aggravating: ["heavy overhead pressing", "loaded twisting"] },
    { key: "scapular", bodyArea: "scapula", symptoms: "scapular pain", aggravating: ["free-standing pulls"] },
    { key: "upperTrapDominant", bodyArea: "upper trapezius", symptoms: "over-recruited upper traps", aggravating: ["shrugging through reps"] },
    { key: "leftArmAggravation", bodyArea: "left arm", symptoms: "left-arm aggravation under load", aggravating: ["heavy pressing"] },
  ];
  return defs
    .filter((d) => flags[d.key])
    .map((d) => ({
      id: `painflag:${d.key}`,
      bodyArea: d.bodyArea,
      diagnosis: "",
      symptoms: d.symptoms,
      painScore: 0,
      aggravatingMovements: d.aggravating,
      relievingMovements: ["serratus wall slides", "dead bugs", "breathing drills"],
      medicalRestrictions: "",
      onsetDate: null,
      professionalCare: false,
      notes: "Derived from v1 pain flags.",
    }));
}

/** Best set (heaviest weight, ties broken by reps) per exercise across history. */
export function computePersonalRecords(workouts: WorkoutEntry[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        if (set.weight <= 0 || set.reps <= 0) continue;
        const current = best.get(ex.exerciseId);
        if (
          !current ||
          set.weight > current.weight ||
          (set.weight === current.weight && set.reps > current.reps)
        ) {
          best.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            exerciseName: ex.name,
            weight: set.weight,
            reps: set.reps,
            date: w.date,
          });
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

/** Completed sets per muscle group — feeds the weekly volume heat map. */
export function weeklyVolumeByMuscle(workouts: WorkoutEntry[]): Record<string, number> {
  const volume: Record<string, number> = {};
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const done = ex.sets.filter((s) => s.reps > 0).length;
      if (done > 0) volume[ex.muscleGroup] = (volume[ex.muscleGroup] ?? 0) + done;
    }
  }
  return volume;
}

// --- Generalized injury engine (E8-T) ------------------------------------------

export interface InjurySwapSuggestion {
  avoid: ExerciseDef;
  replaceWith: ExerciseDef | null;
  /** Why this swap is suggested — always explained, never just imposed. */
  why: string;
}

export interface InjuryModification {
  active: boolean;
  /** Same pain-scaling math as the v1 engine (7→15%, 8→20%, 9+→25%). */
  loadReductionPct: number;
  cautionTags: CautionTag[];
  swaps: InjurySwapSuggestion[];
  /** Warm-up / prehab drills to append. */
  appendedDrills: ExerciseDef[];
  messages: string[];
}

const TAG_LABEL: Record<CautionTag, string> = {
  overhead: "overhead loading",
  "spinal-load": "compressive spinal loading",
  shoulder: "shoulder stress",
  elbow: "elbow stress",
  knee: "knee stress",
  hip: "hip stress",
  wrist: "wrist loading",
  "high-impact": "impact",
};

/**
 * generateInjuryModification — the general engine the spec asks for,
 * generalizing getPainAwareWorkoutAdjustment (which keeps covering the
 * seeded thoracic/rib/scapular case). Works from any InjuryProfile: maps the
 * user's own words to caution tags, suggests the closest same-pattern
 * substitute that avoids them, explains why, scales load with today's pain,
 * and appends the prehab drills. Support around training — never treatment,
 * never a clinician substitute.
 */
export function generateInjuryModification(args: {
  injuries: InjuryProfile[];
  sessionPainScore: number;
  plannedExercises?: ExerciseDef[];
}): InjuryModification {
  const { injuries, sessionPainScore } = args;
  const cautionTags = cautionTagsForInjuries(injuries);
  if (injuries.length === 0 || cautionTags.length === 0) {
    return {
      active: false,
      loadReductionPct: loadReductionForPain(sessionPainScore),
      cautionTags: [],
      swaps: [],
      appendedDrills: [],
      messages: [],
    };
  }

  const tagSet = new Set(cautionTags);
  const library = allExercises();
  const planned = args.plannedExercises ?? library;
  const swaps: InjurySwapSuggestion[] = [];

  for (const ex of planned) {
    const hits = (ex.cautions ?? []).filter((c) => tagSet.has(c));
    if (hits.length === 0) continue;
    const replacement =
      library.find(
        (cand) =>
          cand.id !== ex.id &&
          cand.pattern === ex.pattern &&
          cand.category !== "mobility" &&
          !(cand.cautions ?? []).some((c) => tagSet.has(c))
      ) ?? null;
    swaps.push({
      avoid: ex,
      replaceWith: replacement,
      why: `${ex.name} involves ${hits.map((h) => TAG_LABEL[h]).join(" and ")}, which matches what you said aggravates it${
        replacement ? ` — ${replacement.name} trains the same pattern without it` : ""
      }.`,
    });
  }

  const loadReductionPct = loadReductionForPain(sessionPainScore);
  const messages: string[] = [];
  if (loadReductionPct > 0) {
    messages.push(
      `Pain is ${sessionPainScore}/10 today — reduce prescribed loads by ~${loadReductionPct}%, and stop the set on any sharp pain.`
    );
  }
  messages.push(
    `Working around: ${cautionTags.map((t) => TAG_LABEL[t]).join(", ")}. Swaps below keep the training effect without poking it.`
  );
  messages.push(
    "This supports training around a limitation — it doesn't treat it. A clinician, PT, or AT is the right call for the injury itself."
  );

  return {
    active: true,
    loadReductionPct,
    cautionTags,
    swaps: swaps.slice(0, 6),
    appendedDrills: PAIN_RELIEF_DRILLS,
    messages,
  };
}

// --- Red flags (E8-T) — always "seek medical evaluation", never train through ---

export const RED_FLAGS = [
  "Sudden severe pain",
  "Numbness or weakness",
  "Loss of bowel or bladder control",
  "Chest pain",
  "Shortness of breath",
  "Unexplained swelling",
  "Fever with joint pain",
  "Major trauma (fall, collision, accident)",
  "Progressively worsening neurologic symptoms",
] as const;

export interface RedFlagGuidance {
  escalate: boolean;
  message: string;
}

export function redFlagGuidance(present: string[]): RedFlagGuidance {
  if (present.length === 0) {
    return { escalate: false, message: "" };
  }
  return {
    escalate: true,
    message:
      "What you've described is a medical red flag, not a training problem. Do not train through it — seek medical evaluation first. Loss of bowel/bladder control, chest pain, or rapidly worsening symptoms warrant emergency care now.",
  };
}

// --- Readiness (E8-T) -------------------------------------------------------------

export interface ReadinessResult {
  /** 0–100 from sleep, stress, mood, and pain. */
  score: number;
  band: "full" | "reduced" | "minimum";
  suggestion: string;
}

/**
 * calculateReadinessScore — sleep 40%, stress 30%, mood 15%, pain 15%.
 * Bands map to concrete session adjustments; "minimum" pairs with the
 * Minimum Viable Workout, framed as smart planning, never as weakness.
 */
export function calculateReadinessScore(args: {
  sleepHours: number;
  stress: number;
  mood: number;
  painScore: number;
}): ReadinessResult {
  const sleep = clamp((args.sleepHours - 4) / 4, 0, 1); // 4h → 0, 8h → 1
  const stress = args.stress <= 0 ? 0.7 : clamp((10 - args.stress) / 9, 0, 1);
  const mood = args.mood <= 0 ? 0.7 : clamp((args.mood - 1) / 9, 0, 1);
  const pain = clamp((10 - args.painScore) / 10, 0, 1);
  const score = Math.round((sleep * 0.4 + stress * 0.3 + mood * 0.15 + pain * 0.15) * 100);

  if (score >= 70) {
    return { score, band: "full", suggestion: "Green light — run the full session as written." };
  }
  if (score >= 40) {
    return {
      score,
      band: "reduced",
      suggestion:
        "Run the session at ~80%: drop one set per exercise and keep two reps in reserve. Showing up lighter still counts in full.",
    };
  }
  return {
    score,
    band: "minimum",
    suggestion:
      "Today calls for the Minimum Viable Workout — ten easy minutes keeps the habit alive and helps recovery more than pushing through would.",
  };
}

// --- Deload (E8-T) ------------------------------------------------------------------

export interface DeloadSuggestion {
  suggested: boolean;
  reason: string;
}

/**
 * suggestDeload — after 3+ weeks of consistent hard training (≥12 completed
 * sessions in 21 days with recent average top-set RPE ≥ 8), suggest a lighter
 * week. Framed as part of the plan, not a setback.
 */
export function suggestDeload(workouts: WorkoutEntry[], today: string): DeloadSuggestion {
  const windowStart = new Date(new Date(`${today}T00:00:00`).getTime() - 20 * 86400000)
    .toISOString()
    .slice(0, 10);
  const recent = workouts.filter((w) => w.date >= windowStart && w.date <= today && w.status === "complete");
  if (recent.length < 12) return { suggested: false, reason: "" };

  const lastWeekStart = new Date(new Date(`${today}T00:00:00`).getTime() - 6 * 86400000)
    .toISOString()
    .slice(0, 10);
  const rpes = recent
    .filter((w) => w.date >= lastWeekStart)
    .flatMap((w) => w.exercises.flatMap((e) => e.sets.map((s) => s.rpe)))
    .filter((r) => r > 0);
  if (rpes.length === 0) return { suggested: false, reason: "" };
  const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length;
  if (avg < 8) return { suggested: false, reason: "" };

  return {
    suggested: true,
    reason: `${recent.length} sessions in three weeks with last week averaging RPE ${avg.toFixed(1)} — a deload week (same movements, ~50% load, 2 sets) locks in the progress and sets up the next push.`,
  };
}
