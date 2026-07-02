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

  // Most-missed habit across days that have any activity logged.
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
    mostMissedHabit: worst > 0 ? mostMissedHabit : "—",
  };
}

/** One honest sentence summarizing the week for the report card. */
export function summarizeWeek(s: WeeklySummary, profile: UserProfile): string {
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
  if (s.mostMissedHabit !== "—") {
    parts.push(`Most-missed habit: ${s.mostMissedHabit}.`);
  }
  return parts.join(" ");
}
