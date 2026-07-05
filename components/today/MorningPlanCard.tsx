"use client";

import { Sunrise, Dumbbell, UtensilsCrossed, Target, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDailyPlan } from "@/lib/engine/plan";
import type { MvdStatus } from "@/lib/engine/dayPhase";
import { formatMoney } from "@/lib/utils";
import type { TomorrowPlan, WorkoutDayPlan } from "@/lib/types";

/**
 * Morning Plan — the 15-second first-open view: today's plan, one focus,
 * the MVD reminder. Dismisses once per day (persisted on the log).
 */
export function MorningPlanCard({
  date,
  mvd,
  plan,
  workout,
  onDismiss,
  onHardDay,
}: {
  date: string;
  /** Today's Minimum Viable Day status, per the user's own definition. */
  mvd: MvdStatus;
  /** Last night's intention for today, if one was set. */
  plan: TomorrowPlan | null;
  /** Custom-plan override for today's workout (E8-T); seeded plan otherwise. */
  workout?: WorkoutDayPlan;
  onDismiss: () => void;
  onHardDay: () => void;
}) {
  const daily = getDailyPlan(date);

  return (
    <Card className="animate-rise flex flex-col gap-3 border-gold/30 bg-gold/5 p-4">
      <p className="flex items-center gap-2 microlabel text-gold">
        <Sunrise className="size-4" /> Morning plan
      </p>

      {plan?.focus && (
        <p className="flex items-start gap-2 text-sm text-ivory">
          <Target className="mt-0.5 size-4 shrink-0 text-gold" />
          <span>
            <span className="font-semibold">Today's focus:</span> {plan.focus}
          </span>
        </p>
      )}

      <div className="flex flex-col gap-1.5 text-sm text-ivory">
        <p className="flex items-center gap-2">
          <Dumbbell className="size-4 shrink-0 text-muted" />
          {(workout ?? daily.workout).isRest
            ? "Rest day — long walk, light mobility."
            : (workout ?? daily.workout).label}
        </p>
        <p className="flex items-center gap-2">
          <UtensilsCrossed className="size-4 shrink-0 text-muted" />
          {(plan?.intendedMeals.length
            ? plan.intendedMeals
            : daily.meals.meals.map((m) => m.name)
          ).join(" · ")}
        </p>
        {plan?.spendingIntention != null && (
          <p className="flex items-center gap-2">
            <Wallet className="size-4 shrink-0 text-muted" />
            Spending intention: {formatMoney(plan.spendingIntention)}
          </p>
        )}
      </div>

      <p className="text-xs text-muted">
        Minimum Viable Day: {mvd.met ? "already met." : `${mvd.remaining.join(" + ")}.`}{" "}
        {mvd.met ? "" : "That's the floor, everything else is building."}
      </p>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={onDismiss}>
          Let's go
        </Button>
        <Button size="sm" variant="ghost" onClick={onHardDay}>
          Hard day?
        </Button>
      </div>
    </Card>
  );
}
