import type { ForgeScoreWeights, WorkoutStatus } from "@/lib/types";
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

/**
 * Default component weights (sum = 100). This is the exact v1 scoring spec —
 * passing no `weights` to `calculateForgeScore` reproduces it byte-for-byte,
 * so the original test suite never regresses. v2 lets the user adjust these
 * and renormalizes when a domain is turned off.
 */
export const DEFAULT_WEIGHTS: ForgeScoreWeights = {
  calories: 15,
  protein: 15,
  water: 10,
  workout: 15,
  mobility: 10,
  sleep: 10,
  spending: 10,
  mind: 10,
  skill: 5,
};

export type ScoreComponentKey = keyof ForgeScoreWeights;

/**
 * Scale a weight set so the *enabled* components sum to 100, preserving their
 * relative proportions. Disabling a domain (onboarding) hands its weight to
 * the rest rather than shrinking the achievable maximum. Disabled keys come
 * back as 0; if everything is disabled the input is returned unchanged.
 */
export function renormalizeWeights(
  weights: ForgeScoreWeights,
  disabled: Iterable<ScoreComponentKey> = []
): ForgeScoreWeights {
  const off = new Set(disabled);
  const keys = Object.keys(weights) as ScoreComponentKey[];
  const enabledTotal = keys.reduce((sum, k) => (off.has(k) ? sum : sum + weights[k]), 0);
  if (enabledTotal <= 0) return { ...weights };
  const factor = 100 / enabledTotal;
  const out = {} as ForgeScoreWeights;
  for (const k of keys) out[k] = off.has(k) ? 0 : weights[k] * factor;
  return out;
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
 * Whether today's score is still building or is a finished-day verdict.
 *
 * A 0/100 at 8 AM isn't a rough day — it's an unstarted one. Until the
 * user's evening boundary the score is presented as "score so far" and coach
 * feedback is framed as a mid-day check-in; verdict language is only ever
 * appropriate for a completed day (adherence-neutral rule at the system
 * level). Pure: callers pass the current hour; engines never read the clock.
 */
export type ScoreState = "inProgress" | "final";

export const DEFAULT_DAY_BOUNDARY_HOUR = 20;

export function resolveScoreState(
  hourOfDay: number,
  boundaryHour: number = DEFAULT_DAY_BOUNDARY_HOUR
): ScoreState {
  const boundary = clamp(Math.round(boundaryHour), 0, 23);
  return hourOfDay >= boundary ? "final" : "inProgress";
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
  targets: ForgeScoreTargets,
  weights: ForgeScoreWeights = DEFAULT_WEIGHTS
): ForgeScoreResult {
  // Each component earns a fraction [0,1] of adherence, scaled by its weight —
  // so the default weights reproduce the exact v1 point values, and a custom
  // set (or a renormalized one after disabling a domain) just re-scales them.
  const caloriePts = Math.round(
    calorieProteinCredit(inputs.calories, targets.calorieTarget, weights.calories)
  );
  const proteinPts = Math.round(
    calorieProteinCredit(inputs.protein, targets.proteinTarget, weights.protein, true)
  );
  const waterPts =
    targets.waterTarget > 0 && inputs.waterMl >= targets.waterTarget ? Math.round(weights.water) : 0;
  const workoutPts =
    inputs.workoutStatus === "complete" || inputs.workoutStatus === "rest"
      ? Math.round(weights.workout)
      : 0;
  const mobilityPts = inputs.mobilityDone ? Math.round(weights.mobility) : 0;
  const sleepPts =
    inputs.sleepHours >= 7
      ? Math.round(weights.sleep)
      : inputs.sleepHours >= 6
        ? Math.round(weights.sleep / 2)
        : 0;
  const spendingPts = inputs.spendingChecked ? Math.round(weights.spending) : 0;
  const mindPts = inputs.journalDone ? Math.round(weights.mind) : 0;
  const skillPts = inputs.skillMinutes >= 10 ? Math.round(weights.skill) : 0;

  const components: ScoreComponent[] = [
    { key: "calories", label: "Calories on target", points: caloriePts, max: Math.round(weights.calories) },
    { key: "protein", label: "Protein on target", points: proteinPts, max: Math.round(weights.protein) },
    { key: "water", label: "Water target", points: waterPts, max: Math.round(weights.water) },
    { key: "workout", label: "Workout / recovery", points: workoutPts, max: Math.round(weights.workout) },
    { key: "mobility", label: "Mobility / prehab", points: mobilityPts, max: Math.round(weights.mobility) },
    { key: "sleep", label: "Sleep", points: sleepPts, max: Math.round(weights.sleep) },
    { key: "spending", label: "Spending check", points: spendingPts, max: Math.round(weights.spending) },
    { key: "mind", label: "Mind reset / journal", points: mindPts, max: Math.round(weights.mind) },
    { key: "skill", label: "Skill progress", points: skillPts, max: Math.round(weights.skill) },
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
