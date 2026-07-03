import type { StorageAdapter } from "@/lib/storage/adapter";
import type { CalendarState, DailyLog, ISODate, UserProfile } from "@/lib/types";
import { emptyDailyLog } from "@/lib/data/defaults";
import { calculateMacroTotals } from "./nutritionRules";
import {
  DEFAULT_WEIGHTS,
  calculateForgeScore,
  disabledComponents,
  renormalizeWeights,
  type ForgeScoreResult,
} from "./forgeScore";

export interface DaySnapshot {
  log: DailyLog;
  scoreResult: ForgeScoreResult;
  unnecessarySpend: number;
  totalSpend: number;
}

function deriveCalendarState(log: DailyLog): CalendarState {
  if (log.painScore >= 7) return "highPain";
  if (log.stress >= 8) return "highStress";
  if (log.forgeScore >= 80) return "complete";
  if (log.workoutStatus === "rest" && log.forgeScore >= 50) return "recovery";
  if (log.forgeScore >= 40) return "partial";
  return "missed";
}

/**
 * Recomputes the DailyLog for a date from all source collections (meals,
 * workout, journal, spending, skills), rescores it, and persists it. This is
 * the single write path for derived daily state — every page calls it after
 * a write, so the Today dashboard, calendar, and coach always agree.
 *
 * Manually-entered fields on the log (waterMl, steps, sleepHours,
 * mobilityDone, and the explicit "no spend today" check) are preserved.
 */
export async function syncDailyLog(
  adapter: StorageAdapter,
  date: ISODate,
  profile: UserProfile
): Promise<DaySnapshot> {
  const [existing, meals, workout, journal, spending, skillTasks] = await Promise.all([
    adapter.getDailyLog(date),
    adapter.listMeals(date),
    adapter.getWorkout(date),
    adapter.getJournal(date),
    adapter.listSpending(date),
    adapter.listSkillTasks(date, date),
  ]);

  const log: DailyLog = existing ?? emptyDailyLog(date);
  const totals = calculateMacroTotals(meals);

  log.calories = totals.calories;
  log.protein = totals.protein;
  log.carbs = totals.carbs;
  log.fats = totals.fats;

  if (workout) {
    log.workoutStatus = workout.status;
    log.painScore = Math.max(log.painScore, workout.sessionPainScore);
  }

  if (journal) {
    log.mood = journal.mood;
    log.stress = journal.stress;
    log.journalDone = true;
  }

  log.spendingChecked = log.spendingChecked || spending.length > 0;
  log.skillMinutes = skillTasks.reduce((sum, t) => sum + t.minutes, 0);

  const unnecessarySpend = spending
    .filter((s) => !s.necessary)
    .reduce((sum, s) => sum + s.amount, 0);
  const totalSpend = spending.reduce((sum, s) => sum + s.amount, 0);

  const scoreResult = calculateForgeScore(
    {
      calories: log.calories,
      protein: log.protein,
      waterMl: log.waterMl,
      workoutStatus: log.workoutStatus,
      mobilityDone: log.mobilityDone,
      sleepHours: log.sleepHours,
      spendingChecked: log.spendingChecked,
      journalDone: log.journalDone,
      skillMinutes: log.skillMinutes,
      painScore: log.painScore,
      stress: log.stress,
      unnecessarySpend,
    },
    {
      calorieTarget: profile.calorieTarget,
      proteinTarget: profile.proteinTarget,
      waterTarget: profile.waterTarget,
      dailySpendingLimit: profile.dailySpendingLimit,
    },
    // User weights (E3), with disabled domains' weight redistributed (E5).
    renormalizeWeights(profile.scoreWeights ?? DEFAULT_WEIGHTS, disabledComponents(profile.domains))
  );

  log.forgeScore = scoreResult.score;
  log.calendarState = deriveCalendarState(log);

  await adapter.saveDailyLog(log);
  return { log, scoreResult, unnecessarySpend, totalSpend };
}
