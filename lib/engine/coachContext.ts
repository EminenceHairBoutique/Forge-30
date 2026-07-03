import type { StorageAdapter } from "@/lib/storage/adapter";
import type { UserProfile } from "@/lib/types";
import { addDays, clamp, daysBetween } from "@/lib/utils";
import { PROGRAM_LENGTH_DAYS } from "@/lib/data/defaults";
import { calculateSmoothedWeightTrend, calculateWeightTrend } from "./trends";
import { syncDailyLog } from "./dailySync";
import { resolveScoreState } from "./forgeScore";
import { missedRecentDays } from "./streaks";
import type { CoachInput } from "./mockCoach";

/**
 * 7-day weight movement for the coach: the EWMA-smoothed change when the
 * series supports it, falling back to the raw first-to-last delta (which
 * itself is null under 2 weigh-ins). Same semantic the coach always had —
 * just noise-damped now that the expenditure engine's smoother exists (E4).
 */
function smoothedWeekTrend(metrics: Parameters<typeof calculateWeightTrend>[0]): number | null {
  const smoothed = calculateSmoothedWeightTrend(metrics);
  if (smoothed.length >= 2) {
    return Math.round((smoothed[smoothed.length - 1]!.trendLb - smoothed[0]!.trendLb) * 10) / 10;
  }
  return calculateWeightTrend(metrics);
}

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

  // Same "last two days both missed" signal, now sourced from the shared
  // streak helper instead of an ad hoc walk (E3). The start-date guard keeps
  // day 1–2 quiet.
  const skillMissedTwoDays =
    missedRecentDays(
      skillsRecent.map((t) => t.date),
      date,
      2
    ) && daysBetween(profile.startDate, date) >= 2;

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
    weightTrend7d: smoothedWeekTrend(metrics),
    scoreState: resolveScoreState(new Date().getHours(), profile.dayBoundaryHour),
    hardDay: log.hardDay ?? false,
  };
}
