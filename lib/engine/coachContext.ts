import type { StorageAdapter } from "@/lib/storage/adapter";
import type { UserProfile } from "@/lib/types";
import { addDays, clamp, daysBetween } from "@/lib/utils";
import { PROGRAM_LENGTH_DAYS } from "@/lib/data/defaults";
import { calculateWeightTrend } from "./trends";
import { syncDailyLog } from "./dailySync";
import { resolveScoreState } from "./forgeScore";
import type { CoachInput } from "./mockCoach";

/**
 * Builds the structured summary of today + trailing 7-day trends that feeds
 * both the mock engine and the live /api/coach route. Runs on the client,
 * because all data lives in the client-side StorageAdapter.
 */
export async function buildCoachInput(
  adapter: StorageAdapter,
  date: string,
  profile: UserProfile
): Promise<CoachInput> {
  const snap = await syncDailyLog(adapter, date, profile);
  const [workout, metrics, skillsRecent] = await Promise.all([
    adapter.getWorkout(date),
    adapter.listBodyMetrics(addDays(date, -6), date),
    adapter.listSkillTasks(addDays(date, -2), addDays(date, -1)),
  ]);

  const yesterday = addDays(date, -1);
  const dayBefore = addDays(date, -2);
  const skillMissedTwoDays =
    !skillsRecent.some((t) => t.date === yesterday) &&
    !skillsRecent.some((t) => t.date === dayBefore) &&
    daysBetween(profile.startDate, date) >= 2;

  const log = snap.log;
  return {
    name: profile.name,
    dayNumber: clamp(daysBetween(profile.startDate, date) + 1, 1, PROGRAM_LENGTH_DAYS),
    forgeScore: log.forgeScore,
    calories: log.calories,
    calorieTarget: profile.calorieTarget,
    protein: log.protein,
    proteinTarget: profile.proteinTarget,
    waterMl: log.waterMl,
    waterTarget: profile.waterTarget,
    workoutStatus: log.workoutStatus,
    splitLabel: workout?.splitLabel ?? "",
    sessionPainScore: Math.max(log.painScore, workout?.sessionPainScore ?? 0),
    sleepHours: log.sleepHours,
    mobilityDone: log.mobilityDone,
    mood: log.mood,
    stress: log.stress,
    journalDone: log.journalDone,
    spendingChecked: log.spendingChecked,
    totalSpend: snap.totalSpend,
    unnecessarySpend: snap.unnecessarySpend,
    dailySpendingLimit: profile.dailySpendingLimit,
    skillMinutes: log.skillMinutes,
    skillMissedTwoDays,
    weightTrend7d: calculateWeightTrend(metrics),
    scoreState: resolveScoreState(new Date().getHours(), profile.dayBoundaryHour),
  };
}
