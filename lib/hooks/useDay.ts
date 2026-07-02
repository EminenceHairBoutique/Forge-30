"use client";

import { useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { syncDailyLog, type DaySnapshot } from "@/lib/engine/dailySync";
import { toISODate } from "@/lib/utils";
import type { DailyLog } from "@/lib/types";

/**
 * Loads (and keeps in sync) the fully derived snapshot for a day. Re-runs
 * whenever any page bumps the storage revision after a write.
 */
export function useDay(date: string = toISODate()) {
  const { adapter, profile, revision, touch } = useStorage();
  const [snapshot, setSnapshot] = useState<DaySnapshot | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    syncDailyLog(adapter, date, profile).then((snap) => {
      if (!cancelled) setSnapshot(snap);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, date, profile, revision]);

  /** Merge manual fields into the log, persist, and refresh all views. */
  const updateLog = async (patch: Partial<DailyLog>) => {
    if (!profile) return;
    const current = (await adapter.getDailyLog(date)) ?? snapshot?.log;
    if (!current) return;
    await adapter.saveDailyLog({ ...current, ...patch, date });
    touch();
  };

  return { snapshot, updateLog, loading: snapshot === null };
}
