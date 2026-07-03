import type {
  ExerciseDef,
  InjuryProfile,
  PainFlags,
  PersonalRecord,
  WorkoutEntry,
} from "@/lib/types";
import { PAIN_RELIEF_DRILLS } from "@/lib/data/workoutPlan";

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

export function getPainAwareWorkoutAdjustment(args: {
  sessionPainScore: number;
  painFlags: PainFlags;
}): PainAdjustment {
  const { sessionPainScore, painFlags } = args;
  if (sessionPainScore <= 6) return NO_ADJUSTMENT;

  // 7 → 15%, 8 → 20%, 9+ → 25%.
  const loadReductionPct = Math.min(25, 15 + (sessionPainScore - 7) * 5);

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
