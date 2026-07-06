import { describe, expect, it } from "vitest";
import { calculateWeeklySummary, hasActivity, summarizeWeek } from "./weeklySummary";
import type { DailyLog, UserProfile } from "@/lib/types";

/**
 * Weekly report cold-start gate (v3.3 §1.2): a week with fewer than 3
 * active days gets a "still building" line — never a verdict, never a
 * most-missed habit.
 */

const profile = {
  name: "Test",
  calorieTarget: 2400,
  proteinTarget: 150,
  waterTarget: 3000,
  dailySpendingLimit: 50,
} as UserProfile;

const emptyLog = (date: string): DailyLog =>
  ({
    date,
    forgeScore: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    waterMl: 0,
    workoutStatus: "notStarted",
    steps: 0,
    sleepHours: 0,
    mobilityDone: false,
    spendingChecked: false,
    mood: 0,
    stress: 0,
    painScore: 0,
    skillMinutes: 0,
    journalDone: false,
    calendarState: "missed",
  }) as DailyLog;

const activeLog = (date: string): DailyLog => ({
  ...emptyLog(date),
  forgeScore: 72,
  calories: 2200,
  protein: 140,
  waterMl: 3000,
  workoutStatus: "complete",
  sleepHours: 7.5,
  mobilityDone: true,
  spendingChecked: true,
  mood: 7,
  stress: 4,
  skillMinutes: 20,
  journalDone: true,
});

function summaryFor(logs: DailyLog[], expectedDays: number) {
  return calculateWeeklySummary({
    weekStart: "2026-06-29",
    weekEnd: "2026-07-05",
    logs,
    workouts: [],
    spending: [],
    metrics: [],
    prs: [],
    profile,
    expectedDays,
  });
}

describe("weekly report cold start", () => {
  it("hasActivity distinguishes touched days from blank ones", () => {
    expect(hasActivity(emptyLog("2026-06-29"))).toBe(false);
    expect(hasActivity({ ...emptyLog("2026-06-29"), journalDone: true })).toBe(true);
    expect(hasActivity({ ...emptyLog("2026-06-29"), calories: 500 })).toBe(true);
  });

  it("day 1, nothing logged: building line, no verdict, no most-missed habit", () => {
    const s = summaryFor([emptyLog("2026-06-29")], 1);
    expect(s.activeDays).toBe(0);
    expect(s.mostMissedHabit).toBeUndefined();
    const line = summarizeWeek(s, profile);
    expect(line).toBe("Report builds as the week does — 0 days in.");
    expect(line).not.toMatch(/rough|strong|solid/i);
  });

  it("day 2, partial logging: still building, singular/plural handled", () => {
    const s = summaryFor([activeLog("2026-06-29"), emptyLog("2026-06-30")], 2);
    expect(s.activeDays).toBe(1);
    expect(s.mostMissedHabit).toBeUndefined();
    expect(summarizeWeek(s, profile)).toBe("Report builds as the week does — 1 day in.");
  });

  it("day 4 with 4 active days: the real report, verdict + most-missed habit", () => {
    const logs = [
      activeLog("2026-06-29"),
      activeLog("2026-06-30"),
      { ...activeLog("2026-07-01"), journalDone: false },
      { ...activeLog("2026-07-02"), journalDone: false },
    ];
    const s = summaryFor(logs, 4);
    expect(s.activeDays).toBe(4);
    expect(s.mostMissedHabit).toBe("journal");
    expect(summarizeWeek(s, profile)).toMatch(/week/i);
    expect(summarizeWeek(s, profile)).not.toContain("Report builds");
  });
});
