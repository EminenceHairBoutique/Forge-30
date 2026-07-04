"use client";

import { useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { buildDays, detectPatterns, type DetectedPattern } from "@/lib/engine/lifeGraph";
import { notesForConsumer } from "@/lib/engine/journalRules";
import { toISODate, addDays } from "@/lib/utils";

/**
 * Loads the trailing 30 days of already-logged domain data, applies the
 * journal consent gate (LifeGraph consumer; private notes never pass), and
 * runs the deterministic LifeGraph engine. The single data path for every
 * pattern surface (Today card, weekly report, coach pattern review).
 */
export function usePatterns(): { patterns: DetectedPattern[]; loaded: boolean } {
  const { adapter, profile, revision } = useStorage();
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const today = toISODate();
    const from = addDays(today, -30);
    Promise.all([
      adapter.listDailyLogs(from, today),
      adapter.listSpendingRange(from, today),
      adapter.listBloodPressure(from, today),
      adapter.listTomorrowPlans(from, today),
      adapter.listJournals(from, today),
      adapter.listJournalNotes(from, today),
      adapter.getJournalConsent(),
    ]).then(([logs, spending, bloodPressure, plans, journals, notes, consent]) => {
      if (cancelled) return;
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
      setPatterns(detectPatterns(days, today));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, profile, revision]);

  return { patterns, loaded };
}
