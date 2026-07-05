import type { ExerciseDef, ISODate, WorkoutDayPlan } from "@/lib/types";
import { mondayWeekday } from "@/lib/utils";

/**
 * Seeded weekly split (Section 5.3). Pain-safe swaps reference exercise ids;
 * the pain rules engine (lib/engine/trainingRules.ts) promotes
 * chest-supported rows and neutral-grip pulldowns when session pain is high.
 */

// Pain-safe swap pool available from any exercise's swap sheet.
export const SWAP_POOL: ExerciseDef[] = [
  { id: "chest-supported-row", name: "Chest-supported row", muscleGroup: "back", prescription: "4×8–12", pattern: "pull", equipment: "fullGym", difficulty: 1, category: "strength" },
  { id: "neutral-grip-pulldown", name: "Neutral-grip pulldown", muscleGroup: "back", prescription: "4×10–12", pattern: "pull", equipment: "fullGym", difficulty: 1, category: "strength" },
  { id: "machine-chest-press", name: "Machine chest press", muscleGroup: "chest", prescription: "3×10–15", pattern: "push", equipment: "fullGym", difficulty: 1, category: "strength" },
  { id: "push-ups", name: "Push-ups", muscleGroup: "chest", prescription: "3×10–15", pattern: "push", equipment: "none", difficulty: 1, category: "strength", cautions: ["wrist"] },
  { id: "rope-triceps-pushdown", name: "Rope triceps pushdown", muscleGroup: "triceps", prescription: "3×12–15", pattern: "push", equipment: "fullGym", difficulty: 1, category: "strength", cautions: ["elbow"] },
  { id: "floor-press", name: "DB floor press", muscleGroup: "chest", prescription: "3×8–12", pattern: "push", equipment: "minimal", difficulty: 1, category: "strength" },
  { id: "goblet-squat", name: "Goblet squat", muscleGroup: "quads", prescription: "4×8–10", pattern: "squat", equipment: "minimal", difficulty: 1, category: "strength", cautions: ["knee"] },
  { id: "leg-press", name: "Leg press", muscleGroup: "quads", prescription: "4×10–12", pattern: "squat", equipment: "fullGym", difficulty: 1, category: "strength", cautions: ["knee"] },
  { id: "hamstring-curl", name: "Hamstring curl", muscleGroup: "hamstrings", prescription: "3×12", pattern: "hinge", equipment: "fullGym", difficulty: 1, category: "strength" },
  { id: "cable-lateral-raise", name: "Cable lateral raise (light)", muscleGroup: "shoulders", prescription: "3×15–20", pattern: "push", equipment: "fullGym", difficulty: 1, category: "strength", cautions: ["shoulder"] },
];

export const WORKOUT_PLAN: WorkoutDayPlan[] = [
  {
    weekday: 0,
    label: "Upper Push + Shoulders",
    isRest: false,
    exercises: [
      { id: "incline-db-press", name: "Incline DB press", muscleGroup: "chest", prescription: "4×8–12", swaps: ["machine-chest-press", "push-ups", "floor-press"], pattern: "push", equipment: "minimal", difficulty: 2, category: "strength", cautions: ["shoulder"] },
      { id: "machine-chest-press", name: "Machine chest press or push-ups", muscleGroup: "chest", prescription: "3×10–15", swaps: ["push-ups", "floor-press"], pattern: "push", equipment: "fullGym", difficulty: 1, category: "strength" },
      { id: "cable-fly", name: "Cable fly", muscleGroup: "chest", prescription: "3×12–15", swaps: ["push-ups"], pattern: "push", equipment: "fullGym", difficulty: 2, category: "strength", cautions: ["shoulder"] },
      { id: "lateral-raise", name: "Lateral raises", muscleGroup: "shoulders", prescription: "4×15–25", swaps: ["cable-lateral-raise"], pattern: "push", equipment: "minimal", difficulty: 1, category: "strength", cautions: ["shoulder"] },
      { id: "rope-triceps-pushdown", name: "Rope triceps pushdown", muscleGroup: "triceps", prescription: "3×12–15", pattern: "push", equipment: "fullGym", difficulty: 1, category: "strength", cautions: ["elbow"] },
      { id: "serratus-cable-punch", name: "Serratus cable punch", muscleGroup: "shoulders", prescription: "3×12/side", perSide: true, pattern: "push", equipment: "fullGym", difficulty: 1, category: "prehab", unilateral: true },
    ],
  },
  {
    weekday: 1,
    label: "Lower Strength",
    isRest: false,
    exercises: [
      { id: "trap-bar-dl", name: "Trap bar DL or RDL", muscleGroup: "hamstrings", prescription: "4×6–8", swaps: ["leg-press", "hamstring-curl"], pattern: "hinge", equipment: "fullGym", difficulty: 3, category: "strength", cautions: ["spinal-load", "hip"] },
      { id: "leg-press", name: "Leg press", muscleGroup: "quads", prescription: "4×10–12", swaps: ["goblet-squat"], pattern: "squat", equipment: "fullGym", difficulty: 1, category: "strength", cautions: ["knee"] },
      { id: "bulgarian-split-squat", name: "Bulgarian split squat", muscleGroup: "quads", prescription: "3×8/side", perSide: true, swaps: ["goblet-squat", "leg-press"], pattern: "squat", equipment: "minimal", difficulty: 2, category: "strength", unilateral: true, cautions: ["knee"] },
      { id: "hamstring-curl", name: "Hamstring curl", muscleGroup: "hamstrings", prescription: "3×12", pattern: "hinge", equipment: "fullGym", difficulty: 1, category: "strength" },
      { id: "calf-raise", name: "Calf raise", muscleGroup: "calves", prescription: "4×12–20", pattern: "squat", equipment: "none", difficulty: 1, category: "strength" },
      { id: "plank", name: "Plank", muscleGroup: "core", prescription: "3×45s", pattern: "core", equipment: "none", difficulty: 1, category: "strength" },
    ],
  },
  {
    weekday: 2,
    label: "Pull + Scapular Control",
    isRest: false,
    exercises: [
      { id: "chest-supported-row", name: "Chest-supported row", muscleGroup: "back", prescription: "4×8–12", pattern: "pull", equipment: "fullGym", difficulty: 1, category: "strength" },
      { id: "neutral-grip-pulldown", name: "Neutral-grip pulldown", muscleGroup: "back", prescription: "4×10–12", pattern: "pull", equipment: "fullGym", difficulty: 1, category: "strength" },
      { id: "single-arm-cable-row", name: "Single-arm cable row", muscleGroup: "back", prescription: "3×12/side", perSide: true, swaps: ["chest-supported-row"], pattern: "pull", equipment: "fullGym", difficulty: 1, category: "strength", unilateral: true },
      { id: "rear-delt-fly", name: "Rear delt fly", muscleGroup: "shoulders", prescription: "4×15–20", pattern: "pull", equipment: "minimal", difficulty: 1, category: "strength" },
      { id: "incline-curls", name: "Incline curls", muscleGroup: "biceps", prescription: "3×10–12", pattern: "pull", equipment: "minimal", difficulty: 1, category: "strength", cautions: ["elbow"] },
      { id: "face-pulls", name: "Face pulls", muscleGroup: "shoulders", prescription: "3×15–20", pattern: "pull", equipment: "fullGym", difficulty: 1, category: "prehab" },
    ],
  },
  {
    weekday: 3,
    label: "Mobility + Core + Zone 2",
    isRest: false,
    exercises: [
      { id: "zone2-cardio", name: "Zone 2 cardio", muscleGroup: "fullBody", prescription: "30–40 min", pattern: "cardio", equipment: "none", difficulty: 1, category: "cardio" },
      { id: "mcgill-curl-up", name: "McGill curl-up", muscleGroup: "core", prescription: "3×8", pattern: "core", equipment: "none", difficulty: 1, category: "prehab" },
      { id: "side-plank", name: "Side plank", muscleGroup: "core", prescription: "3×30s/side", perSide: true, pattern: "core", equipment: "none", difficulty: 1, category: "prehab", unilateral: true },
      { id: "bird-dog", name: "Bird dog", muscleGroup: "core", prescription: "3×8/side", perSide: true, pattern: "core", equipment: "none", difficulty: 1, category: "prehab", unilateral: true },
      { id: "thoracic-extension-foam", name: "Thoracic extension on foam roller", muscleGroup: "back", prescription: "2 min", pattern: "mobility", equipment: "minimal", difficulty: 1, category: "mobility" },
      { id: "deep-breathing", name: "Deep breathing", muscleGroup: "core", prescription: "5 min", pattern: "mobility", equipment: "none", difficulty: 1, category: "mobility" },
    ],
  },
  {
    weekday: 4,
    label: "Upper Hypertrophy",
    isRest: false,
    exercises: [
      { id: "db-bench", name: "DB bench", muscleGroup: "chest", prescription: "4×8–12", swaps: ["machine-chest-press", "floor-press", "push-ups"], pattern: "push", equipment: "minimal", difficulty: 2, category: "strength", cautions: ["shoulder"] },
      { id: "lat-pulldown", name: "Lat pulldown", muscleGroup: "back", prescription: "4×10–12", swaps: ["neutral-grip-pulldown"], pattern: "pull", equipment: "fullGym", difficulty: 1, category: "strength" },
      { id: "seated-cable-row", name: "Seated cable row", muscleGroup: "back", prescription: "3×12", swaps: ["chest-supported-row"], pattern: "pull", equipment: "fullGym", difficulty: 1, category: "strength" },
      { id: "lateral-raise-dropset", name: "Lateral raise mechanical dropset", muscleGroup: "shoulders", prescription: "×3", swaps: ["cable-lateral-raise"], pattern: "push", equipment: "minimal", difficulty: 3, category: "strength", cautions: ["shoulder"] },
      { id: "cable-curls", name: "Cable curls", muscleGroup: "biceps", prescription: "3×12–15", pattern: "pull", equipment: "fullGym", difficulty: 1, category: "strength", cautions: ["elbow"] },
      { id: "overhead-rope-triceps", name: "Overhead rope triceps", muscleGroup: "triceps", prescription: "3×12–15", overheadPressing: true, swaps: ["rope-triceps-pushdown"], pattern: "push", equipment: "fullGym", difficulty: 2, category: "strength", cautions: ["overhead", "shoulder", "elbow"] },
    ],
  },
  {
    weekday: 5,
    label: "Lower/Athletic + Arms",
    isRest: false,
    exercises: [
      { id: "front-goblet-squat", name: "Front or goblet squat", muscleGroup: "quads", prescription: "4×8–10", swaps: ["leg-press"], pattern: "squat", equipment: "minimal", difficulty: 2, category: "strength", cautions: ["knee", "spinal-load"] },
      { id: "walking-lunges", name: "Walking lunges", muscleGroup: "quads", prescription: "3×12/side", perSide: true, swaps: ["leg-press"], pattern: "squat", equipment: "none", difficulty: 2, category: "strength", unilateral: true, cautions: ["knee"] },
      { id: "hip-thrust", name: "Hip thrust", muscleGroup: "glutes", prescription: "4×10–12", pattern: "hinge", equipment: "minimal", difficulty: 1, category: "strength", cautions: ["hip"] },
      { id: "leg-extension", name: "Leg extension", muscleGroup: "quads", prescription: "3×15", pattern: "squat", equipment: "fullGym", difficulty: 1, category: "strength", cautions: ["knee"] },
      { id: "hammer-curls", name: "Hammer curls", muscleGroup: "biceps", prescription: "3×12", pattern: "pull", equipment: "minimal", difficulty: 1, category: "strength" },
      { id: "dips-assisted", name: "Dips or assisted dips", muscleGroup: "triceps", prescription: "3×8–12", swaps: ["rope-triceps-pushdown", "push-ups"], pattern: "push", equipment: "fullGym", difficulty: 2, category: "strength", cautions: ["shoulder", "elbow"] },
      { id: "farmer-carries", name: "Farmer carries", muscleGroup: "fullBody", prescription: "×4", pattern: "carry", equipment: "minimal", difficulty: 1, category: "strength" },
    ],
  },
  {
    weekday: 6,
    label: "Rest",
    isRest: true,
    exercises: [],
  },
];

export function getWorkoutPlanForDate(date: ISODate): WorkoutDayPlan {
  return WORKOUT_PLAN[mondayWeekday(date)] ?? WORKOUT_PLAN[6]!;
}

/** Daily warm-up — a checklist gate before every session. */
export const WARMUP_CHECKLIST = [
  { id: "incline-walk", label: "5 min incline walk / bike" },
  { id: "dead-bug", label: "Dead bug 2×10" },
  { id: "serratus-wall-slides", label: "Serratus wall slides 2×12" },
  { id: "band-pull-aparts", label: "Band pull-aparts 2×20" },
  { id: "hip-flexor-stretch", label: "Hip flexor stretch 60s/side" },
  { id: "scapular-push-ups", label: "Scapular push-ups 2×10" },
] as const;

/** Prehab drills the pain engine appends to a session when pain runs high. */
export const PAIN_RELIEF_DRILLS: ExerciseDef[] = [
  { id: "serratus-wall-slides-drill", name: "Serratus wall slides", muscleGroup: "shoulders", prescription: "2×12" },
  { id: "dead-bug-drill", name: "Dead bugs", muscleGroup: "core", prescription: "2×10" },
  { id: "side-plank-drill", name: "Side planks", muscleGroup: "core", prescription: "2×30s/side", perSide: true },
  { id: "breathing-drill", name: "Deep breathing drill", muscleGroup: "core", prescription: "3 min" },
];

/**
 * Library extension (E8-T): bodyweight/minimal options so the workout builder
 * can program every equipment tier, plus barbell staples for full gyms.
 */
export const EXTRA_LIBRARY: ExerciseDef[] = [
  { id: "bw-squat", name: "Bodyweight squat", muscleGroup: "quads", prescription: "3×15–20", pattern: "squat", equipment: "none", difficulty: 1, category: "strength", cautions: ["knee"] },
  { id: "glute-bridge", name: "Glute bridge", muscleGroup: "glutes", prescription: "3×12–15", pattern: "hinge", equipment: "none", difficulty: 1, category: "strength" },
  { id: "db-rdl", name: "DB Romanian deadlift", muscleGroup: "hamstrings", prescription: "3×10–12", pattern: "hinge", equipment: "minimal", difficulty: 2, category: "strength", cautions: ["spinal-load", "hip"] },
  { id: "band-row", name: "Band row", muscleGroup: "back", prescription: "3×12–15", pattern: "pull", equipment: "minimal", difficulty: 1, category: "strength" },
  { id: "inverted-row", name: "Inverted row", muscleGroup: "back", prescription: "3×8–12", pattern: "pull", equipment: "minimal", difficulty: 2, category: "strength" },
  { id: "one-arm-db-row", name: "One-arm DB row", muscleGroup: "back", prescription: "3×10–12/side", perSide: true, unilateral: true, pattern: "pull", equipment: "minimal", difficulty: 1, category: "strength" },
  { id: "db-shoulder-press", name: "Seated DB shoulder press", muscleGroup: "shoulders", prescription: "3×8–12", pattern: "push", equipment: "minimal", difficulty: 2, category: "strength", overheadPressing: true, cautions: ["overhead", "shoulder"] },
  { id: "pike-push-up", name: "Pike push-up", muscleGroup: "shoulders", prescription: "3×6–10", pattern: "push", equipment: "none", difficulty: 2, category: "strength", cautions: ["overhead", "shoulder", "wrist"] },
  { id: "step-ups", name: "Step-ups", muscleGroup: "quads", prescription: "3×10/side", perSide: true, unilateral: true, pattern: "squat", equipment: "none", difficulty: 1, category: "strength", cautions: ["knee"] },
  { id: "suitcase-carry", name: "Suitcase carry", muscleGroup: "fullBody", prescription: "3×30s/side", perSide: true, unilateral: true, pattern: "carry", equipment: "minimal", difficulty: 1, category: "strength" },
  { id: "dead-bug-main", name: "Dead bug", muscleGroup: "core", prescription: "3×10/side", perSide: true, unilateral: true, pattern: "core", equipment: "none", difficulty: 1, category: "prehab" },
  { id: "brisk-walk", name: "Brisk walk", muscleGroup: "fullBody", prescription: "20–30 min", pattern: "cardio", equipment: "none", difficulty: 1, category: "cardio" },
  { id: "barbell-back-squat", name: "Barbell back squat", muscleGroup: "quads", prescription: "4×5–8", pattern: "squat", equipment: "fullGym", difficulty: 3, category: "strength", cautions: ["knee", "spinal-load"] },
  { id: "barbell-bench", name: "Barbell bench press", muscleGroup: "chest", prescription: "4×5–8", pattern: "push", equipment: "fullGym", difficulty: 3, category: "strength", cautions: ["shoulder"] },
  { id: "barbell-row", name: "Barbell row", muscleGroup: "back", prescription: "4×6–10", pattern: "pull", equipment: "fullGym", difficulty: 3, category: "strength", cautions: ["spinal-load"] },
];

/**
 * Minimum Viable Workout (E8-T) — pairs with Hard Day mode and low readiness:
 * ~10 minutes, zero equipment, counts fully as showing up. Never punitive.
 */
export const MVW_SESSION: { label: string; exercises: ExerciseDef[] } = {
  label: "Minimum Viable Workout",
  exercises: [
    { id: "brisk-walk", name: "Brisk walk", muscleGroup: "fullBody", prescription: "5 min", pattern: "cardio", equipment: "none", difficulty: 1, category: "cardio" },
    { id: "dead-bug-main", name: "Dead bug", muscleGroup: "core", prescription: "2×10/side", perSide: true, pattern: "core", equipment: "none", difficulty: 1, category: "prehab" },
    { id: "serratus-wall-slides-drill", name: "Serratus wall slides", muscleGroup: "shoulders", prescription: "2×12", pattern: "mobility", equipment: "none", difficulty: 1, category: "prehab" },
  ],
};

/** Every known exercise, for name lookups, the swap sheet, and the builder. */
export function allExercises(): ExerciseDef[] {
  const seen = new Map<string, ExerciseDef>();
  for (const day of WORKOUT_PLAN) for (const ex of day.exercises) seen.set(ex.id, ex);
  for (const ex of SWAP_POOL) if (!seen.has(ex.id)) seen.set(ex.id, ex);
  for (const ex of PAIN_RELIEF_DRILLS) if (!seen.has(ex.id)) seen.set(ex.id, ex);
  for (const ex of EXTRA_LIBRARY) if (!seen.has(ex.id)) seen.set(ex.id, ex);
  return [...seen.values()];
}
