import type { ISODate, StreakState } from "@/lib/types";
import { addDays, daysBetween } from "@/lib/utils";

/**
 * Streak engine — the generalized, deterministic version of the page-local
 * `streakFor()` that used to live in skills/page.tsx. It backs the app-wide
 * daily (Minimum Viable Day) streak, per-skill-track streaks, and weekly-mode
 * habits (workouts, social outreach).
 *
 * Everything here is a pure function of the *history of met days* plus config.
 * Current count, freezes held, and earn-back state are all re-derived by
 * walking that history each call — there is no hidden accumulator to corrupt,
 * so a recompute after an offline gap always lands on the same answer.
 *
 * Consistency ≠ quality. This engine only ever measures showing up; the Forge
 * Score measures how well. The two stay separate on purpose (adherence-neutral
 * rule) — a streak never shames, never uses warning color, and hard days don't
 * break it (Hard Day mode still logs the MVD).
 */

export interface StreakConfig {
  /** Freezes the user can bank at once. Not free/infinite. */
  maxFreezes: number;
  /** Earn one freeze each time the run crosses a multiple of this many days. */
  freezeEarnInterval: number;
  /** How long after a break the earn-back window stays open (in days; 2 ≈ 48h). */
  earnBackWindowDays: number;
  /** Consecutive met days needed to repair a broken streak inside the window. */
  earnBackMetsNeeded: number;
  /** Celebration thresholds, ascending. */
  milestones: number[];
}

export const DEFAULT_STREAK_CONFIG: StreakConfig = {
  maxFreezes: 2,
  freezeEarnInterval: 7,
  earnBackWindowDays: 2,
  earnBackMetsNeeded: 2,
  milestones: [7, 14, 21, 30],
};

function emptyState(id: string, prev?: StreakState): StreakState {
  return {
    id,
    current: 0,
    longest: prev?.longest ?? 0,
    freezes: 0,
    lastMetDate: null,
    atRisk: false,
    metToday: false,
    inRepairWindow: false,
    pendingMilestone: null,
    celebratedMilestones: prev?.celebratedMilestones ?? [],
  };
}

/**
 * Recompute a streak from the full set of days its requirement was met.
 *
 * `metDates` is every date the streak counted (for the daily streak: days the
 * MVD was met; for a skill: days that track was logged). `today` bounds the
 * walk — an unmet *today* never breaks the streak (the day is still open), it
 * just marks it `atRisk`. `prev` carries forward which milestones the user has
 * already celebrated so a card doesn't re-fire.
 */
export function computeStreak(
  id: string,
  metDates: Iterable<ISODate>,
  today: ISODate,
  config: StreakConfig = DEFAULT_STREAK_CONFIG,
  prev?: StreakState
): StreakState {
  const met = new Set(metDates);
  if (met.size === 0) return emptyState(id, prev);

  const sorted = [...met].sort();
  const start = sorted[0]!;
  // Only history up to and including today is meaningful.
  if (daysBetween(start, today) < 0) return emptyState(id, prev);

  let current = 0;
  let longest = prev?.longest ?? 0;
  let freezes = 0;
  let repair: { preBreak: number; brokenDate: ISODate; mets: number } | null = null;

  for (let day = start; daysBetween(day, today) >= 0; day = addDays(day, 1)) {
    const isMet = met.has(day);
    const isToday = day === today;

    if (isMet) {
      if (repair && daysBetween(repair.brokenDate, day) <= config.earnBackWindowDays) {
        repair.mets += 1;
        if (repair.mets >= config.earnBackMetsNeeded) {
          current = repair.preBreak + repair.mets; // pre-break run restored + repair days
          repair = null;
        } else {
          current = repair.mets; // provisional until the repair completes
        }
      } else {
        repair = null; // window lapsed (or none) — a fresh met day
        current += 1;
      }
      if (current > 0 && current % config.freezeEarnInterval === 0) {
        freezes = Math.min(config.maxFreezes, freezes + 1);
      }
      longest = Math.max(longest, current);
    } else if (isToday) {
      // The day is still open; nothing counts against an unfinished today.
      continue;
    } else if (repair) {
      // A miss inside the repair window ends the repair — the break stands.
      repair = null;
      current = 0;
    } else if (freezes > 0) {
      freezes -= 1; // a banked freeze absorbs the miss; the run survives
    } else if (current > 0) {
      repair = { preBreak: current, brokenDate: day, mets: 0 };
      current = 0;
    }
  }

  const metToday = met.has(today);
  const past = sorted.filter((d) => daysBetween(d, today) >= 0);
  const lastMetDate = past[past.length - 1] ?? null;
  const celebrated = prev?.celebratedMilestones ?? [];
  const pendingMilestone =
    [...config.milestones].filter((m) => current >= m && !celebrated.includes(m)).pop() ?? null;

  return {
    id,
    current,
    longest,
    freezes,
    lastMetDate,
    atRisk: !metToday && current > 0,
    metToday,
    inRepairWindow: repair !== null,
    pendingMilestone,
    celebratedMilestones: celebrated,
  };
}

/**
 * True when the last `n` calendar days before `date` were all missed. Powers
 * the coach's "skill missed two days" nudge from the same met-day set the
 * streak walk uses. `minAgeDays > 0` suppresses the signal until the history
 * is that old (so a brand-new track isn't nagged); the default 0 leaves any
 * age gate to the caller.
 */
export function missedRecentDays(
  metDates: Iterable<ISODate>,
  date: ISODate,
  n: number,
  minAgeDays = 0
): boolean {
  const met = new Set(metDates);
  if (minAgeDays > 0) {
    const first = [...met].sort()[0];
    if (!first || daysBetween(first, date) < minAgeDays) return false;
  }
  for (let i = 1; i <= n; i++) {
    if (met.has(addDays(date, -i))) return false;
  }
  return true;
}

// --- Weekly-mode streaks (workouts, social outreach) -------------------------

// A fixed Monday anchor so week indexes are stable and testable.
const WEEK_ANCHOR = "1970-01-05";

function weekIndex(date: ISODate): number {
  return Math.floor(daysBetween(WEEK_ANCHOR, date) / 7);
}

export interface WeeklyStreak {
  /** Consecutive completed weeks ending at (or just before) the current week. */
  current: number;
  longest: number;
  /** Met days inside the current (in-progress) week. */
  thisWeekCount: number;
  /** Whether the current week has already cleared the bar. */
  metThisWeek: boolean;
  perWeek: number;
}

/**
 * Weekly streak: a week "counts" when at least `perWeek` days were met (the
 * 3-of-7 rule, so travel or illness doesn't wipe months of consistency). The
 * current week is in-progress — it extends the streak once it clears the bar
 * but never breaks it early.
 */
export function weeklyStreak(
  metDates: Iterable<ISODate>,
  today: ISODate,
  perWeek = 3
): WeeklyStreak {
  const counts = new Map<number, number>();
  for (const d of metDates) {
    if (daysBetween(d, today) < 0) continue; // ignore future dates
    const w = weekIndex(d);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  const currentWeek = weekIndex(today);
  const thisWeekCount = counts.get(currentWeek) ?? 0;
  const metThisWeek = thisWeekCount >= perWeek;

  let current = 0;
  let w = currentWeek;
  // The current week only adds to the streak once it's cleared the bar;
  // until then, start counting from last week so it isn't prematurely broken.
  if (!metThisWeek) w -= 1;
  while ((counts.get(w) ?? 0) >= perWeek) {
    current += 1;
    w -= 1;
  }

  // Longest run anywhere in history.
  const weeks = [...counts.keys()].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let last: number | null = null;
  for (const wk of weeks) {
    if ((counts.get(wk) ?? 0) < perWeek) {
      run = 0;
      last = wk;
      continue;
    }
    run = last !== null && wk === last + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = wk;
  }

  return { current, longest, thisWeekCount, metThisWeek, perWeek };
}
