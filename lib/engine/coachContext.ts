import type { StorageAdapter } from "@/lib/storage/adapter";
import type { UserProfile } from "@/lib/types";
import { addDays, clamp, daysBetween } from "@/lib/utils";
import { PROGRAM_LENGTH_DAYS } from "@/lib/data/defaults";
import { calculateSmoothedWeightTrend, calculateWeightTrend } from "./trends";
import { syncDailyLog } from "./dailySync";
import { resolveScoreState } from "./forgeScore";
import { missedRecentDays } from "./streaks";
import { notesForConsumer, themesForCoach } from "./journalRules";
import { isolationSignal } from "./socialRules";
import { adherence } from "./protocols";
import type {
  CoachInput,
  CoachStylePrefs,
  FollowThroughEntry,
  Summary30d,
} from "./mockCoach";
import type { AIReview, AssessmentResult, DailyLog } from "@/lib/types";

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
 * Trailing-30-day compressed summary (v3 Phase 5) — small enough to ride in
 * every coach call (~1KB), computed locally from what's actually logged.
 * Pure and tested.
 */
export function compress30d(logs: DailyLog[], proteinTarget: number, spendLimit: number): Summary30d {
  const scored = logs.filter((l) => l.forgeScore > 0);
  const sleeps = logs.map((l) => l.sleepHours).filter((v) => v > 0);
  const stresses = logs.map((l) => l.stress).filter((v) => v > 0);
  const withMeals = logs.filter((l) => l.calories > 0);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return {
    daysLogged: logs.filter((l) => l.calories > 0 || l.mood > 0 || l.workoutStatus !== "notStarted").length,
    avgScore: scored.length ? Math.round(scored.reduce((a, l) => a + l.forgeScore, 0) / scored.length) : null,
    workoutDays: logs.filter((l) => l.workoutStatus === "complete").length,
    proteinHitRate: withMeals.length
      ? Math.round((withMeals.filter((l) => l.protein >= proteinTarget * 0.9).length / withMeals.length) * 100) / 100
      : null,
    avgSleep: avg(sleeps),
    avgStress: avg(stresses),
    journalDays: logs.filter((l) => l.journalDone).length,
    skillMinutes: logs.reduce((a, l) => a + l.skillMinutes, 0),
    // Days the spending check was skipped entirely — visibility, not judgment.
    overspendDays: spendLimit >= 0 ? logs.filter((l) => !l.spendingChecked).length : 0,
  };
}

/**
 * The follow-through loop (v3 Phase 5): the last 7 reviews' #1 priorities
 * paired with the FOLLOWING day's outcome data. The coach states what the
 * data shows — adherence-neutral, no verdicts beyond the numbers. Pure.
 */
export function buildFollowThrough(reviews: AIReview[], logs: DailyLog[]): FollowThroughEntry[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  return [...reviews]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map((r) => {
      const next = byDate.get(addDays(r.date, 1));
      return {
        date: r.date,
        priority: r.tomorrowPriority,
        nextDayLogged: !!next && (next.calories > 0 || next.mood > 0 || next.workoutStatus !== "notStarted"),
        nextDayScore: next && next.forgeScore > 0 ? next.forgeScore : null,
      };
    });
}

/** Coaching Style result → tone dials for the prompt (preferences, never scores). */
export function coachStyleFromResults(results: AssessmentResult[]): CoachStylePrefs | null {
  const latest = [...results]
    .filter((r) => r.assessmentId === "coachingStyle")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return null;
  const band = (key: string): "low" | "balanced" | "high" =>
    latest.traits.find((t) => t.key === key)?.band ?? "balanced";
  return {
    directness: band("directness"),
    structure: band("structure"),
    push: band("push"),
    dataOrientation: band("dataOrientation"),
  };
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
  const [workout, metrics, skillsRecent, journalConsent, bpWeek, debriefs, outreach, weekLogs, monthLogs, recentReviews, dailyStreak, assessmentResults] =
    await Promise.all([
      adapter.getWorkout(date),
      adapter.listBodyMetrics(addDays(date, -6), date),
      adapter.listSkillTasks(addDays(date, -2), addDays(date, -1)),
      adapter.getJournalConsent(),
      adapter.listBloodPressure(addDays(date, -6), date),
      adapter.listConflictDebriefs(),
      adapter.listOutreach(addDays(date, -30), date),
      adapter.listDailyLogs(addDays(date, -6), date),
      adapter.listDailyLogs(addDays(date, -29), date),
      adapter.listAIReviews(addDays(date, -8), addDays(date, -1)),
      adapter.getStreak("daily"),
      adapter.listAssessmentResults(),
    ]);

  // Health signals (E15): counts only — categorization language stays in the
  // engines; the coach only ever sees "how many" and "was any in crisis range".
  const elevatedBpCount = bpWeek.filter((r) => r.systolic >= 130 || r.diastolic >= 80).length;
  const bpCrisis = bpWeek.some((r) => r.systolic > 180 || r.diastolic > 120);

  // A this-week debrief with neither a repair attempt nor a calm message drafted.
  const latestDebrief = debriefs[0] ?? null;
  const conflictUnrepaired =
    latestDebrief !== null &&
    latestDebrief.date >= addDays(date, -6) &&
    latestDebrief.repairAttempt.trim() === "" &&
    latestDebrief.nextCalmMessage.trim() === "";

  const moods = weekLogs.map((l) => l.mood).filter((m) => m > 0);
  const isolation = isolationSignal({
    outreach,
    today: date,
    recentMoodAvg: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
  });

  // Journal themes reach the coach ONLY through the consent gate (E6):
  // consent.coach on, private entries excluded, themes only — never text.
  let journalThemes: string[] = [];
  if (journalConsent.coach) {
    const notes = await adapter.listJournalNotes(addDays(date, -6), date);
    journalThemes = themesForCoach(notesForConsumer(notes, journalConsent, "coach"));
  }

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
    journalThemes,
    elevatedBpCount,
    bpCrisis,
    conflictUnrepaired,
    isolationFlagged: isolation.flagged,
    daysSinceOutreach: isolation.daysSinceOutreach,
    // Coach 2.0 memory (v3 Phase 5)
    summary30d: compress30d(monthLogs, profile.proteinTarget, profile.dailySpendingLimit),
    followThrough: buildFollowThrough(recentReviews, monthLogs),
    streakCurrent: dailyStreak?.current ?? 0,
    streakFreezes: dailyStreak?.freezes ?? 0,
    coachStyle: coachStyleFromResults(assessmentResults),
    isSunday: new Date(`${date}T12:00:00`).getDay() === 0,
    ...(profile.sleepQuality ? { sleepQuality: profile.sleepQuality } : {}),
    ...(await protocolContext(adapter, date)),
  };
}

/**
 * Behavioral protocol context (v3 Phase 6): adherence numbers only, present
 * only while the tab is enabled. What the coach may say about them is
 * governed by the §6.0.3 rail in the system prompt.
 */
async function protocolContext(
  adapter: StorageAdapter,
  date: string
): Promise<Pick<CoachInput, "protocolAdherence7d" | "protocolMissedCount7d">> {
  const settings = await adapter.getProtocolSettings();
  if (!settings.enabled) return {};
  const from = addDays(date, -6);
  const [schedules, doses] = await Promise.all([
    adapter.listProtocolSchedules(),
    adapter.listDoseEvents(from, date),
  ]);
  const a = adherence(schedules, doses, from, date);
  return {
    protocolAdherence7d: a.percent,
    protocolMissedCount7d: Math.max(0, a.scheduledCount - a.loggedCount),
  };
}
