import type { ExerciseDef, ISODate, WorkoutDayPlan } from "@/lib/types";
import { mondayWeekday } from "@/lib/utils";

/**
 * Seeded weekly split (Section 5.3). Pain-safe swaps reference exercise ids;
 * the pain rules engine (lib/engine/trainingRules.ts) promotes
 * chest-supported rows and neutral-grip pulldowns when session pain is high.
 */

// Pain-safe swap pool available from any exercise's swap sheet.
export const SWAP_POOL: ExerciseDef[] = [
  { id: "chest-supported-row", name: "Chest-supported row", muscleGroup: "back", prescription: "4×8–12" },
  { id: "neutral-grip-pulldown", name: "Neutral-grip pulldown", muscleGroup: "back", prescription: "4×10–12" },
  { id: "machine-chest-press", name: "Machine chest press", muscleGroup: "chest", prescription: "3×10–15" },
  { id: "push-ups", name: "Push-ups", muscleGroup: "chest", prescription: "3×10–15" },
  { id: "rope-triceps-pushdown", name: "Rope triceps pushdown", muscleGroup: "triceps", prescription: "3×12–15" },
  { id: "floor-press", name: "DB floor press", muscleGroup: "chest", prescription: "3×8–12" },
  { id: "goblet-squat", name: "Goblet squat", muscleGroup: "quads", prescription: "4×8–10" },
  { id: "leg-press", name: "Leg press", muscleGroup: "quads", prescription: "4×10–12" },
  { id: "hamstring-curl", name: "Hamstring curl", muscleGroup: "hamstrings", prescription: "3×12" },
  { id: "cable-lateral-raise", name: "Cable lateral raise (light)", muscleGroup: "shoulders", prescription: "3×15–20" },
];

export const WORKOUT_PLAN: WorkoutDayPlan[] = [
  {
    weekday: 0,
    label: "Upper Push + Shoulders",
    isRest: false,
    exercises: [
      { id: "incline-db-press", name: "Incline DB press", muscleGroup: "chest", prescription: "4×8–12", swaps: ["machine-chest-press", "push-ups", "floor-press"] },
      { id: "machine-chest-press", name: "Machine chest press or push-ups", muscleGroup: "chest", prescription: "3×10–15", swaps: ["push-ups", "floor-press"] },
      { id: "cable-fly", name: "Cable fly", muscleGroup: "chest", prescription: "3×12–15", swaps: ["push-ups"] },
      { id: "lateral-raise", name: "Lateral raises", muscleGroup: "shoulders", prescription: "4×15–25", swaps: ["cable-lateral-raise"] },
      { id: "rope-triceps-pushdown", name: "Rope triceps pushdown", muscleGroup: "triceps", prescription: "3×12–15" },
      { id: "serratus-cable-punch", name: "Serratus cable punch", muscleGroup: "shoulders", prescription: "3×12/side", perSide: true },
    ],
  },
  {
    weekday: 1,
    label: "Lower Strength",
    isRest: false,
    exercises: [
      { id: "trap-bar-dl", name: "Trap bar DL or RDL", muscleGroup: "hamstrings", prescription: "4×6–8", swaps: ["leg-press", "hamstring-curl"] },
      { id: "leg-press", name: "Leg press", muscleGroup: "quads", prescription: "4×10–12", swaps: ["goblet-squat"] },
      { id: "bulgarian-split-squat", name: "Bulgarian split squat", muscleGroup: "quads", prescription: "3×8/side", perSide: true, swaps: ["goblet-squat", "leg-press"] },
      { id: "hamstring-curl", name: "Hamstring curl", muscleGroup: "hamstrings", prescription: "3×12" },
      { id: "calf-raise", name: "Calf raise", muscleGroup: "calves", prescription: "4×12–20" },
      { id: "plank", name: "Plank", muscleGroup: "core", prescription: "3×45s" },
    ],
  },
  {
    weekday: 2,
    label: "Pull + Scapular Control",
    isRest: false,
    exercises: [
      { id: "chest-supported-row", name: "Chest-supported row", muscleGroup: "back", prescription: "4×8–12" },
      { id: "neutral-grip-pulldown", name: "Neutral-grip pulldown", muscleGroup: "back", prescription: "4×10–12" },
      { id: "single-arm-cable-row", name: "Single-arm cable row", muscleGroup: "back", prescription: "3×12/side", perSide: true, swaps: ["chest-supported-row"] },
      { id: "rear-delt-fly", name: "Rear delt fly", muscleGroup: "shoulders", prescription: "4×15–20" },
      { id: "incline-curls", name: "Incline curls", muscleGroup: "biceps", prescription: "3×10–12" },
      { id: "face-pulls", name: "Face pulls", muscleGroup: "shoulders", prescription: "3×15–20" },
    ],
  },
  {
    weekday: 3,
    label: "Mobility + Core + Zone 2",
    isRest: false,
    exercises: [
      { id: "zone2-cardio", name: "Zone 2 cardio", muscleGroup: "fullBody", prescription: "30–40 min" },
      { id: "mcgill-curl-up", name: "McGill curl-up", muscleGroup: "core", prescription: "3×8" },
      { id: "side-plank", name: "Side plank", muscleGroup: "core", prescription: "3×30s/side", perSide: true },
      { id: "bird-dog", name: "Bird dog", muscleGroup: "core", prescription: "3×8/side", perSide: true },
      { id: "thoracic-extension-foam", name: "Thoracic extension on foam roller", muscleGroup: "back", prescription: "2 min" },
      { id: "deep-breathing", name: "Deep breathing", muscleGroup: "core", prescription: "5 min" },
    ],
  },
  {
    weekday: 4,
    label: "Upper Hypertrophy",
    isRest: false,
    exercises: [
      { id: "db-bench", name: "DB bench", muscleGroup: "chest", prescription: "4×8–12", swaps: ["machine-chest-press", "floor-press", "push-ups"] },
      { id: "lat-pulldown", name: "Lat pulldown", muscleGroup: "back", prescription: "4×10–12", swaps: ["neutral-grip-pulldown"] },
      { id: "seated-cable-row", name: "Seated cable row", muscleGroup: "back", prescription: "3×12", swaps: ["chest-supported-row"] },
      { id: "lateral-raise-dropset", name: "Lateral raise mechanical dropset", muscleGroup: "shoulders", prescription: "×3", swaps: ["cable-lateral-raise"] },
      { id: "cable-curls", name: "Cable curls", muscleGroup: "biceps", prescription: "3×12–15" },
      { id: "overhead-rope-triceps", name: "Overhead rope triceps", muscleGroup: "triceps", prescription: "3×12–15", overheadPressing: true, swaps: ["rope-triceps-pushdown"] },
    ],
  },
  {
    weekday: 5,
    label: "Lower/Athletic + Arms",
    isRest: false,
    exercises: [
      { id: "front-goblet-squat", name: "Front or goblet squat", muscleGroup: "quads", prescription: "4×8–10", swaps: ["leg-press"] },
      { id: "walking-lunges", name: "Walking lunges", muscleGroup: "quads", prescription: "3×12/side", perSide: true, swaps: ["leg-press"] },
      { id: "hip-thrust", name: "Hip thrust", muscleGroup: "glutes", prescription: "4×10–12" },
      { id: "leg-extension", name: "Leg extension", muscleGroup: "quads", prescription: "3×15" },
      { id: "hammer-curls", name: "Hammer curls", muscleGroup: "biceps", prescription: "3×12" },
      { id: "dips-assisted", name: "Dips or assisted dips", muscleGroup: "triceps", prescription: "3×8–12", swaps: ["rope-triceps-pushdown", "push-ups"] },
      { id: "farmer-carries", name: "Farmer carries", muscleGroup: "fullBody", prescription: "×4" },
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

/** Every known exercise, for name lookups and the swap sheet. */
export function allExercises(): ExerciseDef[] {
  const seen = new Map<string, ExerciseDef>();
  for (const day of WORKOUT_PLAN) for (const ex of day.exercises) seen.set(ex.id, ex);
  for (const ex of SWAP_POOL) if (!seen.has(ex.id)) seen.set(ex.id, ex);
  for (const ex of PAIN_RELIEF_DRILLS) if (!seen.has(ex.id)) seen.set(ex.id, ex);
  return [...seen.values()];
}
