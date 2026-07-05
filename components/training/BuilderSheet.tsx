"use client";

import { useState } from "react";
import { Hammer, RotateCcw } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { buildWorkoutWeek, type BuilderInputs, type BuiltWeek } from "@/lib/engine/workoutBuilder";
import { injuriesFromPainFlags } from "@/lib/engine/trainingRules";
import { GOAL_LABELS } from "@/components/shell/OnboardingGate";
import { uid } from "@/lib/utils";
import type { CustomWorkoutPlan, EquipmentAccess, GoalId, TrainingExperience } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/**
 * Workout builder (E8-T): goal, days/week, session length, equipment,
 * experience — injuries come along automatically from the profile (structured
 * entries plus the derived pain flags). Preview the generated week, then save
 * it as the active plan or return to the seeded rotation.
 */
export function BuilderSheet({
  open,
  onOpenChange,
  hasCustomPlan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasCustomPlan: boolean;
}) {
  const { adapter, profile, touch } = useStorage();
  const [goal, setGoal] = useState<GoalId>(profile?.primaryGoal ?? "gainMuscle");
  const [days, setDays] = useState<BuilderInputs["daysPerWeek"]>(4);
  const [minutes, setMinutes] = useState<BuilderInputs["sessionMinutes"]>(60);
  const [equipment, setEquipment] = useState<EquipmentAccess>(profile?.equipment ?? "fullGym");
  const [experience, setExperience] = useState<TrainingExperience>(
    profile?.trainingExperience ?? "intermediate"
  );
  const [preview, setPreview] = useState<BuiltWeek | null>(null);

  const injuries = [
    ...(profile?.injuries ?? []),
    ...(profile ? injuriesFromPainFlags(profile.painFlags) : []),
  ];

  const generate = () => {
    setPreview(
      buildWorkoutWeek({
        goal,
        daysPerWeek: days,
        sessionMinutes: minutes,
        equipment,
        experience,
        injuries,
        dislikedIds: [],
        likedIds: [],
      })
    );
  };

  const save = async () => {
    if (!preview) return;
    const plan: CustomWorkoutPlan = {
      id: uid(),
      name: `${GOAL_LABELS[goal]} · ${days} days`,
      days: preview.days,
      createdAt: new Date().toISOString(),
    };
    await adapter.saveCustomWorkoutPlan(plan);
    touch();
    onOpenChange(false);
  };

  const clear = async () => {
    await adapter.saveCustomWorkoutPlan(null);
    touch();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Build your plan">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wb-goal">Goal</Label>
              <Select id="wb-goal" value={goal} onChange={(e) => setGoal(e.target.value as GoalId)}>
                {(["gainMuscle", "loseFat", "recomposition", "maintain", "strength", "cardio", "generalReset"] as GoalId[]).map(
                  (g) => (
                    <option key={g} value={g}>
                      {GOAL_LABELS[g]}
                    </option>
                  )
                )}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wb-days">Days / week</Label>
              <Select
                id="wb-days"
                value={days}
                onChange={(e) => setDays(Number(e.target.value) as BuilderInputs["daysPerWeek"])}
              >
                {[2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wb-min">Session length</Label>
              <Select
                id="wb-min"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) as BuilderInputs["sessionMinutes"])}
              >
                {[30, 45, 60, 75].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wb-equip">Equipment</Label>
              <Select
                id="wb-equip"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value as EquipmentAccess)}
              >
                <option value="none">None / bodyweight</option>
                <option value="minimal">Minimal (bands, DBs)</option>
                <option value="homeGym">Home gym</option>
                <option value="fullGym">Full gym</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wb-exp">Experience</Label>
              <Select
                id="wb-exp"
                value={experience}
                onChange={(e) => setExperience(e.target.value as TrainingExperience)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </div>
          </div>

          {injuries.length > 0 && (
            <p className="text-xs text-muted">
              Programming around {injuries.length} logged injur{injuries.length === 1 ? "y" : "ies"}{" "}
              automatically — anything that matches what aggravates them is swapped out.
            </p>
          )}

          <Button size="lg" onClick={generate}>
            <Hammer className="size-5" /> {preview ? "Regenerate" : "Generate my week"}
          </Button>

          {preview && (
            <>
              <div className="flex flex-col gap-2">
                {preview.notes.map((n) => (
                  <p key={n} className="rounded-(--radius-control) bg-elevated px-3 py-2 text-xs text-muted">
                    {n}
                  </p>
                ))}
                {preview.days.map((day) => (
                  <div key={day.weekday} className="rounded-(--radius-control) bg-elevated px-3 py-2">
                    <p className="microlabel text-gold">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day.weekday]} — {day.label}
                    </p>
                    {!day.isRest && (
                      <p className="mt-0.5 text-sm text-ivory">
                        {day.exercises.map((e) => e.name).join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Button size="lg" onClick={save}>
                Use this as my plan
              </Button>
            </>
          )}

          {hasCustomPlan && (
            <Button variant="ghost" onClick={clear}>
              <RotateCcw className="size-4" /> Back to the built-in rotation
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
