"use client";

import { useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { getDailyPlan } from "@/lib/engine/plan";
import { workoutForDate } from "@/lib/engine/workoutBuilder";
import { addDays, toISODate } from "@/lib/utils";
import type { CustomWorkoutPlan, TomorrowPlan } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckItem } from "@/components/ui/checkbox";

/**
 * Plan Tomorrow — tonight's 60-second intention: one focus, which of
 * tomorrow's rotation meals you intend, a spending intention. Feeds the next
 * Morning Plan.
 */
export function PlanTomorrowSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { adapter, touch } = useStorage();
  const tomorrow = addDays(toISODate(), 1);
  const plan = getDailyPlan(tomorrow);
  const mealNames = plan.meals.meals.map((m) => m.name);

  const [focus, setFocus] = useState("");
  const [meals, setMeals] = useState<Set<string>>(new Set(mealNames));
  const [spend, setSpend] = useState("");
  const [saved, setSaved] = useState(false);
  const [customPlan, setCustomPlan] = useState<CustomWorkoutPlan | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    void adapter.getCustomWorkoutPlan().then(setCustomPlan);
    adapter.getTomorrowPlan(tomorrow).then((existing) => {
      if (existing) {
        setFocus(existing.focus);
        setMeals(new Set(existing.intendedMeals.length ? existing.intendedMeals : mealNames));
        setSpend(existing.spendingIntention != null ? String(existing.spendingIntention) : "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    const p: TomorrowPlan = {
      date: tomorrow,
      focus: focus.trim(),
      intendedMeals: mealNames.filter((m) => meals.has(m)),
      spendingIntention: spend === "" ? null : Math.max(0, Number(spend) || 0),
      createdAt: new Date().toISOString(),
    };
    await adapter.saveTomorrowPlan(p);
    touch();
    setSaved(true);
    setTimeout(() => onOpenChange(false), 600);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Plan tomorrow">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pt-focus">One focus for tomorrow</Label>
            <Input
              id="pt-focus"
              placeholder="e.g. protein before 2pm"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label>Tomorrow's training</Label>
            <p className="rounded-(--radius-control) bg-elevated px-3 py-2 text-sm text-ivory">
              {workoutForDate(customPlan, tomorrow).isRest
                ? "Rest day — recovery is the plan."
                : workoutForDate(customPlan, tomorrow).label}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Meals you intend ({plan.meals.label} rotation)</Label>
            <div className="rounded-(--radius-card) border border-line bg-surface p-1">
              {mealNames.map((name) => (
                <CheckItem variant="toggle"
                  key={name}
                  label={name}
                  checked={meals.has(name)}
                  onCheckedChange={(v) => {
                    const next = new Set(meals);
                    if (v) next.add(name);
                    else next.delete(name);
                    setMeals(next);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pt-spend">Spending intention ($, optional)</Label>
            <Input
              id="pt-spend"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="e.g. 20"
              value={spend}
              onChange={(e) => setSpend(e.target.value)}
            />
          </div>

          <Button size="lg" onClick={save}>
            {saved ? "Saved — see you in the morning" : "Save tomorrow's plan"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
