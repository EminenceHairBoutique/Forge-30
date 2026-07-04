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
import { resolveScoreState } from "@/lib/engine/forgeScore";
import { mvdStatus, shouldShowEveningReview, shouldShowMorningPlan } from "@/lib/engine/dayPhase";
import { useDay } from "@/lib/hooks/useDay";
import { useDailyStreak } from "@/lib/hooks/useDailyStreak";
import { StreakFlame } from "@/components/today/StreakFlame";
import { StreakCelebrationCard } from "@/components/today/StreakCelebrationCard";
import { StreakComebackCard } from "@/components/today/StreakComebackCard";
import { toISODate, daysBetween, clamp, formatMoney, fromISODate } from "@/lib/utils";
import { PROGRAM_LENGTH_DAYS } from "@/lib/data/defaults";
import { workoutForDate } from "@/lib/engine/workoutBuilder";
import type { AIReview, CustomWorkoutPlan, TomorrowPlan, WorkoutStatus } from "@/lib/types";
import { ScoreRing } from "@/components/cards/ScoreRing";
import { StatCard } from "@/components/cards/StatCard";
import { PatternsCard } from "@/components/cards/PatternsCard";
import { QuickActions } from "@/components/shell/QuickActions";
import { DailyCheckSheet } from "@/components/forms/DailyCheckSheet";
import { MorningPlanCard } from "@/components/today/MorningPlanCard";
import { EveningReviewCard } from "@/components/today/EveningReviewCard";
import { HardDaySheet } from "@/components/today/HardDaySheet";
import { PlanTomorrowSheet } from "@/components/today/PlanTomorrowSheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifeBuoy } from "lucide-react";

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
  const { streak, celebrate } = useDailyStreak();
  const [review, setReview] = useState<AIReview | null>(null);
  const [todayIntent, setTodayIntent] = useState<TomorrowPlan | null>(null);
  const [customPlan, setCustomPlan] = useState<CustomWorkoutPlan | null>(null);
  const [hardDayOpen, setHardDayOpen] = useState(false);
  const [planTomorrowOpen, setPlanTomorrowOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adapter.getAIReview(today),
      adapter.getTomorrowPlan(today),
      adapter.getCustomWorkoutPlan(),
    ]).then(([r, t, c]) => {
      if (cancelled) return;
      setReview(r);
      setTodayIntent(t);
      setCustomPlan(c);
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
  const scoreState = resolveScoreState(new Date().getHours(), profile.dayBoundaryHour);
  const mvd = mvdStatus(log, profile.mvd);
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

      {shouldShowMorningPlan(log, scoreState) && !log.hardDay && (
        <MorningPlanCard
          date={today}
          mvd={mvd}
          plan={todayIntent}
          workout={workoutForDate(customPlan, today)}
          onDismiss={() => updateLog({ morningPlanSeen: true })}
          onHardDay={() => setHardDayOpen(true)}
        />
      )}

      {shouldShowEveningReview(scoreState, !!review) && (
        <EveningReviewCard onPlanTomorrow={() => setPlanTomorrowOpen(true)} />
      )}

      {log.hardDay && (
        <button type="button" onClick={() => setHardDayOpen(true)} className="w-full text-left">
          <Card className="animate-rise flex items-start gap-3 border-gold/30 bg-gold/5 p-4">
            <LifeBuoy className="mt-0.5 size-5 shrink-0 text-gold" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
                Hard day — minimum viable day only
              </p>
              <p className="mt-0.5 text-sm text-ivory">
                {mvd.met
                  ? "MVD met. You're done — anything else is a bonus."
                  : `Still open: ${mvd.remaining.join(" and ")}. Then you're done.`}
              </p>
            </div>
          </Card>
        </button>
      )}

      {streak && streak.pendingMilestone !== null && (
        <StreakCelebrationCard
          milestone={streak.pendingMilestone}
          onDismiss={() => celebrate(streak.pendingMilestone!)}
        />
      )}

      {streak && streak.current === 0 && streak.longest > 0 && !streak.metToday && (
        <StreakComebackCard streak={streak} />
      )}

      <div className="flex flex-col items-center gap-2 py-2">
        {streak && <StreakFlame streak={streak} />}
        <ScoreRing result={scoreResult} state={scoreState} />
        {!log.hardDay && scoreState === "inProgress" && (
          <Button variant="ghost" size="sm" onClick={() => setHardDayOpen(true)}>
            <LifeBuoy className="size-4" /> Having a hard day?
          </Button>
        )}
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

      {/* LifeGraph patterns (E14) — renders only past the sample-size guard */}
      <PatternsCard />

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
          // Adherence-neutral: a skipped workout is a missed habit, not a
          // safety event — danger/warning never color ordinary variance.
          tone={log.workoutStatus === "complete" ? "success" : "default"}
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

      <HardDaySheet
        open={hardDayOpen}
        onOpenChange={setHardDayOpen}
        log={log}
        mvd={mvd}
        onSetHardDay={(v) => updateLog({ hardDay: v })}
      />
      <PlanTomorrowSheet open={planTomorrowOpen} onOpenChange={setPlanTomorrowOpen} />
    </div>
  );
}
