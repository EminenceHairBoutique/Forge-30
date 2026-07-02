import type { WorkoutStatus } from "@/lib/types";
import { clamp } from "@/lib/utils";

/**
 * Forge Score engine — the exact scoring spec.
 *
 * Base components (max 100):
 *   Calories within target ... 15   (partial credit, see calorieProteinCredit)
 *   Protein within target .... 15   (partial credit)
 *   Water target ............. 10
 *   Workout/recovery done .... 15
 *   Mobility/prehab .......... 10
 *   Sleep .................... 10
 *   Spending check done ...... 10
 *   Mind reset / journal ..... 10
 *   Skill progress ............ 5
 *
 * Penalties applied after the base score (floor 0):
 *   Severe pain (7/8/9+) ............ −5 / −10 / −15
 *   Very high stress (8/9/10) ....... −5 / −8 / −10
 *   Unnecessary spend over limit .... −5 to −15 (scales with overage)
 *   Protein missed by >40g .......... −5
 *   Calories missed by >500 ......... −5
 */

export interface ForgeScoreInputs {
  calories: number;
  protein: number;
  waterMl: number;
  workoutStatus: WorkoutStatus;
  mobilityDone: boolean;
  sleepHours: number;
  spendingChecked: boolean;
  journalDone: boolean;
  skillMinutes: number;
  /** 0–10 worst pain logged today. */
  painScore: number;
  /** 1–10 stress from the mind check-in; 0 = not logged. */
  stress: number;
  /** Dollars of unnecessary spending logged today. */
  unnecessarySpend: number;
}

export interface ForgeScoreTargets {
  calorieTarget: number;
  proteinTarget: number;
  waterTarget: number;
  dailySpendingLimit: number;
}

export interface ScoreComponent {
  key:
    | "calories"
    | "protein"
    | "water"
    | "workout"
    | "mobility"
    | "sleep"
    | "spending"
    | "mind"
    | "skill";
  label: string;
  points: number;
  max: number;
}

export interface ScorePenalty {
  key: "pain" | "stress" | "overspend" | "proteinMiss" | "calorieMiss";
  label: string;
  points: number; // negative
}

export interface ForgeScoreResult {
  score: number;
  base: number;
  components: ScoreComponent[];
  penalties: ScorePenalty[];
}

/**
 * Partial credit for calorie/protein components: within ±10% of target = full
 * points, then linear falloff to 0 at ±30% deviation.
 *
 * `oneSided: true` (protein) only counts shortfalls — protein is a floor, so
 * landing over target still earns full points.
 */
export function calorieProteinCredit(
  actual: number,
  target: number,
  maxPoints: number,
  oneSided = false
): number {
  if (target <= 0) return 0;
  let deviation = (actual - target) / target;
  if (oneSided) deviation = Math.min(0, deviation);
  const abs = Math.abs(deviation);
  if (abs <= 0.1) return maxPoints;
  if (abs >= 0.3) return 0;
  return maxPoints * (1 - (abs - 0.1) / 0.2);
}

function painPenalty(painScore: number): number {
  if (painScore >= 9) return -15;
  if (painScore >= 8) return -10;
  if (painScore >= 7) return -5;
  return 0;
}

function stressPenalty(stress: number): number {
  if (stress >= 10) return -10;
  if (stress >= 9) return -8;
  if (stress >= 8) return -5;
  return 0;
}

/** Scales −5 → −15 with how far unnecessary spending exceeds the daily limit. */
function overspendPenalty(unnecessarySpend: number, dailyLimit: number): number {
  if (dailyLimit <= 0 || unnecessarySpend <= dailyLimit) return 0;
  const ratio = unnecessarySpend / dailyLimit;
  if (ratio >= 2) return -15;
  if (ratio >= 1.5) return -10;
  return -5;
}

export function calculateForgeScore(
  inputs: ForgeScoreInputs,
  targets: ForgeScoreTargets
): ForgeScoreResult {
  const caloriePts = Math.round(calorieProteinCredit(inputs.calories, targets.calorieTarget, 15));
  const proteinPts = Math.round(
    calorieProteinCredit(inputs.protein, targets.proteinTarget, 15, true)
  );
  const waterPts = targets.waterTarget > 0 && inputs.waterMl >= targets.waterTarget ? 10 : 0;
  const workoutPts =
    inputs.workoutStatus === "complete" || inputs.workoutStatus === "rest" ? 15 : 0;
  const mobilityPts = inputs.mobilityDone ? 10 : 0;
  const sleepPts = inputs.sleepHours >= 7 ? 10 : inputs.sleepHours >= 6 ? 5 : 0;
  const spendingPts = inputs.spendingChecked ? 10 : 0;
  const mindPts = inputs.journalDone ? 10 : 0;
  const skillPts = inputs.skillMinutes >= 10 ? 5 : 0;

  const components: ScoreComponent[] = [
    { key: "calories", label: "Calories on target", points: caloriePts, max: 15 },
    { key: "protein", label: "Protein on target", points: proteinPts, max: 15 },
    { key: "water", label: "Water target", points: waterPts, max: 10 },
    { key: "workout", label: "Workout / recovery", points: workoutPts, max: 15 },
    { key: "mobility", label: "Mobility / prehab", points: mobilityPts, max: 10 },
    { key: "sleep", label: "Sleep", points: sleepPts, max: 10 },
    { key: "spending", label: "Spending check", points: spendingPts, max: 10 },
    { key: "mind", label: "Mind reset / journal", points: mindPts, max: 10 },
    { key: "skill", label: "Skill progress", points: skillPts, max: 5 },
  ];

  const penalties: ScorePenalty[] = [];
  const pain = painPenalty(inputs.painScore);
  if (pain) penalties.push({ key: "pain", label: `Severe pain (${inputs.painScore}/10)`, points: pain });

  const stress = stressPenalty(inputs.stress);
  if (stress) penalties.push({ key: "stress", label: `Very high stress (${inputs.stress}/10)`, points: stress });

  const overspend = overspendPenalty(inputs.unnecessarySpend, targets.dailySpendingLimit);
  if (overspend)
    penalties.push({
      key: "overspend",
      label: `Unnecessary spending over daily limit`,
      points: overspend,
    });

  if (targets.proteinTarget - inputs.protein > 40)
    penalties.push({ key: "proteinMiss", label: "Protein missed by >40g", points: -5 });

  if (targets.calorieTarget - inputs.calories > 500)
    penalties.push({ key: "calorieMiss", label: "Calories missed by >500", points: -5 });

  const base = components.reduce((sum, c) => sum + c.points, 0);
  const penaltyTotal = penalties.reduce((sum, p) => sum + p.points, 0);
  const score = clamp(Math.round(base + penaltyTotal), 0, 100);

  return { score, base, components, penalties };
}
