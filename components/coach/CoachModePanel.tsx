"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquareHeart, LifeBuoy } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { usePatterns } from "@/lib/hooks/usePatterns";
import {
  COACH_MODES,
  journalReflectionMode,
  patternReviewMode,
  relationshipDebriefMode,
  tomorrowPlanMode,
  weeklyReviewMode,
  type CoachModeId,
  type ModeSection,
} from "@/lib/engine/coachModes";
import { calculateWeeklySummary } from "@/lib/engine/weeklySummary";
import { computePersonalRecords } from "@/lib/engine/trainingRules";
import { summarizeJournal } from "@/lib/engine/journalRules";
import { notesForConsumer } from "@/lib/engine/journalRules";
import { toISODate, addDays, daysBetween, mondayWeekday } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Renders the non-daily coach modes (E15). Every mode here is deterministic —
 * pure engine output, zero network. Doorway modes (hard day, relationship
 * debrief) link into their full flows.
 */
export function CoachModePanel({ mode }: { mode: CoachModeId }) {
  const { adapter, profile, revision } = useStorage();
  const { patterns } = usePatterns();
  const [sections, setSections] = useState<ModeSection[]>([]);
  const today = toISODate();

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    const load = async (): Promise<ModeSection[]> => {
      switch (mode) {
        case "weeklyReview": {
          const weekStart = addDays(today, -mondayWeekday(today));
          const weekEnd = addDays(weekStart, 6);
          const [logs, workouts, spending, metrics, allWorkouts] = await Promise.all([
            adapter.listDailyLogs(weekStart, weekEnd),
            adapter.listWorkouts(weekStart, weekEnd),
            adapter.listSpendingRange(weekStart, weekEnd),
            adapter.listBodyMetrics(weekStart, weekEnd),
            adapter.listAllWorkouts(),
          ]);
          const summary = calculateWeeklySummary({
            weekStart,
            weekEnd,
            logs,
            workouts,
            spending,
            metrics,
            prs: computePersonalRecords(allWorkouts),
            profile,
            expectedDays: daysBetween(weekStart, today) + 1,
          });
          return weeklyReviewMode(summary, profile);
        }
        case "tomorrowPlan": {
          const plan = await adapter.getTomorrowPlan(addDays(today, 1));
          return tomorrowPlanMode(plan);
        }
        case "relationshipDebrief": {
          const debriefs = await adapter.listConflictDebriefs();
          return relationshipDebriefMode(debriefs[0] ?? null);
        }
        case "journalReflection": {
          const consent = await adapter.getJournalConsent();
          if (!consent.coach) return journalReflectionMode(false, null);
          const notes = await adapter.listJournalNotes(addDays(today, -6), today);
          return journalReflectionMode(
            true,
            summarizeJournal(notesForConsumer(notes, consent, "coach"))
          );
        }
        case "patternReview":
          return patternReviewMode(patterns);
        default:
          return [];
      }
    };

    void load().then((s) => {
      if (!cancelled) setSections(s);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, profile, mode, today, revision, patterns]);

  const def = COACH_MODES.find((m) => m.id === mode);
  if (!def) return null;

  // Doorway modes: a short frame + the link into the full flow.
  if (mode === "hardDay") {
    return (
      <Card className="border-gold/25 bg-gold/5 p-4">
        <p className="flex items-center gap-2 microlabel text-gold">
          <LifeBuoy className="size-3.5" /> Hard day
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ivory">
          Some days the right coaching is less, not more. Hard-day mode collapses today to the
          Minimum Viable Day — one meal and the check-in — pauses the audit, and protects the
          streak. No guilt attached, ever.
        </p>
        <Link href="/today" className="mt-3 inline-block">
          <Button size="sm" variant="secondary">
            Declare it on Today <ArrowRight className="size-4" />
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map((s, i) => (
        <Card key={`${s.label}-${i}`} className="p-4">
          <p className="microlabel text-muted">
            {s.label}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ivory">{s.text}</p>
        </Card>
      ))}
      {mode === "relationshipDebrief" && (
        <Link href="/relationships">
          <Button variant="secondary" className="w-full">
            <MessageSquareHeart className="size-4 text-gold" /> Open the full debrief flow
          </Button>
        </Link>
      )}
      <p className="text-center text-xs text-muted">
        Deterministic — generated from your own logs, no AI call.
      </p>
    </div>
  );
}
