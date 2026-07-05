"use client";

import { useState } from "react";
import { Flame, ArrowLeft, Sparkles } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { defaultProfile, DEFAULT_MVD } from "@/lib/data/defaults";
import { estimateTargets } from "@/lib/engine/targets";
import type {
  ActivityLevel,
  DietPreference,
  DomainToggles,
  EquipmentAccess,
  GoalId,
  PainFlags,
  Sex,
  TrainingExperience,
  UserProfile,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CheckItem } from "@/components/ui/checkbox";

export const GOAL_LABELS: Record<GoalId, string> = {
  gainMuscle: "Gain muscle",
  loseFat: "Lose fat",
  recomposition: "Recomposition",
  maintain: "Maintain",
  healthMarkers: "Improve health markers",
  bloodPressure: "Improve blood pressure",
  strength: "Improve strength",
  cardio: "Improve cardio fitness",
  sleep: "Improve sleep",
  stress: "Reduce stress",
  relationship: "Improve relationship",
  dating: "Improve dating life",
  friendships: "Build friendships",
  finances: "Improve finances",
  discipline: "Build discipline",
  skills: "Learn skills",
  generalReset: "General reset",
};

const GOAL_IDS = Object.keys(GOAL_LABELS) as GoalId[];

const PAIN_FLAG_LABELS: { key: keyof PainFlags; label: string }[] = [
  { key: "thoracic", label: "Thoracic (mid-back) pain" },
  { key: "rib", label: "Rib pain" },
  { key: "scapular", label: "Scapular pain" },
  { key: "upperTrapDominant", label: "Upper-trap dominant movement" },
  { key: "leftArmAggravation", label: "Left arm aggravation" },
];

const DOMAIN_LABELS: { key: keyof DomainToggles; label: string; sub?: string }[] = [
  { key: "nutrition", label: "Nutrition" },
  { key: "training", label: "Training" },
  { key: "mind", label: "Mind" },
  { key: "money", label: "Money" },
  { key: "skills", label: "Skills" },
  { key: "health", label: "Health markers", sub: "BP, biomarkers (v2)" },
  { key: "relationships", label: "Relationships", sub: "coming in v2" },
  { key: "social", label: "Social & friends", sub: "coming in v2" },
];

const STEPS = ["You", "Goals", "Targets", "Life & health", "Your app"] as const;

/**
 * First-run gate (E5): a five-step universal profile, skippable at every
 * level — skip a step, or skip the whole thing to sensible de-personalized
 * defaults. Every answer can be changed later in Settings; nothing here is a
 * commitment. Never shown again unless the profile is reset.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile, profileLoaded, saveProfile } = useStorage();
  const [draft, setDraft] = useState(defaultProfile);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  if (!profileLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base">
        <Flame className="size-8 animate-pulse text-gold" />
      </div>
    );
  }

  if (profile?.onboardingComplete) return <>{children}</>;

  const num = (v: string) => Math.max(0, Number(v) || 0);
  const numOrNull = (v: string) => (v === "" ? null : Math.max(0, Number(v) || 0));

  const set = (patch: Partial<UserProfile>) => setDraft({ ...draft, ...patch });

  const commit = async (base: UserProfile) => {
    setSaving(true);
    // Keep the free-text weight goal (drives the expenditure engine's goal
    // rate) in line with the chosen primary goal.
    const weightGoal =
      base.primaryGoal === "gainMuscle"
        ? "Gain muscle (lean-mass focus)"
        : base.primaryGoal === "loseFat"
          ? "Lose fat"
          : base.primaryGoal === "recomposition"
            ? "Recomposition"
            : base.weightGoal;
    await saveProfile({ ...base, weightGoal, onboardingComplete: true });
    setSaving(false);
  };

  const estimate = estimateTargets({
    weightLb: draft.weightLb ?? null,
    heightIn: draft.heightIn ?? null,
    age: draft.age ?? null,
    sex: draft.sex ?? "unspecified",
    activityLevel: draft.activityLevel ?? "moderate",
    primaryGoal: draft.primaryGoal ?? "generalReset",
  });

  const toggleSecondary = (goal: GoalId) => {
    const current = new Set(draft.secondaryGoals ?? []);
    if (current.has(goal)) current.delete(goal);
    else current.add(goal);
    set({ secondaryGoals: [...current] });
  };

  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-5 pt-safe pb-safe">
      <div className="flex flex-col gap-5 py-8">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10">
            <Flame className="size-6 text-gold" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Forge30</h1>
            <p className="text-sm text-muted">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}. Everything is optional.
            </p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-gold" : "bg-elevated"}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-name">Name</Label>
              <Input
                id="ob-name"
                placeholder="What should the coach call you?"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-start">Start date</Label>
                <Input
                  id="ob-start"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => set({ startDate: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-age">Age</Label>
                <Input
                  id="ob-age"
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={draft.age ?? ""}
                  onChange={(e) => set({ age: numOrNull(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-sex">Sex</Label>
                <Select
                  id="ob-sex"
                  value={draft.sex ?? "unspecified"}
                  onChange={(e) => set({ sex: e.target.value as Sex })}
                >
                  <option value="unspecified">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-height">Height (in)</Label>
                <Input
                  id="ob-height"
                  type="number"
                  inputMode="decimal"
                  placeholder="—"
                  value={draft.heightIn ?? ""}
                  onChange={(e) => set({ heightIn: numOrNull(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-weight">Weight (lb)</Label>
                <Input
                  id="ob-weight"
                  type="number"
                  inputMode="decimal"
                  placeholder="—"
                  value={draft.weightLb ?? ""}
                  onChange={(e) => set({ weightLb: numOrNull(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-goalweight">Goal weight (lb)</Label>
                <Input
                  id="ob-goalweight"
                  type="number"
                  inputMode="decimal"
                  placeholder="—"
                  value={draft.goalWeightLb ?? ""}
                  onChange={(e) => set({ goalWeightLb: numOrNull(e.target.value) })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-primary">Primary goal</Label>
              <Select
                id="ob-primary"
                value={draft.primaryGoal ?? "generalReset"}
                onChange={(e) => set({ primaryGoal: e.target.value as GoalId })}
              >
                {GOAL_IDS.map((g) => (
                  <option key={g} value={g}>
                    {GOAL_LABELS[g]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Anything else you’re working on? (tap any)</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {GOAL_IDS.filter((g) => g !== draft.primaryGoal).map((g) => {
                  const on = (draft.secondaryGoals ?? []).includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSecondary(g)}
                      className={`min-h-11 rounded-(--radius-control) border px-3 py-2 text-left text-sm font-medium ${
                        on
                          ? "border-gold/60 bg-gold/10 text-ivory"
                          : "border-line bg-surface text-muted"
                      }`}
                    >
                      {GOAL_LABELS[g]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-activity">Activity level</Label>
                <Select
                  id="ob-activity"
                  value={draft.activityLevel ?? "moderate"}
                  onChange={(e) => set({ activityLevel: e.target.value as ActivityLevel })}
                >
                  <option value="sedentary">Sedentary</option>
                  <option value="light">Lightly active</option>
                  <option value="moderate">Moderately active</option>
                  <option value="active">Active</option>
                  <option value="veryActive">Very active</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-exp">Training experience</Label>
                <Select
                  id="ob-exp"
                  value={draft.trainingExperience ?? "beginner"}
                  onChange={(e) =>
                    set({ trainingExperience: e.target.value as TrainingExperience })
                  }
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-equip">Equipment</Label>
                <Select
                  id="ob-equip"
                  value={draft.equipment ?? "minimal"}
                  onChange={(e) => set({ equipment: e.target.value as EquipmentAccess })}
                >
                  <option value="none">None / bodyweight</option>
                  <option value="minimal">Minimal (bands, dumbbells)</option>
                  <option value="homeGym">Home gym</option>
                  <option value="fullGym">Full gym</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-diet">Diet preference</Label>
                <Select
                  id="ob-diet"
                  value={draft.dietPreference ?? "omnivore"}
                  onChange={(e) => set({ dietPreference: e.target.value as DietPreference })}
                >
                  <option value="omnivore">Omnivore</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="pescatarian">Pescatarian</option>
                  <option value="other">Other</option>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-restrict">Dietary restrictions (optional)</Label>
              <Input
                id="ob-restrict"
                placeholder="allergies, dislikes, religious restrictions…"
                value={draft.dietaryRestrictions ?? ""}
                onChange={(e) => set({ dietaryRestrictions: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() =>
                set({ calorieTarget: estimate.calorieTarget, proteinTarget: estimate.proteinTarget })
              }
              className="flex items-start gap-3 rounded-(--radius-card) border border-gold/30 bg-gold/5 p-3 text-left"
            >
              <Sparkles className="mt-0.5 size-5 shrink-0 text-gold" />
              <span className="text-sm text-ivory">
                {estimate.basis === "default"
                  ? "Add your stats on step 1 for a personal estimate — or set targets yourself below."
                  : `Suggested from your stats and goal: ${estimate.calorieTarget.toLocaleString()} kcal · ${estimate.proteinTarget}g protein. `}
                {estimate.basis !== "default" && (
                  <span className="font-semibold text-gold">Tap to apply.</span>
                )}
              </span>
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-cal">Calories (kcal)</Label>
                <Input
                  id="ob-cal"
                  type="number"
                  inputMode="numeric"
                  value={draft.calorieTarget}
                  onChange={(e) => set({ calorieTarget: num(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-pro">Protein (g)</Label>
                <Input
                  id="ob-pro"
                  type="number"
                  inputMode="numeric"
                  value={draft.proteinTarget}
                  onChange={(e) => set({ proteinTarget: num(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-water">Water (ml)</Label>
                <Input
                  id="ob-water"
                  type="number"
                  inputMode="numeric"
                  value={draft.waterTarget}
                  onChange={(e) => set({ waterTarget: num(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-sleep">Sleep target (h)</Label>
                <Input
                  id="ob-sleep"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={draft.sleepTargetHours ?? 7.5}
                  onChange={(e) => set({ sleepTargetHours: num(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-limit">Daily spend limit ($)</Label>
                <Input
                  id="ob-limit"
                  type="number"
                  inputMode="decimal"
                  value={draft.dailySpendingLimit}
                  onChange={(e) => set({ dailySpendingLimit: num(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-budget">Budget goal</Label>
                <Input
                  id="ob-budget"
                  placeholder="e.g. save $500 this month"
                  value={draft.budgetGoal ?? ""}
                  onChange={(e) => set({ budgetGoal: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-rel">Relationship status</Label>
                <Select
                  id="ob-rel"
                  value={draft.relationshipStatus ?? ""}
                  onChange={(e) => set({ relationshipStatus: e.target.value })}
                >
                  <option value="">Prefer not to say</option>
                  <option value="single">Single</option>
                  <option value="dating">Dating</option>
                  <option value="partnered">Partnered</option>
                  <option value="married">Married</option>
                  <option value="complicated">It’s complicated</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-social">Social goals</Label>
                <Input
                  id="ob-social"
                  placeholder="e.g. see friends weekly"
                  value={draft.socialGoals ?? ""}
                  onChange={(e) => set({ socialGoals: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-health">Health concerns (optional)</Label>
              <Input
                id="ob-health"
                placeholder="anything you're tracking with a professional"
                value={draft.healthConcerns ?? ""}
                onChange={(e) => set({ healthConcerns: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-meds">Medications / supplements (optional)</Label>
              <Input
                id="ob-meds"
                placeholder="context for the coach — never medical advice"
                value={draft.medications ?? ""}
                onChange={(e) => set({ medications: e.target.value })}
              />
            </div>
            <div className="rounded-(--radius-card) border border-line bg-surface p-2">
              <CheckItem variant="toggle"
                label="Track blood pressure"
                checked={draft.trackBloodPressure ?? false}
                onCheckedChange={(v) => set({ trackBloodPressure: v })}
              />
              <CheckItem variant="toggle"
                label="Track fitness markers"
                sublabel="grip, push-ups, plank, mile time…"
                checked={draft.trackFitnessMarkers ?? false}
                onCheckedChange={(v) => set({ trackFitnessMarkers: v })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Any current pain areas? The training engine adapts around these</Label>
              <div className="rounded-(--radius-card) border border-line bg-surface p-2">
                {PAIN_FLAG_LABELS.map(({ key, label }) => (
                  <CheckItem variant="toggle"
                    key={key}
                    label={label}
                    checked={draft.painFlags[key]}
                    onCheckedChange={(v) =>
                      set({ painFlags: { ...draft.painFlags, [key]: v } })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label>What should Forge30 track? Off-domains hand their score weight to the rest</Label>
              <div className="rounded-(--radius-card) border border-line bg-surface p-2">
                {DOMAIN_LABELS.map(({ key, label, sub }) => (
                  <CheckItem variant="toggle"
                    key={key}
                    label={label}
                    sublabel={sub}
                    checked={(draft.domains ?? { [key]: true })[key] ?? true}
                    onCheckedChange={(v) =>
                      set({ domains: { ...(draft.domains ?? defaultProfile().domains!), [key]: v } })
                    }
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Your Minimum Viable Day — the floor that keeps a streak alive</Label>
              <div className="rounded-(--radius-card) border border-line bg-surface p-2">
                <CheckItem variant="toggle"
                  label="Log one meal"
                  checked={(draft.mvd ?? DEFAULT_MVD).meal}
                  onCheckedChange={(v) => set({ mvd: { ...(draft.mvd ?? DEFAULT_MVD), meal: v } })}
                />
                <CheckItem variant="toggle"
                  label="2-minute check-in"
                  checked={(draft.mvd ?? DEFAULT_MVD).checkIn}
                  onCheckedChange={(v) =>
                    set({ mvd: { ...(draft.mvd ?? DEFAULT_MVD), checkIn: v } })
                  }
                />
                <CheckItem variant="toggle"
                  label="Log some water"
                  checked={(draft.mvd ?? DEFAULT_MVD).water}
                  onCheckedChange={(v) => set({ mvd: { ...(draft.mvd ?? DEFAULT_MVD), water: v } })}
                />
                <CheckItem variant="toggle"
                  label="Move a little"
                  sublabel="any workout, rest day, or a walk"
                  checked={(draft.mvd ?? DEFAULT_MVD).movement}
                  onCheckedChange={(v) =>
                    set({ mvd: { ...(draft.mvd ?? DEFAULT_MVD), movement: v } })
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Reminders (used once notifications land)</Label>
              <div className="rounded-(--radius-card) border border-line bg-surface p-2">
                <CheckItem variant="toggle"
                  label="Morning plan"
                  checked={draft.notifications?.morningPlan ?? true}
                  onCheckedChange={(v) =>
                    set({
                      notifications: {
                        ...(draft.notifications ?? defaultProfile().notifications!),
                        morningPlan: v,
                      },
                    })
                  }
                />
                <CheckItem variant="toggle"
                  label="Evening review"
                  checked={draft.notifications?.eveningReview ?? true}
                  onCheckedChange={(v) =>
                    set({
                      notifications: {
                        ...(draft.notifications ?? defaultProfile().notifications!),
                        eveningReview: v,
                      },
                    })
                  }
                />
                <CheckItem variant="toggle"
                  label="Streak reminder"
                  checked={draft.notifications?.streakReminder ?? false}
                  onCheckedChange={(v) =>
                    set({
                      notifications: {
                        ...(draft.notifications ?? defaultProfile().notifications!),
                        streakReminder: v,
                      },
                    })
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-boundary">Day wraps up at (hour, 0–23)</Label>
              <Input
                id="ob-boundary"
                type="number"
                inputMode="numeric"
                min="0"
                max="23"
                placeholder="20"
                value={draft.dayBoundaryHour ?? ""}
                onChange={(e) =>
                  set({
                    dayBoundaryHour:
                      e.target.value === ""
                        ? undefined
                        : Math.min(23, Math.max(0, Math.round(Number(e.target.value) || 0))),
                  })
                }
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="secondary"
                size="lg"
                disabled={saving}
                onClick={() => setStep(step - 1)}
                aria-label="Back"
              >
                <ArrowLeft className="size-5" />
              </Button>
            )}
            <Button
              size="lg"
              className="flex-1"
              disabled={saving}
              onClick={() => (last ? commit(draft) : setStep(step + 1))}
            >
              {last ? "Start Day 1" : "Next"}
            </Button>
          </div>
          {!last && (
            <Button variant="ghost" disabled={saving} onClick={() => setStep(step + 1)}>
              Skip this step
            </Button>
          )}
          {step === 0 && (
            <Button variant="ghost" disabled={saving} onClick={() => commit(defaultProfile())}>
              Skip everything — use defaults
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
