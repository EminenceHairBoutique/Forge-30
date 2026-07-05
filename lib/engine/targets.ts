import type { ActivityLevel, GoalId, Sex } from "@/lib/types";
import {
  DEFAULT_CALORIE_TARGET,
  DEFAULT_PROTEIN_TARGET,
} from "@/lib/data/defaults";

/**
 * Onboarding target estimator (E5) — a starting point from the user's own
 * stats, replacing the v1 one-size-fits-nobody hardcoded targets. This static
 * formula is only ever the opening estimate: once the Adaptive Expenditure
 * Engine (E4) calibrates, the weekly check-in recalibrates from real data.
 * Users can override everything; a suggestion, never a prescription.
 */

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

/** kcal adjustment per day by goal: modest surplus/deficit, nothing extreme. */
function goalAdjustment(goal: GoalId): number {
  switch (goal) {
    case "gainMuscle":
      return 250;
    case "loseFat":
      return -400;
    default:
      return 0;
  }
}

/** g protein per lb body weight by goal; higher in a deficit. */
function proteinPerLb(goal: GoalId): number {
  switch (goal) {
    case "gainMuscle":
    case "recomposition":
      return 0.9;
    case "loseFat":
      return 1.1;
    default:
      return 0.8;
  }
}

export interface TargetEstimate {
  calorieTarget: number;
  proteinTarget: number;
  /** How the numbers were reached, for the onboarding copy. */
  basis: "mifflin" | "bodyweight" | "default";
}

export function estimateTargets(args: {
  weightLb: number | null;
  heightIn: number | null;
  age: number | null;
  sex: Sex;
  activityLevel: ActivityLevel;
  primaryGoal: GoalId;
}): TargetEstimate {
  const { weightLb, heightIn, age, sex, activityLevel, primaryGoal } = args;
  const factor = ACTIVITY_FACTOR[activityLevel];
  const adjust = goalAdjustment(primaryGoal);

  const roundKcal = (n: number) => Math.round(n / 50) * 50;
  const roundProtein = (n: number) => Math.round(n / 5) * 5;

  if (weightLb && weightLb > 0 && heightIn && heightIn > 0 && age && age > 0) {
    // Mifflin-St Jeor. "other"/"unspecified" take the midpoint of the sex
    // constants — a neutral estimate beats forcing a binary choice.
    const kg = weightLb * 0.4536;
    const cm = heightIn * 2.54;
    const sexConstant = sex === "male" ? 5 : sex === "female" ? -161 : -78;
    const bmr = 10 * kg + 6.25 * cm - 5 * age + sexConstant;
    return {
      calorieTarget: roundKcal(bmr * factor + adjust),
      proteinTarget: roundProtein(weightLb * proteinPerLb(primaryGoal)),
      basis: "mifflin",
    };
  }

  if (weightLb && weightLb > 0) {
    // Body-weight shortcut: ~13–17 kcal/lb by activity.
    const perLb = 11 + factor * 3;
    return {
      calorieTarget: roundKcal(weightLb * perLb + adjust),
      proteinTarget: roundProtein(weightLb * proteinPerLb(primaryGoal)),
      basis: "bodyweight",
    };
  }

  return {
    calorieTarget: roundKcal(DEFAULT_CALORIE_TARGET + adjust),
    proteinTarget: DEFAULT_PROTEIN_TARGET,
    basis: "default",
  };
}
