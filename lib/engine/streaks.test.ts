import { describe, expect, it } from "vitest";
import {
  DEFAULT_STREAK_CONFIG,
  computeStreak,
  missedRecentDays,
  weeklyStreak,
} from "./streaks";
import { addDays, mondayWeekday } from "@/lib/utils";
import type { StreakState } from "@/lib/types";

const TODAY = "2026-03-15";
/** N consecutive ISO dates ending on `end` (inclusive). */
function run(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, -(n - 1 - i)));
}

describe("computeStreak — basics", () => {
  it("counts a clean consecutive run ending today", () => {
    const s = computeStreak("daily", run(TODAY, 5), TODAY);
    expect(s.current).toBe(5);
    expect(s.longest).toBe(5);
    expect(s.metToday).toBe(true);
    expect(s.atRisk).toBe(false);
  });

  it("an unfinished today never breaks the run — it just marks it at risk", () => {
    const s = computeStreak("daily", run(addDays(TODAY, -1), 5), TODAY);
    expect(s.current).toBe(5); // ended yesterday, today still open
    expect(s.metToday).toBe(false);
    expect(s.atRisk).toBe(true);
  });

  it("returns an idle state with no history", () => {
    const s = computeStreak("daily", [], TODAY);
    expect(s.current).toBe(0);
    expect(s.atRisk).toBe(false);
    expect(s.freezes).toBe(0);
  });
});

describe("computeStreak — freezes", () => {
  it("earns one freeze at each 7-day mark, capped at maxFreezes", () => {
    expect(computeStreak("daily", run(TODAY, 7), TODAY).freezes).toBe(1);
    expect(computeStreak("daily", run(TODAY, 14), TODAY).freezes).toBe(2);
    // 21 straight would earn a third, but the cap holds at 2.
    expect(computeStreak("daily", run(TODAY, 21), TODAY).freezes).toBe(2);
  });

  it("a banked freeze absorbs a single miss and the run survives", () => {
    // 8 met (freeze earned at 7), miss day 9, met day 10.
    const dates = [...run(addDays(TODAY, -2), 8), TODAY];
    const s = computeStreak("daily", dates, TODAY);
    expect(s.current).toBe(9); // 8 → frozen miss → 9
    expect(s.freezes).toBe(0); // the freeze was spent
  });

  it("breaks only once freezes are exhausted", () => {
    // 5 met (no freeze yet), then a miss with nothing banked → break.
    const dates = run(addDays(TODAY, -2), 5); // ends two days ago
    const s = computeStreak("daily", dates, TODAY);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(5);
    expect(s.inRepairWindow).toBe(true); // the break was recent
  });
});

describe("computeStreak — earn-back repair", () => {
  it("restores the pre-break run after two consecutive MVDs inside the window", () => {
    // 5 met, miss, then met on the next two days (today-1, today) — within 48h.
    const dates = [...run(addDays(TODAY, -3), 5), addDays(TODAY, -1), TODAY];
    const s = computeStreak("daily", dates, TODAY);
    expect(s.current).toBe(7); // 5 restored + 2 repair days
    expect(s.inRepairWindow).toBe(false);
  });

  it("does not restore when a second miss interrupts the repair", () => {
    // 5 met, miss, one met, miss, met today → repair failed, fresh count.
    const dates = [...run(addDays(TODAY, -5), 5), addDays(TODAY, -3), TODAY];
    const s = computeStreak("daily", dates, TODAY);
    expect(s.current).toBe(1);
  });

  it("does not restore once the earn-back window has lapsed", () => {
    // 5 met, then two straight misses (window closes), then met today.
    const dates = [...run(addDays(TODAY, -6), 5), TODAY];
    const s = computeStreak("daily", dates, TODAY);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(5);
  });
});

describe("computeStreak — milestones", () => {
  it("flags a reached milestone, and carrying it in celebrated suppresses it", () => {
    const first = computeStreak("daily", run(TODAY, 7), TODAY);
    expect(first.pendingMilestone).toBe(7);

    const prev: StreakState = { ...first, celebratedMilestones: [7] };
    const second = computeStreak("daily", run(TODAY, 7), TODAY, DEFAULT_STREAK_CONFIG, prev);
    expect(second.pendingMilestone).toBeNull();
  });
});

describe("missedRecentDays", () => {
  it("is true when the last N days were all missed", () => {
    expect(missedRecentDays(run(addDays(TODAY, -3), 3), TODAY, 2)).toBe(true);
  });

  it("is false when any of the last N days were met", () => {
    expect(missedRecentDays([addDays(TODAY, -1)], TODAY, 2)).toBe(false);
  });

  it("respects a minimum-age gate before signalling", () => {
    expect(missedRecentDays([addDays(TODAY, -1)], TODAY, 2, 5)).toBe(false);
  });
});

describe("weeklyStreak — 3-of-7", () => {
  // Anchor on a Sunday so `today` and today-6 land in the same Monday week.
  const sunday = addDays(TODAY, 6 - mondayWeekday(TODAY));

  it("counts completed prior weeks without breaking on an in-progress week", () => {
    const dates = [
      sunday, // 1 met this week (in progress)
      addDays(sunday, -7),
      addDays(sunday, -8),
      addDays(sunday, -9), // 3 met last week
      addDays(sunday, -14),
      addDays(sunday, -15),
      addDays(sunday, -16), // 3 met the week before
    ];
    const s = weeklyStreak(dates, sunday, 3);
    expect(s.metThisWeek).toBe(false);
    expect(s.thisWeekCount).toBe(1);
    expect(s.current).toBe(2); // two completed prior weeks, current week not counted yet
  });

  it("extends the streak once the current week clears the bar", () => {
    const dates = [
      sunday,
      addDays(sunday, -1),
      addDays(sunday, -2), // 3 this week
      addDays(sunday, -7),
      addDays(sunday, -8),
      addDays(sunday, -9), // 3 last week
    ];
    const s = weeklyStreak(dates, sunday, 3);
    expect(s.metThisWeek).toBe(true);
    expect(s.current).toBe(2);
  });

  it("a week under the bar breaks the weekly run", () => {
    const dates = [
      sunday,
      addDays(sunday, -1),
      addDays(sunday, -2), // 3 this week
      addDays(sunday, -7), // only 1 last week (under the bar)
    ];
    const s = weeklyStreak(dates, sunday, 3);
    expect(s.metThisWeek).toBe(true);
    expect(s.current).toBe(1); // only the current week counts
  });
});
