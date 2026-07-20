import type {
  EquipmentAccess,
  HybridDay,
  HybridExercise,
  HybridReadinessBand,
  HybridReadinessThresholds,
  HybridSessionState,
  HybridSettings,
  HybridSetLog,
  HybridSubstitution,
  ISODate,
  ISODateTime,
  LoggedExercise,
  WarmupResponse,
  WorkoutEntry,
} from "@/lib/types";
import { hybridDayById, hybridExerciseById, HYBRID_WEEK } from "@/lib/data/hybridProgram";

/**
 * Hybrid Athletic Bodybuilding engine (HT Phases 5/6/9/10/11) — pure.
 * Readiness classification (configurable thresholds), pain-aware volume
 * adjustment, mesocycle periodization, progression suggestions, substitution
 * filtering, and schedule variants. No storage, no Date.now(), no React.
 *
 * Safety framing: bands describe *training guidance*, never medical fact.
 * Red-band copy directs to professional evaluation and is never softened.
 */

// --- Readiness (Phase 5) -----------------------------------------------------

export const DEFAULT_HYBRID_THRESHOLDS: HybridReadinessThresholds = {
  yellowPain: 3,
  orangePain: 5,
  redPain: 7,
};

export const DEFAULT_HYBRID_SETTINGS: HybridSettings = {
  enabled: false,
  daysPerWeek: 6,
  boxingDaysPerWeek: 2,
  sessionMinutes: 75,
  equipment: "fullGym",
  experience: "intermediate",
  boxingExperience: "some",
  aestheticPriorities: [],
  avoidTrapEmphasis: false,
  thresholds: DEFAULT_HYBRID_THRESHOLDS,
  mesoStartDate: null,
  mesoWeeks: 4,
  repeatWeek: null,
  preferredSubs: {},
};

export interface HybridReadinessInput {
  painScore: number;
  /** Any entry forces red (neurological / systemic red flags). */
  neuroSymptoms: string[];
  sleepHours?: number;
  /** 1–5 self-ratings; omit when not collected. */
  energy?: number;
  soreness?: number;
  warmupResponse?: WarmupResponse;
}

export interface HybridReadinessResult {
  band: HybridReadinessBand;
  /** Human-readable reasons for the classification (shown in the UI). */
  reasons: string[];
  guidance: string;
}

const RED_GUIDANCE =
  "Stop — do not train today. What you've reported is a red flag, not a training problem. Seek professional medical evaluation; chest pain, breathing difficulty, loss of bowel/bladder control, or rapidly worsening neurological symptoms warrant emergency care now. This app cannot assess injuries.";

const ORANGE_GUIDANCE =
  "Strength work is replaced with recovery today: gentle mobility, light cardio, or pain-free technique work only. Heavy lifting at this pain level tends to set recovery back, not forward. If this persists across sessions, a professional evaluation is worth it.";

const YELLOW_GUIDANCE =
  "Run a reduced session: about 20–30% fewer working sets, effort capped at RPE 6–7, supported or machine variations where available, no maximal explosive work, and a longer warm-up. Showing up lighter still counts in full.";

const GREEN_GUIDANCE = "Green — run the programmed session at normal volume and intensity.";

/**
 * classifyHybridReadiness — pain-primary green/yellow/orange/red model with
 * configurable pain thresholds. Neurological symptoms force red regardless of
 * the pain score; a warm-up that worsens symptoms forces at least orange;
 * short sleep, low energy, or heavy soreness raise green to yellow.
 */
export function classifyHybridReadiness(
  input: HybridReadinessInput,
  thresholds: HybridReadinessThresholds = DEFAULT_HYBRID_THRESHOLDS
): HybridReadinessResult {
  const reasons: string[] = [];

  if (input.neuroSymptoms.length > 0) {
    return {
      band: "red",
      reasons: input.neuroSymptoms.map((s) => `Red flag reported: ${s}`),
      guidance: RED_GUIDANCE,
    };
  }
  if (input.painScore >= thresholds.redPain) {
    return {
      band: "red",
      reasons: [`Pain ${input.painScore}/10 is at or above the stop threshold (${thresholds.redPain})`],
      guidance: RED_GUIDANCE,
    };
  }

  if (input.painScore >= thresholds.orangePain) {
    reasons.push(`Pain ${input.painScore}/10 is in the recovery-only range (${thresholds.orangePain}+)`);
  }
  if (input.warmupResponse === "worse") {
    reasons.push("Symptoms worsened during the warm-up");
  }
  if (reasons.length > 0) {
    return { band: "orange", reasons, guidance: ORANGE_GUIDANCE };
  }

  if (input.painScore >= thresholds.yellowPain) {
    reasons.push(`Pain ${input.painScore}/10 calls for a reduced session (${thresholds.yellowPain}+)`);
  }
  if (input.sleepHours !== undefined && input.sleepHours < 6) {
    reasons.push(`Short sleep (${input.sleepHours}h)`);
  }
  if (input.energy !== undefined && input.energy <= 2) {
    reasons.push("Low energy today");
  }
  if (input.soreness !== undefined && input.soreness >= 4) {
    reasons.push("Heavy soreness");
  }
  if (reasons.length > 0) {
    return { band: "yellow", reasons, guidance: YELLOW_GUIDANCE };
  }

  return { band: "green", reasons: ["Pain low, no red flags, energy normal"], guidance: GREEN_GUIDANCE };
}

export interface ReadinessAdjustment {
  /** Multiplier on working sets (yellow ≈ 0.75 → 20–30% reduction). */
  setsMultiplier: number;
  /** Cap on target effort, or null for as-programmed. */
  rpeCap: number | null;
  /** Skip maximal explosive work (yellow+). */
  dropExplosive: boolean;
  /** Replace strength work with recovery/mobility/light cardio (orange). */
  recoveryOnly: boolean;
  /** Do not train (red). */
  stop: boolean;
}

export function readinessAdjustment(band: HybridReadinessBand): ReadinessAdjustment {
  switch (band) {
    case "green":
      return { setsMultiplier: 1, rpeCap: null, dropExplosive: false, recoveryOnly: false, stop: false };
    case "yellow":
      return { setsMultiplier: 0.75, rpeCap: 7, dropExplosive: true, recoveryOnly: false, stop: false };
    case "orange":
      return { setsMultiplier: 0, rpeCap: null, dropExplosive: true, recoveryOnly: true, stop: false };
    case "red":
      return { setsMultiplier: 0, rpeCap: null, dropExplosive: true, recoveryOnly: false, stop: true };
  }
}

/** Working sets after the band's volume adjustment (never below 1 on yellow). */
export function adjustedSetCount(baseSets: number, band: HybridReadinessBand): number {
  const adj = readinessAdjustment(band);
  if (adj.stop || adj.recoveryOnly) return 0;
  if (adj.setsMultiplier >= 1) return baseSets;
  return Math.max(1, Math.round(baseSets * adj.setsMultiplier));
}

// --- Periodization (Phase 10) ------------------------------------------------

export interface MesoWeek {
  /** 1-based calendar week within the (possibly extended) cycle. */
  week: number;
  /** Total calendar weeks in the cycle (mesoWeeks + 1 when a week repeats). */
  totalWeeks: number;
  label: string;
  rpeRange: [number, number];
  /** Multiplier on working-set volume. */
  volumeMultiplier: number;
  /** Multiplier on load/intensity (deload ≈ 0.85 → 10–20% reduction). */
  intensityMultiplier: number;
  isDeload: boolean;
  /** True when this calendar week is the configured repeat of a template week. */
  isRepeat: boolean;
}

interface MesoTemplateWeek {
  label: string;
  rpeRange: [number, number];
  volumeMultiplier: number;
  intensityMultiplier: number;
  isDeload: boolean;
}

const wk = (
  label: string,
  rpeRange: [number, number],
  volumeMultiplier: number,
  intensityMultiplier = 1,
  isDeload = false
): MesoTemplateWeek => ({ label, rpeRange, volumeMultiplier, intensityMultiplier, isDeload });

const DELOAD = wk("Deload", [5, 6], 0.55, 0.85, true);

/** Week templates per cycle length. Last week is always the deload. */
export const MESO_TEMPLATES: Record<4 | 5 | 6 | 8, MesoTemplateWeek[]> = {
  4: [wk("Base", [6, 7], 0.9), wk("Build", [7, 8], 1), wk("Peak", [8, 9], 1.1), DELOAD],
  5: [wk("Base", [6, 7], 0.9), wk("Build", [7, 8], 1), wk("Build 2", [7, 8], 1.05), wk("Peak", [8, 9], 1.1), DELOAD],
  6: [
    wk("Base", [6, 7], 0.9),
    wk("Base 2", [6, 7], 0.95),
    wk("Build", [7, 8], 1),
    wk("Build 2", [7, 8], 1.05),
    wk("Peak", [8, 9], 1.1),
    DELOAD,
  ],
  8: [
    wk("Base", [6, 7], 0.9),
    wk("Base 2", [6, 7], 0.95),
    wk("Build", [7, 8], 1),
    wk("Build 2", [7, 8], 1),
    wk("Build 3", [7, 8], 1.05),
    wk("Peak", [8, 9], 1.1),
    wk("Peak 2", [8, 9], 1.1),
    DELOAD,
  ],
};

const daysBetween = (from: ISODate, to: ISODate): number =>
  Math.floor((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);

/**
 * mesocycleWeek — resolve today's position in the cycle. A configured
 * repeatWeek (1-based template week) runs twice, extending the calendar cycle
 * by one week; cycles wrap (a new cycle starts after the deload).
 */
export function mesocycleWeek(
  startDate: ISODate | null,
  today: ISODate,
  mesoWeeks: 4 | 5 | 6 | 8 = 4,
  repeatWeek: number | null = null
): MesoWeek {
  const template = MESO_TEMPLATES[mesoWeeks];
  const repeat = repeatWeek !== null && repeatWeek >= 1 && repeatWeek <= template.length ? repeatWeek : null;
  const totalWeeks = template.length + (repeat !== null ? 1 : 0);

  let calendarWeek = 1;
  if (startDate) {
    const days = daysBetween(startDate, today);
    const raw = days >= 0 ? Math.floor(days / 7) : 0;
    calendarWeek = (raw % totalWeeks) + 1;
  }

  const templateIndex =
    repeat !== null && calendarWeek > repeat ? calendarWeek - 2 : calendarWeek - 1;
  const t = template[Math.min(templateIndex, template.length - 1)]!;
  const isRepeat = repeat !== null && calendarWeek === repeat + 1;

  return {
    week: calendarWeek,
    totalWeeks,
    label: isRepeat ? `${t.label} (repeat)` : t.label,
    rpeRange: t.rpeRange,
    volumeMultiplier: t.volumeMultiplier,
    intensityMultiplier: t.intensityMultiplier,
    isDeload: t.isDeload,
    isRepeat,
  };
}

/** Working sets after the mesocycle-week volume multiplier (min 1). */
export function mesoAdjustedSets(baseSets: number, week: MesoWeek): number {
  return Math.max(1, Math.round(baseSets * week.volumeMultiplier));
}

// --- Progression (Phase 9) ---------------------------------------------------

export type ProgressionKind = "double" | "strength" | "explosive";

export function progressionKindFor(ex: HybridExercise): ProgressionKind {
  if (ex.explosive) return "explosive";
  if (ex.qualities.includes("strength") && !ex.qualities.includes("hypertrophy")) return "strength";
  return "double";
}

export interface SetSummary {
  weight: number;
  reps: number;
  rpe: number;
  rir?: number;
}

export interface ProgressionSuggestion {
  action: "addLoad" | "addReps" | "hold" | "backOff" | "qualityFirst" | "baseline";
  detail: string;
}

/** Extract [low, high] from a prescription like "8–12", "6-8", or "5". */
export function parseRepRange(reps: string): [number, number] | null {
  const m = reps.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const single = reps.match(/^(\d+)/);
  if (single && !/m$|min|round|step|s\b/.test(reps)) return [Number(single[1]), Number(single[1])];
  return null;
}

/** Epley estimated one-rep max. */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

const working = (sets: SetSummary[]) => sets.filter((s) => s.reps > 0);
const avgRpe = (sets: SetSummary[]) => {
  const rated = sets.filter((s) => s.rpe > 0);
  return rated.length === 0 ? 0 : rated.reduce((a, s) => a + s.rpe, 0) / rated.length;
};
const best1RM = (sets: SetSummary[]) => Math.max(0, ...sets.map((s) => epley1RM(s.weight, s.reps)));

/**
 * suggestProgression — the three-track model:
 * - double: hold load until every working set reaches the top of the range at
 *   target effort, then add the smallest practical increment;
 * - strength: progress on e1RM trend, backing off after repeated RPE ≥ 9
 *   sessions instead of forcing weekly increases;
 * - explosive: quality-first, never fatigue-driven.
 */
export function suggestProgression(
  kind: ProgressionKind,
  repText: string,
  lastSession: SetSummary[],
  previousSession: SetSummary[] = []
): ProgressionSuggestion {
  if (kind === "explosive") {
    return {
      action: "qualityFirst",
      detail:
        "Progress by speed and crispness, not load or fatigue. End every set the moment output visibly drops; add small load only while movement speed holds.",
    };
  }

  const last = working(lastSession);
  if (last.length === 0) {
    return { action: "baseline", detail: "Log a session first — the baseline sets the progression." };
  }

  if (kind === "strength") {
    const lastAvg = avgRpe(last);
    const prevAvg = avgRpe(working(previousSession));
    if (lastAvg >= 9 && prevAvg >= 9) {
      return {
        action: "backOff",
        detail: `Two sessions averaging RPE ${lastAvg.toFixed(1)} — hold or reduce load ~5% and rebuild. Repeated grinding stalls strength.`,
      };
    }
    const lastMax = best1RM(last);
    const prevMax = best1RM(working(previousSession));
    if (prevMax > 0 && lastMax >= prevMax && lastAvg <= 8) {
      return {
        action: "addLoad",
        detail: `e1RM trending up (${prevMax} → ${lastMax}) at RPE ≤ 8 — add the smallest increment next session.`,
      };
    }
    return {
      action: "hold",
      detail: "Hold the load and own the reps — progress strength on the e1RM trend, never forced weekly jumps.",
    };
  }

  // double progression
  const range = parseRepRange(repText);
  if (!range) {
    return { action: "hold", detail: "Timed or distance work — progress duration or load once quality is easy." };
  }
  const [, top] = range;
  const allAtTop = last.every((s) => s.reps >= top);
  const effortOk = last.every((s) => (s.rir !== undefined ? s.rir >= 1 : s.rpe <= 8.5 || s.rpe === 0));
  if (allAtTop && effortOk) {
    return {
      action: "addLoad",
      detail: `All sets at the top of ${repText} with reps in reserve — add the smallest practical increment and rebuild from the bottom of the range.`,
    };
  }
  return {
    action: "addReps",
    detail: `Same load — work each set toward ${top} reps with 1–2 in reserve before adding weight.`,
  };
}

// --- Substitutions (Phase 6) -------------------------------------------------

const EQUIPMENT_RANK: Record<EquipmentAccess, number> = {
  none: 0,
  minimal: 1,
  homeGym: 2,
  fullGym: 3,
};

/**
 * filterSubstitutions — keep options within the user's equipment tier;
 * annotate (rather than hide) nothing: options above the tier are excluded,
 * matching how the workout builder treats equipment.
 */
export function filterSubstitutions(
  subs: HybridSubstitution[],
  equipment: EquipmentAccess
): HybridSubstitution[] {
  return subs.filter((s) => EQUIPMENT_RANK[s.equipment] <= EQUIPMENT_RANK[equipment]);
}

/** The exercise to show for a slot, honoring session then remembered subs. */
export function resolveSlotExercise(
  slotId: string,
  sessionSubs: Record<string, string>,
  preferredSubs: Record<string, string>
): { exerciseId: string; substituted: boolean } {
  const subId = sessionSubs[slotId] ?? preferredSubs[slotId];
  if (subId && subId !== slotId) return { exerciseId: subId, substituted: true };
  return { exerciseId: slotId, substituted: false };
}

// --- Schedule variants (Phase 11) -------------------------------------------

/**
 * weeklySchedule — weekday (0 = Monday) → hybrid day id for each program
 * length. Recovery Sunday is universal; lower day counts keep the highest-
 * value sessions (upper/lower balance first, athletic day at 5+).
 */
export function weeklySchedule(daysPerWeek: 3 | 4 | 5 | 6): Record<number, string> {
  switch (daysPerWeek) {
    case 6:
      return Object.fromEntries(HYBRID_WEEK.map((d) => [d.weekday, d.id]));
    case 5:
      return {
        0: "upper-a",
        1: "lower-a",
        2: "recovery-sunday",
        3: "upper-b",
        4: "lower-b",
        5: "athletic-boxing",
        6: "recovery-sunday",
      };
    case 4:
      return {
        0: "upper-a",
        1: "lower-a",
        2: "recovery-boxing",
        3: "upper-b",
        4: "lower-b",
        5: "recovery-sunday",
        6: "recovery-sunday",
      };
    case 3:
      return {
        0: "upper-a",
        1: "recovery-sunday",
        2: "lower-a",
        3: "recovery-sunday",
        4: "recovery-boxing",
        5: "athletic-boxing",
        6: "recovery-sunday",
      };
  }
}

const mondayIndex = (date: ISODate): number => {
  const js = new Date(`${date}T00:00:00`).getDay(); // 0 = Sunday
  return (js + 6) % 7;
};

export function hybridDayForDate(date: ISODate, daysPerWeek: 3 | 4 | 5 | 6): HybridDay {
  const id = weeklySchedule(daysPerWeek)[mondayIndex(date)] ?? "recovery-sunday";
  return hybridDayById(id) ?? HYBRID_WEEK[6]!;
}

// --- Aesthetic emphasis + trap guard (Phase 11) ------------------------------

export interface EmphasisPlan {
  /** Priorities that earn +1 accessory set on their focused slots. */
  emphasized: string[];
  /** Priorities suppressed by the trap-dominance guard, with the reason. */
  suppressed: Array<{ priority: string; reason: string }>;
}

/**
 * accessoryEmphasis — aesthetic priorities add accessory volume, except that
 * the trap-dominance guard removes neck/trap emphasis for users who report
 * trap dominance, neck pain, scapular discomfort, or thoracic symptoms.
 */
export function accessoryEmphasis(
  priorities: string[],
  avoidTrapEmphasis: boolean
): EmphasisPlan {
  const emphasized: string[] = [];
  const suppressed: EmphasisPlan["suppressed"] = [];
  for (const p of priorities) {
    if (p === "neckTraps" && avoidTrapEmphasis) {
      suppressed.push({
        priority: p,
        reason:
          "Trap-dominance guard: extra upper-trap volume is skipped with reported trap dominance or neck/scapular/thoracic symptoms. Lower-trap and serratus work in the mobility library covers this base safely.",
      });
      continue;
    }
    emphasized.push(p);
  }
  return { emphasized, suppressed };
}

// --- Session → WorkoutEntry (Phase 8 persistence bridge) ---------------------

/**
 * sessionToWorkoutEntry — freeze the in-flight hybrid session into the app's
 * canonical WorkoutEntry shape, so PRs, weekly volume, deload detection, the
 * heat map, and CSV export all keep working with zero new plumbing.
 */
export function sessionToWorkoutEntry(
  state: HybridSessionState,
  nowIso: ISODateTime
): WorkoutEntry {
  const day = hybridDayById(state.dayId);
  const exercises: LoggedExercise[] = [];
  let maxPain = 0;

  for (const [slotId, sets] of Object.entries(state.setLogs)) {
    if (sets.length === 0) continue;
    const resolved = resolveSlotExercise(slotId, state.substitutions, {});
    const def = hybridExerciseById(resolved.exerciseId) ?? hybridExerciseById(slotId);
    const slotDef = hybridExerciseById(slotId);
    const subMeta = slotDef?.substitutions.find((s) => s.id === resolved.exerciseId);
    for (const s of sets) {
      maxPain = Math.max(maxPain, s.painBefore, s.painAfter);
    }
    exercises.push({
      exerciseId: resolved.exerciseId,
      name: def?.name ?? subMeta?.name ?? resolved.exerciseId,
      muscleGroup: def?.primaryMuscles[0] ?? slotDef?.primaryMuscles[0] ?? "fullBody",
      sets: sets
        .filter((s) => !s.isWarmup)
        .map((s, i) => ({
          exerciseId: resolved.exerciseId,
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
          rir: s.rir,
          painScore: Math.max(s.painBefore, s.painAfter),
          note: s.note || (s.failed ? "failed set" : i === 0 && s.leftWeight ? `L ${s.leftWeight} / R ${s.rightWeight}` : ""),
        })),
      ...(resolved.substituted ? { swappedFromId: slotId } : {}),
    });
  }

  return {
    id: `hybrid-${state.date}-${state.dayId}`,
    date: state.date,
    splitLabel: `Hybrid — ${day?.label ?? state.dayId}`,
    status: "complete",
    warmupDone: true,
    exercises,
    startedAt: state.startedAt,
    completedAt: nowIso,
    sessionPainScore: maxPain,
    note: [
      state.painFlagged.length > 0 ? `Pain-provoking: ${state.painFlagged.join(", ")}` : "",
      ...Object.entries(state.stopReasons).map(([id, r]) => `Stopped ${id}: ${r}`),
      ...state.aiModifications.map((m) => `AI modification accepted: ${m}`),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Empty in-flight session for a day. */
export function newSessionState(
  date: ISODate,
  dayId: string,
  band: HybridReadinessBand,
  nowIso: ISODateTime,
  preferredSubs: Record<string, string> = {}
): HybridSessionState {
  return {
    date,
    dayId,
    startedAt: nowIso,
    readinessBand: band,
    currentIndex: 0,
    substitutions: { ...preferredSubs },
    setLogs: {},
    setAdjustments: {},
    skipped: [],
    painFlagged: [],
    stopReasons: {},
    aiModifications: [],
  };
}

/** Planned working sets for a slot after readiness + mesocycle adjustments. */
export function plannedSets(
  ex: HybridExercise,
  band: HybridReadinessBand,
  week: MesoWeek,
  adjustment = 0
): number {
  const afterBand = adjustedSetCount(ex.sets, band);
  if (afterBand === 0) return 0;
  return Math.max(1, mesoAdjustedSets(afterBand, week) + adjustment);
}

/** Completed non-warmup sets across the session. */
export function completedSetCount(state: HybridSessionState): number {
  return Object.values(state.setLogs).reduce(
    (n, sets) => n + sets.filter((s) => !s.isWarmup).length,
    0
  );
}

export function hybridSetToSummary(s: HybridSetLog): SetSummary {
  return { weight: s.weight, reps: s.reps, rpe: s.rpe, rir: s.rir };
}
