import type {
  BodyMetric,
  DailyLog,
  PersonalRecord,
  SpendingEntry,
  UserProfile,
  WeeklySummary,
  WorkoutEntry,
} from "@/lib/types";
import { round1 } from "@/lib/utils";
import { calculateWeightTrend } from "./trends";

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const HABIT_LABELS: [string, (log: DailyLog, p: UserProfile) => boolean][] = [
  ["calories", (l, p) => l.calories < p.calorieTarget * 0.9],
  ["protein", (l, p) => l.protein < p.proteinTarget * 0.9],
  ["water", (l, p) => l.waterMl < p.waterTarget],
  ["workout", (l) => l.workoutStatus !== "complete" && l.workoutStatus !== "rest"],
  ["mobility", (l) => !l.mobilityDone],
  ["sleep", (l) => l.sleepHours < 7],
  ["spending check", (l) => !l.spendingChecked],
  ["journal", (l) => !l.journalDone],
  ["skill practice", (l) => l.skillMinutes < 10],
];

/** A day counts as active when anything at all was logged on it. */
export function hasActivity(log: DailyLog): boolean {
  return (
    log.calories > 0 ||
    log.waterMl > 0 ||
    (log.workoutStatus !== "notStarted" && log.workoutStatus !== "skipped") ||
    log.sleepHours > 0 ||
    log.mood > 0 ||
    log.stress > 0 ||
    log.skillMinutes > 0 ||
    log.mobilityDone ||
    log.journalDone ||
    log.spendingChecked
  );
}

/** Below this many active days the report states it's still building (§1.2). */
export const WEEKLY_VERDICT_MIN_ACTIVE_DAYS = 3;

export function calculateWeeklySummary(args: {
  weekStart: string;
  weekEnd: string;
  logs: DailyLog[];
  workouts: WorkoutEntry[];
  spending: SpendingEntry[];
  metrics: BodyMetric[];
  prs: PersonalRecord[];
  profile: UserProfile;
  /** Days of the week that have actually elapsed (1–7). */
  expectedDays: number;
}): WeeklySummary {
  const { weekStart, weekEnd, logs, workouts, spending, metrics, prs, profile, expectedDays } = args;

  const withFood = logs.filter((l) => l.calories > 0);
  const doneWorkouts = workouts.filter((w) => w.status === "complete" || w.status === "rest").length;
  const activeDays = logs.filter(hasActivity).length;

  // Most-missed habit across days that have any activity logged. Cold start
  // (§1.2): with fewer than 3 active days there is no meaningful "most
  // missed" — the field stays undefined and the card doesn't render it.
  let mostMissedHabit = "—";
  let worst = 0;
  for (const [label, missed] of HABIT_LABELS) {
    const count = logs.filter((l) => missed(l, profile)).length;
    if (count > worst) {
      worst = count;
      mostMissedHabit = label;
    }
  }

  return {
    activeDays,
    mostMissedHabit:
      activeDays >= WEEKLY_VERDICT_MIN_ACTIVE_DAYS && worst > 0 ? mostMissedHabit : undefined,
    weekStart,
    weekEnd,
    avgCalories: Math.round(avg(withFood.map((l) => l.calories))),
    avgProtein: Math.round(avg(withFood.map((l) => l.protein))),
    weightTrendLb: calculateWeightTrend(metrics),
    workoutCompletionPct: Math.round((doneWorkouts / Math.max(1, expectedDays)) * 100),
    prCount: prs.filter((p) => p.date >= weekStart && p.date <= weekEnd).length,
    spendingTotal: round1(spending.reduce((s, e) => s + e.amount, 0)),
    unnecessarySpendingTotal: round1(
      spending.filter((e) => !e.necessary).reduce((s, e) => s + e.amount, 0)
    ),
    avgStress: round1(avg(logs.filter((l) => l.stress > 0).map((l) => l.stress))),
    avgSleep: round1(avg(logs.filter((l) => l.sleepHours > 0).map((l) => l.sleepHours))),
    avgForgeScore: Math.round(avg(logs.map((l) => l.forgeScore))),
  };
}

/** One honest sentence summarizing the week for the report card. */
export function summarizeWeek(s: WeeklySummary, profile: UserProfile): string {
  // Cold start (§1.2): no verdict on a week that has barely begun.
  if (s.activeDays < WEEKLY_VERDICT_MIN_ACTIVE_DAYS) {
    return `Report builds as the week does — ${s.activeDays} day${s.activeDays === 1 ? "" : "s"} in.`;
  }
  const parts: string[] = [];
  if (s.avgForgeScore >= 80) parts.push(`Strong week — ${s.avgForgeScore} average score.`);
  else if (s.avgForgeScore >= 60) parts.push(`Solid week at ${s.avgForgeScore} average, with room to tighten up.`);
  else parts.push(`Rough week at ${s.avgForgeScore} average — reset, don't spiral.`);

  if (s.avgCalories > 0 && s.avgCalories < profile.calorieTarget - 300) {
    parts.push(`Calories averaged ${s.avgCalories.toLocaleString()} — that's why the scale isn't moving.`);
  }
  if (s.weightTrendLb !== null && Math.abs(s.weightTrendLb) < 0.5) {
    parts.push("Weight is flat: add 250 calories per day.");
  } else if (s.weightTrendLb !== null && s.weightTrendLb > 0) {
    parts.push(`Up ${s.weightTrendLb} lb — the plan is working.`);
  }
  if (s.unnecessarySpendingTotal > profile.dailySpendingLimit * 3) {
    parts.push(`Unnecessary spending hit $${s.unnecessarySpendingTotal} — cap it next week.`);
  }
  // Most-missed habit is rendered by the report card itself — repeating it
  // here printed the line twice on Progress.
  return parts.join(" ");
}
