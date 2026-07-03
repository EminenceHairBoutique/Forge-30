import type { BodyMetric, DailyLog, ISODate } from "@/lib/types";
import { addDays, daysBetween, round1 } from "@/lib/utils";
import { calculateSmoothedWeightTrend } from "./trends";

/**
 * Adaptive Expenditure Engine — the flagship nutrition feature.
 *
 * Estimates real-world energy expenditure (TDEE) from what actually happened:
 * average logged intake vs. how the smoothed trend weight moved over a rolling
 * 14–21 day window (energy balance: ~3500 kcal per lb). While the data isn't
 * there yet — too few days, sparse logging, sparse weigh-ins — the engine says
 * so in plain language ("calibrating — N more days") instead of guessing, and
 * the app keeps using the static target as the working number.
 *
 * Everything is pure: callers pass logs, weigh-ins, and today's date. Copy
 * stays adherence-neutral — data-quality notes describe what would help,
 * never what the user "failed" to do.
 */

/** Energy density of body-weight change used by the balance math. */
export const KCAL_PER_LB = 3500;

export interface ExpenditureOptions {
  /** Rolling window the estimate reads (days, inclusive of today). */
  windowDays: number;
  /** Days of history required before the first estimate. */
  minDaysOfData: number;
  /** Fully-logged days required inside the window. */
  minCompleteLogDays: number;
  /** Weigh-ins required inside the window. */
  minWeighIns: number;
  /** First-to-last weigh-in span required inside the window (days). */
  minWeighInSpanDays: number;
  /**
   * Partial-day guard: a day logged below this many kcal is treated as an
   * incomplete log (a lone coffee entry, an abandoned day) and excluded from
   * the intake average rather than dragging it down.
   */
  minPlausibleCalories: number;
}

export const DEFAULT_EXPENDITURE_OPTIONS: ExpenditureOptions = {
  windowDays: 21,
  minDaysOfData: 14,
  minCompleteLogDays: 10,
  minWeighIns: 5,
  minWeighInSpanDays: 7,
  minPlausibleCalories: 800,
};

export type ExpenditureStatus = "calibrating" | "estimated";

export interface ExpenditureEstimate {
  status: ExpenditureStatus;
  /** Estimated daily expenditure (kcal); null while calibrating. */
  tdee: number | null;
  /** Current smoothed trend weight (lb); null with no weigh-ins. */
  trendWeightLb: number | null;
  /** Smoothed weight change per week (lb) across the window; null while calibrating. */
  weeklyTrendLb: number | null;
  /** Mean intake across complete logged days in the window; null with none. */
  avgIntake: number | null;
  /** Days of history still needed before the first estimate (0 once enough). */
  daysUntilCalibrated: number;
  completeLogDays: number;
  weighIns: number;
  /** Plain-language, neutral notes on what would firm up the estimate. */
  notes: string[];
}

export function estimateExpenditure(args: {
  logs: Pick<DailyLog, "date" | "calories">[];
  metrics: BodyMetric[];
  today: ISODate;
  options?: Partial<ExpenditureOptions>;
}): ExpenditureEstimate {
  const opts = { ...DEFAULT_EXPENDITURE_OPTIONS, ...args.options };
  const { logs, metrics, today } = args;
  const windowStart = addDays(today, -(opts.windowDays - 1));

  const inWindow = (date: ISODate) => date >= windowStart && date <= today;

  // Partial-day guard: only plausibly complete days feed the intake average.
  const completeLogs = logs.filter(
    (l) => inWindow(l.date) && l.calories >= opts.minPlausibleCalories
  );
  const completeLogDays = completeLogs.length;
  const avgIntake =
    completeLogDays > 0
      ? Math.round(completeLogs.reduce((sum, l) => sum + l.calories, 0) / completeLogDays)
      : null;

  // Smooth over the full weigh-in history for stability, read the window.
  const smoothedAll = calculateSmoothedWeightTrend(metrics);
  const smoothed = smoothedAll.filter((p) => inWindow(p.date));
  const weighIns = smoothed.length;
  const trendWeightLb = smoothedAll.length
    ? (smoothedAll.filter((p) => p.date <= today).at(-1)?.trendLb ?? null)
    : null;

  // How long has data existed at all? Drives "calibrating — N more days".
  const firstDataDate = [
    ...logs.filter((l) => l.calories >= opts.minPlausibleCalories).map((l) => l.date),
    ...smoothedAll.map((p) => p.date),
  ]
    .sort()
    .at(0);
  const daysOfData = firstDataDate ? Math.max(0, daysBetween(firstDataDate, today) + 1) : 0;
  const daysUntilCalibrated = Math.max(0, opts.minDaysOfData - daysOfData);

  const first = smoothed[0];
  const last = smoothed[smoothed.length - 1];
  const spanDays = first && last ? daysBetween(first.date, last.date) : 0;

  const notes: string[] = [];
  if (daysUntilCalibrated > 0) {
    notes.push(
      `Calibrating — ${daysUntilCalibrated} more day${daysUntilCalibrated === 1 ? "" : "s"} of data and the estimate goes live.`
    );
  }
  if (completeLogDays < opts.minCompleteLogDays) {
    notes.push(
      `Logging most days sharpens the estimate (${completeLogDays} of ${opts.minCompleteLogDays} full days in the last ${opts.windowDays}).`
    );
  }
  if (weighIns < opts.minWeighIns) {
    notes.push(
      `A few weigh-ins a week anchor the trend (${weighIns} of ${opts.minWeighIns} in the last ${opts.windowDays} days).`
    );
  } else if (spanDays < opts.minWeighInSpanDays) {
    notes.push("Weigh-ins are clustered — spreading them across the week anchors the trend.");
  }

  let tdee: number | null = null;
  let weeklyTrendLb: number | null = null;
  if (notes.length === 0 && avgIntake !== null && first && last && spanDays > 0) {
    weeklyTrendLb = round1(((last.trendLb - first.trendLb) / spanDays) * 7);
    const candidate = Math.round(avgIntake - (weeklyTrendLb * KCAL_PER_LB) / 7);
    // Final sanity guard: an estimate outside human range means the inputs
    // don't line up yet (e.g. heavy under-logging) — stay calibrating.
    if (candidate >= 1200 && candidate <= 6000) {
      tdee = candidate;
    } else {
      weeklyTrendLb = null;
      notes.push(
        "The numbers don't line up yet — most often a stretch of partial logging. A clean week of full days resets this."
      );
    }
  }

  return {
    status: tdee !== null ? "estimated" : "calibrating",
    tdee,
    trendWeightLb,
    weeklyTrendLb,
    avgIntake,
    daysUntilCalibrated,
    completeLogDays,
    weighIns,
    notes,
  };
}

// --- Weekly check-in ---------------------------------------------------------

export interface WeeklyCheckIn {
  status: ExpenditureStatus;
  /** One-line verdictless summary ("Nudge calories up to 3,100"). */
  headline: string;
  /** Why the target moved (or didn't), in the app's suggestion voice. */
  why: string;
  /** The recommended daily calorie target; null while calibrating. */
  suggestedCalorieTarget: number | null;
  /** suggested − current (0 while calibrating or when staying the course). */
  deltaKcal: number;
  /** Protein floor anchored to trend weight; null with no weigh-ins. */
  proteinAnchorG: number | null;
}

/** Round a calorie target to something a human can cook toward. */
function roundKcal(n: number): number {
  return Math.round(n / 25) * 25;
}

/**
 * Protein floor anchored to trend body weight: ~0.9 g/lb on a gain or
 * maintenance goal, ~1.1 g/lb in a deficit (protein matters more when
 * calories are short). Rounded to 5g.
 */
export function proteinAnchorG(
  trendWeightLb: number | null,
  goalRateLbPerWeek: number
): number | null {
  if (trendWeightLb === null || trendWeightLb <= 0) return null;
  const perLb = goalRateLbPerWeek < 0 ? 1.1 : 0.9;
  return Math.round((trendWeightLb * perLb) / 5) * 5;
}

/**
 * Best-effort goal rate (lb/week) from the profile's free-text weight goal.
 * Conservative on purpose: ±0.5 lb/week; unrecognized text = maintain.
 */
export function goalRateFromWeightGoal(weightGoal: string): number {
  const g = weightGoal.toLowerCase();
  if (/gain|bulk|build|mass/.test(g)) return 0.5;
  if (/lose|cut|lean|drop|deficit/.test(g)) return -0.5;
  return 0;
}

/**
 * The weekly recalibration: turns the expenditure estimate + the user's goal
 * rate into a plain-language target move. Adjustments are step-clamped
 * (default ±200 kcal per check-in) so one noisy week never yanks the target,
 * and moves under 75 kcal are "stay the course" — not worth churning the plan.
 */
export function runWeeklyCheckIn(args: {
  estimate: ExpenditureEstimate;
  currentCalorieTarget: number;
  goalRateLbPerWeek: number;
  maxStepKcal?: number;
}): WeeklyCheckIn {
  const { estimate, currentCalorieTarget, goalRateLbPerWeek } = args;
  const maxStep = args.maxStepKcal ?? 200;
  const anchor = proteinAnchorG(estimate.trendWeightLb, goalRateLbPerWeek);

  if (estimate.status === "calibrating" || estimate.tdee === null) {
    return {
      status: "calibrating",
      headline:
        estimate.daysUntilCalibrated > 0
          ? `Calibrating — ${estimate.daysUntilCalibrated} more day${estimate.daysUntilCalibrated === 1 ? "" : "s"}`
          : "Calibrating — a little more data",
      why:
        estimate.notes[0] ??
        "Keep logging meals and weighing in; the estimate goes live once the window fills.",
      suggestedCalorieTarget: null,
      deltaKcal: 0,
      proteinAnchorG: anchor,
    };
  }

  const ideal = estimate.tdee + (goalRateLbPerWeek * KCAL_PER_LB) / 7;
  const rawDelta = ideal - currentCalorieTarget;
  const trendTxt =
    estimate.weeklyTrendLb === null
      ? "flat"
      : `${estimate.weeklyTrendLb > 0 ? "+" : ""}${estimate.weeklyTrendLb} lb/week`;
  const why = `Trend weight moved ${trendTxt} on ~${estimate.avgIntake?.toLocaleString()} kcal/day, putting your expenditure near ${estimate.tdee.toLocaleString()} kcal.`;

  if (Math.abs(rawDelta) < 75) {
    return {
      status: "estimated",
      headline: `Stay the course at ${currentCalorieTarget.toLocaleString()} kcal`,
      why: `${why} That lines up with your goal — no change needed.`,
      suggestedCalorieTarget: currentCalorieTarget,
      deltaKcal: 0,
      proteinAnchorG: anchor,
    };
  }

  const step = Math.max(-maxStep, Math.min(maxStep, rawDelta));
  const suggested = roundKcal(currentCalorieTarget + step);
  const delta = suggested - currentCalorieTarget;
  return {
    status: "estimated",
    headline:
      delta > 0
        ? `Nudge calories up to ${suggested.toLocaleString()}`
        : `Ease calories down to ${suggested.toLocaleString()}`,
    why: `${why} To stay on your goal rate, ${delta > 0 ? "add" : "trim"} ~${Math.abs(delta)} kcal/day.`,
    suggestedCalorieTarget: suggested,
    deltaKcal: delta,
    proteinAnchorG: anchor,
  };
}
