"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Droplets,
  Trash2,
  CalendarDays,
  ShoppingCart,
  Camera,
  Mic,
  TrendingUp,
} from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { useDay } from "@/lib/hooks/useDay";
import { toISODate, addDays, uid, cn } from "@/lib/utils";
import { getMealPlanForDate, MEAL_PLAN, PREP_CHECKLIST, generateGroceryList } from "@/lib/data/mealPlan";
import { QUICK_ADDS } from "@/lib/data/quickAdds";
import { calculateMacroTotals, getNutritionRecommendation } from "@/lib/engine/nutritionRules";
import { calculateWeightTrend } from "@/lib/engine/trends";
import type { MealEntry, MealSlot, PlannedMeal } from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { MacroRings } from "@/components/cards/MacroRings";
import { AddMealSheet } from "@/components/forms/AddMealSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckItem } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

const SLOT_LABEL: Record<MealSlot, string> = {
  meal1: "Meal 1",
  meal2: "Meal 2",
  addon: "Add-ons",
};

export default function NutritionPage() {
  const { adapter, profile, revision, touch } = useStorage();
  const today = toISODate();
  const { snapshot, updateLog } = useDay(today);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [weightTrend7d, setWeightTrend7d] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSlot, setSheetSlot] = useState<MealSlot>("addon");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adapter.listMeals(today),
      adapter.listBodyMetrics(addDays(today, -6), today),
    ]).then(([m, metrics]) => {
      if (cancelled) return;
      setMeals(m.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)));
      setWeightTrend7d(calculateWeightTrend(metrics));
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, today, revision]);

  // Deep link: /nutrition?add=1 opens the add-meal sheet.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("add")) {
      setSheetOpen(true);
      window.history.replaceState(null, "", "/nutrition");
    }
  }, []);

  const plan = getMealPlanForDate(today);
  const totals = useMemo(() => calculateMacroTotals(meals), [meals]);
  const log = snapshot?.log;

  const recommendation = profile
    ? getNutritionRecommendation({
        totals,
        waterMl: log?.waterMl ?? 0,
        calorieTarget: profile.calorieTarget,
        proteinTarget: profile.proteinTarget,
        waterTarget: profile.waterTarget,
        weightTrend7d,
      })
    : null;

  const openSheet = (slot: MealSlot) => {
    setSheetSlot(slot);
    setSheetOpen(true);
  };

  const logPlanned = async (planned: PlannedMeal) => {
    await adapter.saveMeal({
      id: uid(),
      date: today,
      slot: planned.slot,
      name: planned.name,
      calories: planned.calories,
      protein: planned.protein,
      carbs: planned.carbs,
      fats: planned.fats,
      loggedAt: new Date().toISOString(),
    });
    touch();
  };

  const removeMeal = async (id: string) => {
    await adapter.deleteMeal(id);
    touch();
  };

  const addWater = async (ml: number) => {
    if (!log) return;
    await updateLog({ waterMl: Math.max(0, log.waterMl + ml) });
  };

  const togglePrep = async (id: string, checked: boolean) => {
    if (!log) return;
    const current = new Set(log.prepChecklist ?? []);
    if (checked) current.add(id);
    else current.delete(id);
    await updateLog({ prepChecklist: [...current] });
  };

  if (!profile || !log) return null;

  const prepChecked = new Set(log.prepChecklist ?? []);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Nutrition"
        subtitle={`${plan.label} rotation`}
        action={
          <Button size="sm" onClick={() => openSheet("addon")}>
            <Plus className="size-4" /> Add meal
          </Button>
        }
      />

      {/* Helpful suggestion, not a problem — gold, never warning-orange
          (warning stays reserved for genuine safety signals). */}
      {recommendation?.addCaloriesBanner && (
        <Card className="flex items-center gap-3 border-gold/30 bg-gold/5 p-3">
          <TrendingUp className="size-5 shrink-0 text-gold" />
          <p className="text-sm text-ivory">
            Your 7-day weight trend is flat. <strong>Add 250 calories per day</strong> — the rice +
            olive oil booster is the easiest way in.
          </p>
        </Card>
      )}

      <MacroRings
        totals={totals}
        calorieTarget={profile.calorieTarget}
        proteinTarget={profile.proteinTarget}
      />

      {/* Water tracker */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Water</CardTitle>
          <span className="tabular text-sm font-semibold text-ivory">
            {(log.waterMl / 1000).toFixed(2)}L / {(profile.waterTarget / 1000).toFixed(1)}L
          </span>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Progress value={log.waterMl} max={profile.waterTarget} className="flex-1" />
          <Button variant="secondary" size="sm" onClick={() => addWater(-250)} aria-label="Remove 250ml">
            −250
          </Button>
          <Button size="sm" onClick={() => addWater(250)} aria-label="Add 250ml">
            <Droplets className="size-4" /> +250ml
          </Button>
        </CardContent>
      </Card>

      {/* Still need today */}
      {recommendation && (
        <Card className="border-gold/25">
          <CardHeader>
            <CardTitle>Still need today</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex gap-4">
              <div>
                <p className="display-num text-xl text-gold">
                  {recommendation.stillNeed.calories.toLocaleString()}
                </p>
                <p className="text-xs text-muted">kcal</p>
              </div>
              <div>
                <p className="display-num text-xl text-gold">
                  {Math.round(recommendation.stillNeed.protein)}g
                </p>
                <p className="text-xs text-muted">protein</p>
              </div>
              <div>
                <p className="display-num text-xl text-gold">
                  {(recommendation.stillNeed.waterMl / 1000).toFixed(1)}L
                </p>
                <p className="text-xs text-muted">water</p>
              </div>
            </div>
            <ul className="mt-1 flex flex-col gap-1.5">
              {recommendation.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-ivory">
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Meal slots */}
      {(["meal1", "meal2", "addon"] as MealSlot[]).map((slot) => {
        const planned = plan.meals.find((m) => m.slot === slot);
        const logged = meals.filter((m) => m.slot === slot);
        const subtotal = calculateMacroTotals(logged);
        const plannedAlreadyLogged = planned && logged.some((m) => m.name === planned.name);
        return (
          <Card key={slot}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{SLOT_LABEL[slot]}</CardTitle>
              {logged.length > 0 && (
                <span className="tabular text-xs font-semibold text-muted">
                  {subtotal.calories} kcal · {Math.round(subtotal.protein)}g P
                </span>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {planned && !plannedAlreadyLogged && (
                <div className="flex items-center justify-between gap-3 rounded-(--radius-control) border border-dashed border-gold/40 bg-gold/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ivory">{planned.name}</p>
                    <p className="truncate text-xs text-muted">
                      {planned.ingredients.join(", ")} · {planned.calories} kcal · {planned.protein}g
                      P
                    </p>
                  </div>
                  <Button size="sm" onClick={() => logPlanned(planned)}>
                    Log it
                  </Button>
                </div>
              )}
              {logged.map((m) => (
                <div
                  key={m.id}
                  className="flex min-h-11 items-center gap-2 rounded-(--radius-control) bg-elevated px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ivory">{m.name}</p>
                    <p className="text-xs text-muted tabular">
                      {m.calories} kcal · {Math.round(m.protein)}g P · {Math.round(m.carbs)}g C ·{" "}
                      {Math.round(m.fats)}g F
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${m.name}`}
                    onClick={() => removeMeal(m.id)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:text-danger lg:hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {logged.length === 0 && !planned && (
                <p className="py-1 text-sm text-muted">Nothing logged yet.</p>
              )}
              <Button variant="ghost" size="sm" className="self-start" onClick={() => openSheet(slot)}>
                <Plus className="size-4" /> Add to {SLOT_LABEL[slot]}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* Quick adds */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Quick adds</p>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2">
            {QUICK_ADDS.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={async () => {
                  await adapter.saveMeal({
                    id: uid(),
                    date: today,
                    slot: "addon",
                    name: q.name,
                    calories: q.calories,
                    protein: q.protein,
                    carbs: q.carbs,
                    fats: q.fats,
                    loggedAt: new Date().toISOString(),
                  });
                  touch();
                }}
                className="flex min-h-11 flex-col justify-center rounded-(--radius-control) border border-line bg-surface px-3 py-2 text-left active:border-gold/50 lg:hover:border-gold/50"
              >
                <span className="text-sm font-semibold text-ivory">{q.name}</span>
                <span className="text-xs text-muted tabular">
                  {q.calories} kcal · {q.protein}g P
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Meal prep checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Meal prep checklist</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {PREP_CHECKLIST.map((item) => (
            <CheckItem
              key={item.id}
              label={item.label}
              sublabel={item.sublabel || undefined}
              checked={prepChecked.has(item.id)}
              onCheckedChange={(v) => togglePrep(item.id, v)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Weekly rotation + grocery list */}
      <div className="grid grid-cols-2 gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="w-full">
              <CalendarDays className="size-4 text-gold" /> Weekly plan
            </Button>
          </SheetTrigger>
          <SheetContent title="Weekly meal rotation">
            <div className="flex flex-col gap-4">
              {MEAL_PLAN.map((day) => (
                <div key={day.weekday}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold">
                    {day.label}
                  </p>
                  {day.meals.map((m) => (
                    <div key={m.slot} className="mb-1.5 rounded-(--radius-control) bg-elevated px-3 py-2">
                      <p className="text-sm font-semibold text-ivory">
                        {m.slot === "meal1" ? "M1" : "M2"} — {m.name}
                      </p>
                      <p className="text-xs text-muted">
                        {m.ingredients.join(", ")} · {m.calories} kcal · {m.protein}g P
                      </p>
                    </div>
                  ))}
                </div>
              ))}
              <p className="text-xs text-muted">
                This 7-day rotation repeats ×4 weeks. With the whey-shake add-on, each day lands
                near your {profile.calorieTarget.toLocaleString()} kcal / {profile.proteinTarget}g
                protein targets.
              </p>
            </div>
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="w-full">
              <ShoppingCart className="size-4 text-gold" /> Grocery list
            </Button>
          </SheetTrigger>
          <SheetContent title="Grocery list — this week's rotation">
            <ul className="flex flex-col">
              {generateGroceryList().map(({ item, usedIn }) => (
                <li
                  key={item}
                  className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <span className="text-sm font-medium text-ivory capitalize">{item}</span>
                  <span className="text-right text-xs text-muted">
                    {usedIn.length} meal{usedIn.length > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
      </div>

      {/* Coming soon */}
      <div className={cn("grid grid-cols-2 gap-3")}>
        <Button variant="outline" disabled className="w-full">
          <Camera className="size-4" /> Photo log
          <Badge className="ml-1">soon</Badge>
        </Button>
        <Button variant="outline" disabled className="w-full">
          <Mic className="size-4" /> Voice log
          <Badge className="ml-1">soon</Badge>
        </Button>
      </div>

      <AddMealSheet open={sheetOpen} onOpenChange={setSheetOpen} defaultSlot={sheetSlot} />
    </div>
  );
}
