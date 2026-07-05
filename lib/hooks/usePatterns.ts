"use client";

import { useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import type { StorageAdapter } from "@/lib/storage/adapter";
import type { UserProfile } from "@/lib/types";
import {
  buildDays,
  detectPatterns,
  filterRecentlySurfaced,
  markSurfaced,
  type DetectedPattern,
} from "@/lib/engine/lifeGraph";
import { notesForConsumer } from "@/lib/engine/journalRules";
import { toISODate, addDays } from "@/lib/utils";

/**
 * Loads the trailing 30 days of already-logged domain data, applies the
 * journal consent gate (LifeGraph consumer; private notes never pass), and
 * runs the deterministic LifeGraph engine. The single data path for every
 * pattern surface AND the coach context (v3 Phase 5).
 */
export async function loadPatterns(
  adapter: StorageAdapter,
  profile: UserProfile,
  today: string
): Promise<DetectedPattern[]> {
  const from = addDays(today, -30);
  const [logs, spending, bloodPressure, plans, journals, notes, consent] = await Promise.all([
    adapter.listDailyLogs(from, today),
    adapter.listSpendingRange(from, today),
    adapter.listBloodPressure(from, today),
    adapter.listTomorrowPlans(from, today),
    adapter.listJournals(from, today),
    adapter.listJournalNotes(from, today),
    adapter.getJournalConsent(),
  ]);
  const days = buildDays({
    logs,
    spending,
    bloodPressure,
    plans,
    journals,
    consentedNotes: notesForConsumer(notes, consent, "lifeGraph"),
    dailySpendingLimit: profile.dailySpendingLimit,
    calorieTarget: profile.calorieTarget,
  });
  return detectPatterns(days, today);
}

/**
 * The user-facing hook: applies the no-repeat rule (nothing surfaces twice
 * inside a week) and records what it showed. The coach context uses
 * loadPatterns() directly — context isn't "surfacing", so it never burns
 * the cooldown.
 */
export function usePatterns(): { patterns: DetectedPattern[]; loaded: boolean } {
  const { adapter, profile, revision } = useStorage();
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const today = toISODate();
    void (async () => {
      const [all, log] = await Promise.all([
        loadPatterns(adapter, profile, today),
        adapter.getPatternLog(),
      ]);
      if (cancelled) return;
      const fresh = filterRecentlySurfaced(all, log, today);
      setPatterns(fresh);
      setLoaded(true);
      if (fresh.length > 0) {
        await adapter.savePatternLog(markSurfaced(log, fresh, today));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, profile, revision]);

  return { patterns, loaded };
}
