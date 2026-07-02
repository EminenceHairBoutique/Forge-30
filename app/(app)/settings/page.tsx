"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import type { PainFlags, UserProfile } from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function SettingsPage() {
  const { adapter, profile, saveProfile, touch } = useStorage();
  const router = useRouter();
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (profile && !draft) setDraft(profile);
  }, [profile, draft]);

  if (!draft) return null;

  const num = (v: string) => Math.max(0, Number(v) || 0);

  const save = async () => {
    await saveProfile(draft);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const resetAll = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await adapter.resetAll();
    touch();
    router.push("/today");
    // The onboarding gate takes over once the profile is gone.
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader title="Settings" subtitle="Targets, pain flags, and data." />

      <Card>
        <CardHeader>
          <CardTitle>Profile & targets</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="st-name">Name</Label>
            <Input id="st-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-start">Start date</Label>
              <Input
                id="st-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-limit">Daily spend limit ($)</Label>
              <Input
                id="st-limit"
                type="number"
                inputMode="decimal"
                value={draft.dailySpendingLimit}
                onChange={(e) => setDraft({ ...draft, dailySpendingLimit: num(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-cal">Calorie target</Label>
              <Input
                id="st-cal"
                type="number"
                inputMode="numeric"
                value={draft.calorieTarget}
                onChange={(e) => setDraft({ ...draft, calorieTarget: num(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-pro">Protein target (g)</Label>
              <Input
                id="st-pro"
                type="number"
                inputMode="numeric"
                value={draft.proteinTarget}
                onChange={(e) => setDraft({ ...draft, proteinTarget: num(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-water">Water target (ml)</Label>
              <Input
                id="st-water"
                type="number"
                inputMode="numeric"
                value={draft.waterTarget}
                onChange={(e) => setDraft({ ...draft, waterTarget: num(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-goal">Weight goal</Label>
              <Input
                id="st-goal"
                value={draft.weightGoal}
                onChange={(e) => setDraft({ ...draft, weightGoal: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pain flags — the training engine adapts around these</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
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
        </CardContent>
      </Card>

      <Button size="lg" onClick={save}>
        <Save className="size-5" /> Save settings
      </Button>
      {savedAt && <p className="text-center text-xs text-muted">Saved {savedAt}</p>}

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            Wipes the profile and every log on this device, then re-runs onboarding. This cannot
            be undone.
          </p>
          <Button variant="destructive" onClick={resetAll}>
            <Trash2 className="size-4" />
            {confirmReset ? "Tap again to confirm full reset" : "Reset profile & all data"}
          </Button>
        </CardContent>
      </Card>

      <p className="px-2 pb-2 text-center text-xs leading-relaxed text-muted">
        Forge30 is for self-reflection and habit support. It is not therapy, diagnosis, crisis
        support, medical care, legal advice, or financial advice.
      </p>
    </div>
  );
}
