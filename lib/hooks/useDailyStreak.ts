"use client";

import { useCallback, useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { DEFAULT_STREAK_CONFIG, computeStreak } from "@/lib/engine/streaks";
import { mvdStatus } from "@/lib/engine/dayPhase";
import { toISODate } from "@/lib/utils";
import type { StreakState } from "@/lib/types";

const DAILY_ID = "daily";

/**
 * The app-wide Minimum Viable Day streak. Recomputes from the history of days
 * where the MVD was met (one meal + the check-in), carrying forward which
 * milestone cards have already been dismissed, and persists the snapshot so
 * the coach and other surfaces can read it without re-walking history.
 */
export function useDailyStreak() {
  const { adapter, profile, revision } = useStorage();
  const today = toISODate();
  const [streak, setStreak] = useState<StreakState | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      const [logs, prev] = await Promise.all([
        adapter.listDailyLogs(profile.startDate, today),
        adapter.getStreak(DAILY_ID),
      ]);
      const metDates = logs.filter((l) => mvdStatus(l, profile.mvd).met).map((l) => l.date);
      const next = computeStreak(DAILY_ID, metDates, today, undefined, prev ?? undefined);
      if (cancelled) return;
      setStreak(next);
      // Persist only when something meaningful changed, to avoid write churn.
      if (
        !prev ||
        prev.current !== next.current ||
        prev.freezes !== next.freezes ||
        prev.longest !== next.longest ||
        prev.lastMetDate !== next.lastMetDate
      ) {
        await adapter.saveStreak(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, profile, today, revision]);

  /**
   * Mark a milestone's celebration seen. Also clears any *lower* milestones the
   * user blew past offline, so dismissing one card doesn't cascade into a stack
   * of stale ones.
   */
  const celebrate = useCallback(
    async (milestone: number) => {
      if (!streak) return;
      const seen = new Set(streak.celebratedMilestones);
      for (const m of DEFAULT_STREAK_CONFIG.milestones) if (m <= milestone) seen.add(m);
      const updated: StreakState = {
        ...streak,
        celebratedMilestones: [...seen].sort((a, b) => a - b),
        pendingMilestone: null,
      };
      setStreak(updated);
      await adapter.saveStreak(updated);
    },
    [adapter, streak]
  );

  return { streak, celebrate };
}
