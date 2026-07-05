import type {
  CautionTag,
  EquipmentAccess,
  ExerciseDef,
  GoalId,
  InjuryProfile,
  MovementPattern,
  TrainingExperience,
  WorkoutDayPlan,
} from "@/lib/types";
import type { CustomWorkoutPlan, ISODate } from "@/lib/types";
import { allExercises, getWorkoutPlanForDate } from "@/lib/data/workoutPlan";
import { mondayWeekday } from "@/lib/utils";

/** The day's workout: the user's custom plan when one exists, else the seeded rotation. */
export function workoutForDate(custom: CustomWorkoutPlan | null, date: ISODate): WorkoutDayPlan {
  if (!custom) return getWorkoutPlanForDate(date);
  return (
    custom.days[mondayWeekday(date)] ?? { weekday: 6, label: "Rest", isRest: true, exercises: [] }
  );
}

/**
 * Workout builder (E8-T) — deterministic weekly programming from the tagged
 * exercise library. Universal by construction: filters by the user's
 * equipment tier and experience, excludes anything carrying a caution tag
 * their injuries map to, honors dislikes, prefers likes, and sizes sessions
 * to the time they actually have. Pure — same inputs, same week.
 */

export interface BuilderInputs {
  goal: GoalId;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  sessionMinutes: 20 | 30 | 45 | 60 | 75 | 90;
  equipment: EquipmentAccess;
  experience: TrainingExperience;
  injuries: InjuryProfile[];
  dislikedIds: string[];
  likedIds: string[];
}

export interface BuiltWeek {
  /** 7 entries, index 0 = Monday. */
  days: WorkoutDayPlan[];
  /** Plain-language notes: RIR guidance, what was excluded and why. */
  notes: string[];
}

const EQUIPMENT_TIER: Record<EquipmentAccess, number> = {
  none: 0,
  minimal: 1,
  homeGym: 2,
  fullGym: 3,
};

/** Injury free-text → caution tags. Keyword-based and deliberately broad. */
const CAUTION_KEYWORDS: [RegExp, CautionTag[]][] = [
  [/shoulder|rotator|overhead|press/i, ["shoulder", "overhead"]],
  [/back|spine|spinal|thoracic|lumbar|rib|scapul|disc/i, ["spinal-load", "overhead"]],
  [/knee|patell|acl|meniscus/i, ["knee", "high-impact"]],
  [/hip|glute|groin/i, ["hip"]],
  [/elbow|tennis|golfer/i, ["elbow"]],
  [/wrist|hand|carpal/i, ["wrist"]],
  [/ankle|foot|achilles|shin/i, ["high-impact"]],
  [/run|jump|impact|sprint/i, ["high-impact"]],
];

/** Caution tags an injury set maps to — the builder and mod engine share this. */
export function cautionTagsForInjuries(injuries: InjuryProfile[]): CautionTag[] {
  const tags = new Set<CautionTag>();
  for (const inj of injuries) {
    const text = [
      inj.bodyArea,
      inj.symptoms,
      inj.medicalRestrictions,
      ...inj.aggravatingMovements,
    ].join(" ");
    for (const [pattern, mapped] of CAUTION_KEYWORDS) {
      if (pattern.test(text)) for (const t of mapped) tags.add(t);
    }
  }
  return [...tags];
}

/** Day templates: label + ordered pattern slots (extended cyclically for longer sessions). */
const DAY_TEMPLATES: Record<string, { label: string; slots: MovementPattern[] }> = {
  full: { label: "Full Body", slots: ["squat", "push", "pull", "hinge", "core", "carry", "push"] },
  upper: { label: "Upper Body", slots: ["push", "pull", "push", "pull", "core", "carry", "pull"] },
  lower: { label: "Lower Body", slots: ["squat", "hinge", "squat", "core", "carry", "hinge", "core"] },
  push: { label: "Push", slots: ["push", "push", "push", "core", "push", "carry", "core"] },
  pull: { label: "Pull", slots: ["pull", "pull", "pull", "core", "pull", "carry", "core"] },
  legs: { label: "Legs", slots: ["squat", "hinge", "squat", "hinge", "core", "carry", "core"] },
};

/** Training-day weekday indexes (0 = Monday) per days/week — rest spread out. */
const WEEK_LAYOUT: Record<number, { weekday: number; template: keyof typeof DAY_TEMPLATES }[]> = {
  2: [
    { weekday: 0, template: "full" },
    { weekday: 3, template: "full" },
  ],
  3: [
    { weekday: 0, template: "full" },
    { weekday: 2, template: "full" },
    { weekday: 4, template: "full" },
  ],
  4: [
    { weekday: 0, template: "upper" },
    { weekday: 1, template: "lower" },
    { weekday: 3, template: "upper" },
    { weekday: 4, template: "lower" },
  ],
  5: [
    { weekday: 0, template: "upper" },
    { weekday: 1, template: "lower" },
    { weekday: 2, template: "push" },
    { weekday: 4, template: "pull" },
    { weekday: 5, template: "legs" },
  ],
  6: [
    { weekday: 0, template: "push" },
    { weekday: 1, template: "pull" },
    { weekday: 2, template: "legs" },
    { weekday: 3, template: "push" },
    { weekday: 4, template: "pull" },
    { weekday: 5, template: "legs" },
  ],
};

const SLOTS_BY_MINUTES: Record<number, number> = { 20: 3, 30: 4, 45: 5, 60: 6, 75: 7, 90: 7 };

/** RIR guidance alongside RPE, by experience (spec: RIR alongside RPE). */
export function experienceGuidance(experience: TrainingExperience): string {
  switch (experience) {
    case "beginner":
      return "Work at RPE 6–7 — leave 3–4 reps in reserve (RIR 3–4). Technique first; the load will come.";
    case "intermediate":
      return "Work most sets at RPE 7–8 (RIR 2–3), pushing the last set of a movement to RPE 8–9 (RIR 1–2).";
    default:
      return "Work at RPE 8–9 (RIR 1–2) on top sets; back-off volume at RPE 7 (RIR 3).";
  }
}

export function buildWorkoutWeek(inputs: BuilderInputs): BuiltWeek {
  const { daysPerWeek, sessionMinutes, equipment, experience, injuries, dislikedIds, likedIds } =
    inputs;
  const cautions = new Set(cautionTagsForInjuries(injuries));
  const disliked = new Set(dislikedIds);
  const liked = new Set(likedIds);
  const tier = EQUIPMENT_TIER[equipment];

  const excludedByInjury: string[] = [];
  const pool = allExercises().filter((ex) => {
    if (ex.category === "mobility") return false; // strength slots only
    if (disliked.has(ex.id)) return false;
    if (EQUIPMENT_TIER[ex.equipment ?? "fullGym"] > tier) return false;
    if (experience === "beginner" && (ex.difficulty ?? 1) >= 3) return false;
    if ((ex.cautions ?? []).some((c) => cautions.has(c))) {
      excludedByInjury.push(ex.name);
      return false;
    }
    return true;
  });

  // Liked first, then stable library order — deterministic.
  const byPattern = new Map<MovementPattern, ExerciseDef[]>();
  for (const ex of pool) {
    if (!ex.pattern) continue;
    const list = byPattern.get(ex.pattern) ?? [];
    list.push(ex);
    byPattern.set(ex.pattern, list);
  }
  for (const list of byPattern.values()) {
    list.sort((a, b) => Number(liked.has(b.id)) - Number(liked.has(a.id)));
  }

  const slotCount = SLOTS_BY_MINUTES[sessionMinutes] ?? 5;
  const layout = WEEK_LAYOUT[daysPerWeek] ?? WEEK_LAYOUT[3]!;
  // Rotate each pattern's list across the week so repeat days differ.
  const cursor = new Map<MovementPattern, number>();

  const days: WorkoutDayPlan[] = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    label: "Rest",
    isRest: true,
    exercises: [] as ExerciseDef[],
  }));

  for (const dayPlan of layout) {
    const template = DAY_TEMPLATES[dayPlan.template]!;
    const usedToday = new Set<string>();
    const exercises: ExerciseDef[] = [];
    for (const pattern of template.slots.slice(0, slotCount)) {
      const list = byPattern.get(pattern) ?? [];
      if (list.length === 0) continue;
      const start = cursor.get(pattern) ?? 0;
      let picked: ExerciseDef | null = null;
      for (let i = 0; i < list.length; i++) {
        const candidate = list[(start + i) % list.length]!;
        if (!usedToday.has(candidate.id)) {
          picked = candidate;
          cursor.set(pattern, (start + i + 1) % list.length);
          break;
        }
      }
      if (picked) {
        usedToday.add(picked.id);
        exercises.push(picked);
      }
    }
    days[dayPlan.weekday] = {
      weekday: dayPlan.weekday,
      label: template.label,
      isRest: false,
      exercises,
    };
  }

  const notes: string[] = [experienceGuidance(experience)];
  if (excludedByInjury.length > 0) {
    const unique = [...new Set(excludedByInjury)];
    notes.push(
      `Left out because of your injury notes (${[...cautions].join(", ")}): ${unique
        .slice(0, 6)
        .join(", ")}${unique.length > 6 ? "…" : ""}. Safer patterns fill those slots instead.`
    );
  }
  if (inputs.goal === "cardio" || inputs.goal === "healthMarkers" || inputs.goal === "bloodPressure") {
    notes.push("With your goal, add easy zone-2 cardio (20–30 min) on 2–3 of the rest days.");
  }
  return { days, notes };
}
