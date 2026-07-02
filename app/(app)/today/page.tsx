"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame,
  Beef,
  Droplets,
  Dumbbell,
  Footprints,
  Moon,
  StretchHorizontal,
  Wallet,
  SmilePlus,
  GraduationCap,
  Sparkles,
  Settings,
} from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { useDay } from "@/lib/hooks/useDay";
import { toISODate, daysBetween, clamp, formatMoney, fromISODate } from "@/lib/utils";
import { PROGRAM_LENGTH_DAYS } from "@/lib/data/defaults";
import type { AIReview, WorkoutStatus } from "@/lib/types";
import { ScoreRing } from "@/components/cards/ScoreRing";
import { StatCard } from "@/components/cards/StatCard";
import { QuickActions } from "@/components/shell/QuickActions";
import { DailyCheckSheet } from "@/components/forms/DailyCheckSheet";
import { Card } from "@/components/ui/card";

const WORKOUT_LABEL: Record<WorkoutStatus, string> = {
  notStarted: "Not started",
  inProgress: "In progress",
  complete: "Complete",
  rest: "Rest day",
  skipped: "Skipped",
};

export default function TodayPage() {
  const { adapter, profile, revision } = useStorage();
  const today = toISODate();
  const { snapshot, updateLog, loading } = useDay(today);
  const [review, setReview] = useState<AIReview | null>(null);

  useEffect(() => {
    let cancelled = false;
    adapter.getAIReview(today).then((r) => {
      if (!cancelled) setReview(r);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, today, revision]);

  if (loading || !snapshot || !profile) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Flame className="size-8 animate-pulse text-gold" />
      </div>
    );
  }

  const { log, scoreResult, unnecessarySpend } = snapshot;
  const dayNumber = clamp(daysBetween(profile.startDate, today) + 1, 1, PROGRAM_LENGTH_DAYS);
  const dateLabel = fromISODate(today).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 pb-2">
      <header className="flex items-start justify-between pt-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Day {dayNumber} of {PROGRAM_LENGTH_DAYS}
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">
            {profile.name ? `${profile.name}'s forge` : dateLabel}
          </h1>
          {profile.name && <p className="text-sm text-muted">{dateLabel}</p>}
        </div>
        <div className="flex items-center gap-1">
          <DailyCheckSheet log={log} onSave={updateLog} />
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex size-11 items-center justify-center rounded-full text-muted active:text-ivory lg:hover:text-ivory"
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </header>

      <div className="flex justify-center py-2">
        <ScoreRing result={scoreResult} />
      </div>

      {/* AI Coach one-liner */}
      <Link href="/coach" className="block">
        <Card className="flex items-start gap-3 border-gold/25 bg-gold/5 p-4 transition-colors active:border-gold/50 lg:hover:border-gold/50">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">AI Coach</p>
            <p className="mt-0.5 text-sm text-ivory">
              {review
                ? review.tomorrowPriority
                : "No review yet today. Tap for honest feedback on what you've logged."}
            </p>
          </div>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Calories"
          icon={Flame}
          href="/nutrition"
          value={
            <>
              {log.calories.toLocaleString()}
              <span className="text-sm font-semibold text-muted">
                {" "}
                / {profile.calorieTarget.toLocaleString()}
              </span>
            </>
          }
          progress={{ value: log.calories, max: profile.calorieTarget }}
        />
        <StatCard
          label="Protein"
          icon={Beef}
          href="/nutrition"
          value={
            <>
              {Math.round(log.protein)}g
              <span className="text-sm font-semibold text-muted"> / {profile.proteinTarget}g</span>
            </>
          }
          progress={{ value: log.protein, max: profile.proteinTarget }}
        />
        <StatCard
          label="Water"
          icon={Droplets}
          href="/nutrition"
          value={
            <>
              {(log.waterMl / 1000).toFixed(1)}L
              <span className="text-sm font-semibold text-muted">
                {" "}
                / {(profile.waterTarget / 1000).toFixed(1)}L
              </span>
            </>
          }
          progress={{ value: log.waterMl, max: profile.waterTarget }}
        />
        <StatCard
          label="Workout"
          icon={Dumbbell}
          href="/training"
          value={WORKOUT_LABEL[log.workoutStatus]}
          tone={
            log.workoutStatus === "complete"
              ? "success"
              : log.workoutStatus === "skipped"
                ? "danger"
                : "default"
          }
          sub={log.painScore > 0 ? `Pain ${log.painScore}/10 logged` : undefined}
        />
        <StatCard
          label="Steps"
          icon={Footprints}
          value={log.steps > 0 ? log.steps.toLocaleString() : "—"}
        />
        <StatCard
          label="Sleep"
          icon={Moon}
          value={log.sleepHours > 0 ? `${log.sleepHours}h` : "—"}
          tone={log.sleepHours >= 7 ? "success" : "default"}
        />
        <StatCard
          label="Mobility"
          icon={StretchHorizontal}
          value={log.mobilityDone ? "Done" : "Not yet"}
          tone={log.mobilityDone ? "success" : "default"}
          sub={log.mobilityDone ? undefined : "Log it in Daily check"}
        />
        <StatCard
          label="Spending"
          icon={Wallet}
          href="/money"
          value={
            log.spendingChecked
              ? snapshot.totalSpend > 0
                ? formatMoney(snapshot.totalSpend)
                : "Checked"
              : "Unchecked"
          }
          tone={unnecessarySpend > profile.dailySpendingLimit ? "danger" : "default"}
          sub={unnecessarySpend > 0 ? `${formatMoney(unnecessarySpend)} unnecessary` : undefined}
        />
        <StatCard
          label="Mood / Stress"
          icon={SmilePlus}
          href="/mind"
          value={log.mood > 0 ? `${log.mood} / ${log.stress}` : "—"}
          tone={log.stress >= 8 ? "warning" : "default"}
          sub={log.mood > 0 ? "mood / stress out of 10" : "Do the mind check-in"}
        />
        <StatCard
          label="Skill Time"
          icon={GraduationCap}
          href="/skills"
          value={`${log.skillMinutes} min`}
          tone={log.skillMinutes >= 10 ? "success" : "default"}
          sub="10 min keeps the streak"
        />
      </div>

      <QuickActions />
    </div>
  );
}
