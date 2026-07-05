import type { ExpenditureEstimate } from "./expenditure";
import { runWeeklyCheckIn, type WeeklyCheckIn } from "./expenditure";

/**
 * Adaptive calorie targets (v3 Phase 4, pure). The MacroFactor-style
 * principle at MVP depth, built ON the E4 expenditure engine: weekly,
 * compare 7-day average intake against the 7-day weight trend and nudge
 * `calorieTarget` toward the stated goal in ≤150 kcal steps.
 *
 * Hard rules: a SUGGESTION the user accepts in the Sunday review — never a
 * silent change, never surfaced anywhere else. Calibrating or already-on-
 * track weeks return null (nothing to decide). This supersedes the old
 * "+250 kcal" rule-of-thumb banner.
 */

export const MAX_TARGET_STEP_KCAL = 150;

export interface TargetSuggestion {
  suggested: number;
  delta: number;
  why: string;
  proteinAnchorG: number;
}

export function sundayTargetSuggestion(args: {
  estimate: ExpenditureEstimate;
  currentCalorieTarget: number;
  goalRateLbPerWeek: number;
}): TargetSuggestion | null {
  const checkIn: WeeklyCheckIn = runWeeklyCheckIn({
    ...args,
    maxStepKcal: MAX_TARGET_STEP_KCAL,
  });
  if (
    checkIn.status !== "estimated" ||
    checkIn.suggestedCalorieTarget === null ||
    checkIn.deltaKcal === 0
  ) {
    return null;
  }
  return {
    suggested: checkIn.suggestedCalorieTarget,
    delta: checkIn.deltaKcal,
    why: checkIn.why,
    proteinAnchorG: checkIn.proteinAnchorG ?? 0,
  };
}
