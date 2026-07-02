"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { QUICK_ADDS } from "@/lib/data/quickAdds";
import { toISODate, uid } from "@/lib/utils";
import type { MealSlot, SavedMeal } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Segmented } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Tab = "custom" | "quick" | "saved";

/**
 * The single meal-logging sheet: custom entry (with save-as-recipe), quick
 * adds, and saved meals — every path logs in a few taps.
 */
export function AddMealSheet({
  open,
  onOpenChange,
  defaultSlot = "addon",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSlot?: MealSlot;
}) {
  const { adapter, touch } = useStorage();
  const [tab, setTab] = useState<Tab>("custom");
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const [saved, setSaved] = useState<SavedMeal[]>([]);

  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [saveRecipe, setSaveRecipe] = useState(false);

  useEffect(() => {
    if (open) {
      setSlot(defaultSlot);
      adapter.listSavedMeals().then(setSaved);
    }
  }, [open, defaultSlot, adapter]);

  const log = async (mealName: string, macros: { calories: number; protein: number; carbs: number; fats: number }) => {
    await adapter.saveMeal({
      id: uid(),
      date: toISODate(),
      slot,
      name: mealName,
      loggedAt: new Date().toISOString(),
      ...macros,
    });
    touch();
    onOpenChange(false);
  };

  const submitCustom = async () => {
    if (!name.trim() || !calories) return;
    const macros = {
      calories: Math.max(0, Math.round(Number(calories) || 0)),
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fats: Math.max(0, Number(fats) || 0),
    };
    if (saveRecipe) {
      await adapter.saveSavedMeal({
        id: uid(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        ...macros,
      });
    }
    await log(name.trim(), macros);
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFats("");
    setSaveRecipe(false);
  };

  const deleteSaved = async (id: string) => {
    await adapter.deleteSavedMeal(id);
    setSaved(await adapter.listSavedMeals());
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Add meal">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meal-slot">Log to</Label>
            <Select id="meal-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              <option value="meal1">Meal 1</option>
              <option value="meal2">Meal 2</option>
              <option value="addon">Add-on</option>
            </Select>
          </div>

          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "custom", label: "Custom" },
              { value: "quick", label: "Quick add" },
              { value: "saved", label: "Saved" },
            ]}
          />

          {tab === "custom" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="meal-name">Name</Label>
                <Input
                  id="meal-name"
                  placeholder="e.g. Chicken rice bowl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meal-cal">Calories</Label>
                  <Input id="meal-cal" type="number" inputMode="numeric" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meal-pro">Protein (g)</Label>
                  <Input id="meal-pro" type="number" inputMode="numeric" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meal-carb">Carbs (g)</Label>
                  <Input id="meal-carb" type="number" inputMode="numeric" min="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meal-fat">Fats (g)</Label>
                  <Input id="meal-fat" type="number" inputMode="numeric" min="0" value={fats} onChange={(e) => setFats(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-1">
                <span className="text-sm text-ivory">Save as recipe</span>
                <Switch checked={saveRecipe} onCheckedChange={setSaveRecipe} aria-label="Save as recipe" />
              </div>
              <Button size="lg" onClick={submitCustom} disabled={!name.trim() || !calories}>
                Log meal
              </Button>
            </div>
          )}

          {tab === "quick" && (
            <div className="flex flex-col gap-2">
              {QUICK_ADDS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => log(q.name, q)}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-(--radius-control) border border-line bg-elevated px-3 py-2 text-left active:border-gold/50 lg:hover:border-gold/50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ivory">{q.name}</span>
                    <span className="block truncate text-xs text-muted">{q.description}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular">
                    {q.calories} kcal · {q.protein}g P
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === "saved" && (
            <div className="flex flex-col gap-2">
              {saved.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">
                  No saved recipes yet. Log a custom meal with “Save as recipe” on.
                </p>
              )}
              {saved.map((m) => (
                <div
                  key={m.id}
                  className="flex min-h-11 items-center gap-2 rounded-(--radius-control) border border-line bg-elevated px-3 py-2"
                >
                  <button type="button" onClick={() => log(m.name, m)} className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold text-ivory">{m.name}</span>
                    <span className="block text-xs text-muted tabular">
                      {m.calories} kcal · {m.protein}g P · {m.carbs}g C · {m.fats}g F
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${m.name}`}
                    onClick={() => deleteSaved(m.id)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:text-danger lg:hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
