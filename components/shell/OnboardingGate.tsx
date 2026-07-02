"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { defaultProfile } from "@/lib/data/defaults";
import type { PainFlags } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckItem } from "@/components/ui/checkbox";

const PAIN_FLAG_LABELS: { key: keyof PainFlags; label: string }[] = [
  { key: "thoracic", label: "Thoracic (mid-back) pain" },
  { key: "rib", label: "Rib pain" },
  { key: "scapular", label: "Scapular pain" },
  { key: "upperTrapDominant", label: "Upper-trap dominant movement" },
  { key: "leftArmAggravation", label: "Left arm aggravation" },
];

/**
 * First-run gate: shows the single-screen profile setup until onboarding is
 * complete, then renders the app. Skippable — "Start with defaults" saves the
 * default profile as-is. Never shown again unless the profile is reset from
 * Settings.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile, profileLoaded, saveProfile } = useStorage();
  const [draft, setDraft] = useState(defaultProfile);
  const [saving, setSaving] = useState(false);

  if (!profileLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base">
        <Flame className="size-8 animate-pulse text-gold" />
      </div>
    );
  }

  if (profile?.onboardingComplete) return <>{children}</>;

  const commit = async (skipped: boolean) => {
    setSaving(true);
    const base = skipped ? defaultProfile() : draft;
    await saveProfile({ ...base, onboardingComplete: true });
    setSaving(false);
  };

  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-5 pt-safe pb-safe">
      <div className="flex flex-col gap-5 py-8">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10">
            <Flame className="size-6 text-gold" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Forge30</h1>
            <p className="text-sm text-muted">30 days. One daily loop. Set your targets.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ob-name">Name</Label>
            <Input
              id="ob-name"
              placeholder="What should the coach call you?"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-start">Start date</Label>
              <Input
                id="ob-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-limit">Daily spend limit ($)</Label>
              <Input
                id="ob-limit"
                type="number"
                inputMode="decimal"
                value={draft.dailySpendingLimit}
                onChange={(e) => setDraft({ ...draft, dailySpendingLimit: num(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-cal">Calories (kcal)</Label>
              <Input
                id="ob-cal"
                type="number"
                inputMode="numeric"
                value={draft.calorieTarget}
                onChange={(e) => setDraft({ ...draft, calorieTarget: num(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-pro">Protein (g)</Label>
              <Input
                id="ob-pro"
                type="number"
                inputMode="numeric"
                value={draft.proteinTarget}
                onChange={(e) => setDraft({ ...draft, proteinTarget: num(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-water">Water (ml)</Label>
              <Input
                id="ob-water"
                type="number"
                inputMode="numeric"
                value={draft.waterTarget}
                onChange={(e) => setDraft({ ...draft, waterTarget: num(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-goal">Weight goal</Label>
              <Input
                id="ob-goal"
                value={draft.weightGoal}
                onChange={(e) => setDraft({ ...draft, weightGoal: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Pain flags — the training engine adapts around these</Label>
            <div className="rounded-(--radius-card) border border-line bg-surface p-2">
              {PAIN_FLAG_LABELS.map(({ key, label }) => (
                <CheckItem
                  key={key}
                  label={label}
                  checked={draft.painFlags[key]}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, painFlags: { ...draft.painFlags, [key]: v } })
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button size="lg" disabled={saving} onClick={() => commit(false)}>
            Start Day 1
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => commit(true)}>
            Skip — use defaults
          </Button>
        </div>
      </div>
    </div>
  );
}
