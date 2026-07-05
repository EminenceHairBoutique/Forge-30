"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Save, Trash2, Upload } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { toISODate } from "@/lib/utils";
import { validateExport, type ExportFile } from "@/lib/storage/migrations";
import { flagEnabled } from "@/lib/flags";
import { TIERS, isTier } from "@/lib/engine/entitlements";
import { useTier } from "@/lib/hooks/useTier";
import {
  DEFAULT_WEIGHTS,
  renormalizeWeights,
  type ScoreComponentKey,
} from "@/lib/engine/forgeScore";
import { Select } from "@/components/ui/select";
import { DEFAULT_DOMAINS, DEFAULT_MVD, DEFAULT_NOTIFICATIONS } from "@/lib/data/defaults";
import { notificationPermission } from "@/lib/push/client";
import { flagEnabled as flagOn } from "@/lib/flags";
import type {
  DomainToggles,
  ForgeScoreWeights,
  MvdDefinition,
  NotificationPrefs,
  PainFlags,
  UserProfile,
} from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupCard } from "@/components/settings/BackupCard";
import { PushCard } from "@/components/settings/PushCard";
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

const MVD_LABELS: { key: keyof MvdDefinition; label: string; sub?: string }[] = [
  { key: "meal", label: "Log one meal" },
  { key: "checkIn", label: "2-minute check-in" },
  { key: "water", label: "Log some water" },
  { key: "movement", label: "Move a little", sub: "any workout, rest day, or a walk" },
];

type BooleanPrefKey = "morningPlan" | "eveningReview" | "streakReminder" | "weeklyReport";
const NOTIFICATION_LABELS: { key: BooleanPrefKey; label: string; sub: string }[] = [
  { key: "morningPlan", label: "Morning plan", sub: "one nudge before noon until you've seen it" },
  { key: "eveningReview", label: "Evening review", sub: "when the day wraps and no review exists" },
  { key: "streakReminder", label: "Streak protection", sub: "evening heads-up when today's still open" },
  { key: "weeklyReport", label: "Weekly report", sub: "Sunday evening summary" },
];

const WEIGHT_FIELDS: { key: ScoreComponentKey; label: string }[] = [
  { key: "calories", label: "Calories" },
  { key: "protein", label: "Protein" },
  { key: "water", label: "Hydration" },
  { key: "workout", label: "Training / movement" },
  { key: "mobility", label: "Mobility / prehab" },
  { key: "sleep", label: "Sleep / recovery" },
  { key: "spending", label: "Spending check" },
  { key: "mind", label: "Mental reset" },
  { key: "skill", label: "Skill progress" },
];

export default function SettingsPage() {
  const { adapter, profile, saveProfile, touch } = useStorage();
  const { tier } = useTier();
  const router = useRouter();
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ file: ExportFile; name: string } | null>(null);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [permission, setPermission] = useState<string>("default");

  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  useEffect(() => {
    if (profile && !draft) setDraft(profile);
  }, [profile, draft]);

  if (!draft) return null;

  const num = (v: string) => Math.max(0, Number(v) || 0);

  const save = async () => {
    await saveProfile(draft);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const exportData = async () => {
    const file = await adapter.exportAll();
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge30-export-${toISODate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDataMessage("Export downloaded. Keep it somewhere safe.");
  };

  const pickImportFile = async (picked: File | null) => {
    setDataMessage(null);
    setPendingImport(null);
    if (!picked) return;
    try {
      const file = validateExport(JSON.parse(await picked.text()));
      setPendingImport({ file, name: picked.name });
    } catch (err) {
      setDataMessage(err instanceof Error ? err.message : "That file couldn't be read.");
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    await adapter.importAll(pendingImport.file);
    // Reload so every page re-reads the imported data from a clean slate.
    window.location.reload();
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

      <BackupCard />

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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-boundary">Day wraps up at (hour, 0–23)</Label>
              <Input
                id="st-boundary"
                type="number"
                inputMode="numeric"
                min="0"
                max="23"
                placeholder="20"
                value={draft.dayBoundaryHour ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    dayBoundaryHour:
                      e.target.value === "" ? undefined : Math.min(23, Math.max(0, Math.round(Number(e.target.value) || 0))),
                  })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Before that hour, Today shows your score as still building; after it, the day gets
            its review. Default 20 (8&nbsp;PM).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meal plan templates</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            Optional: a seeded 7-day rotation with a grocery list. Off by default — photo,
            search, and quick logging are the main path.
          </p>
          <Select
            aria-label="Meal plan template"
            value={draft.mealPlanTemplate ?? "none"}
            onChange={(e) =>
              setDraft({ ...draft, mealPlanTemplate: e.target.value as "none" | "forge30" })
            }
          >
            <option value="none">None — log freely</option>
            <option value="forge30">Forge30 7-day rotation</option>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pain flags — the training engine adapts around these</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {PAIN_FLAG_LABELS.map(({ key, label }) => (
            <CheckItem variant="toggle"
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

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {permission === "unsupported" ? (
            <p className="text-sm text-muted">
              This browser doesn&apos;t support notifications. Everything still works — the
              reminders just stay in-app.
            </p>
          ) : permission !== "granted" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                Reminders are optional and quiet: a morning plan, the evening review, streak
                protection, and the Sunday report. No shame copy, ever.
              </p>
              <Button
                variant="secondary"
                disabled={permission === "denied"}
                onClick={async () => {
                  const result = await Notification.requestPermission();
                  setPermission(result);
                }}
              >
                {permission === "denied"
                  ? "Blocked in browser settings"
                  : "Enable notifications"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-success">Notifications are on for this device.</p>
          )}
          <div className="rounded-(--radius-card) border border-line bg-surface p-1">
            {NOTIFICATION_LABELS.map(({ key, label, sub }) => (
              <CheckItem
                variant="toggle"
                key={key}
                label={label}
                sublabel={sub}
                checked={(draft.notifications ?? DEFAULT_NOTIFICATIONS)[key] ?? true}
                onCheckedChange={(v) =>
                  setDraft({
                    ...draft,
                    notifications: {
                      ...DEFAULT_NOTIFICATIONS,
                      ...(draft.notifications ?? {}),
                      [key]: v,
                    },
                  })
                }
              />
            ))}
          </div>
          {/* Quiet hours (v3 Phase 2): both in-app timing docs and the server
              push respect these; default 21:30–08:00. */}
          <div className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="quiet-start">Quiet from</Label>
              <Input
                id="quiet-start"
                type="time"
                value={draft.notifications?.quietStart ?? "21:30"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    notifications: {
                      ...DEFAULT_NOTIFICATIONS,
                      ...(draft.notifications ?? {}),
                      quietStart: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="quiet-end">Until</Label>
              <Input
                id="quiet-end"
                type="time"
                value={draft.notifications?.quietEnd ?? "08:00"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    notifications: {
                      ...DEFAULT_NOTIFICATIONS,
                      ...(draft.notifications ?? {}),
                      quietEnd: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
          <PushCard />
          <p className="text-xs text-muted">
            In-app reminders fire while Forge30 is open; background push (when enabled above)
            covers closed-app delivery with the same quiet rules.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domains & Minimum Viable Day</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Tracked domains — off-domains hand their score weight to the rest</Label>
            <div className="rounded-(--radius-card) border border-line bg-surface p-1">
              {DOMAIN_LABELS.map(({ key, label, sub }) => (
                <CheckItem variant="toggle"
                  key={key}
                  label={label}
                  sublabel={sub}
                  checked={(draft.domains ?? DEFAULT_DOMAINS)[key]}
                  onCheckedChange={(v) =>
                    setDraft({
                      ...draft,
                      domains: { ...(draft.domains ?? DEFAULT_DOMAINS), [key]: v },
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Minimum Viable Day — the floor that keeps a streak alive</Label>
            <div className="rounded-(--radius-card) border border-line bg-surface p-1">
              {MVD_LABELS.map(({ key, label, sub }) => (
                <CheckItem variant="toggle"
                  key={key}
                  label={label}
                  sublabel={sub}
                  checked={(draft.mvd ?? DEFAULT_MVD)[key]}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, mvd: { ...(draft.mvd ?? DEFAULT_MVD), [key]: v } })
                  }
                />
              ))}
            </div>
            <p className="text-xs text-muted">
              If everything is unchecked, the default (one meal + the check-in) applies.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Forge Score weights</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Tune how much each habit counts toward your daily score. The bars renormalize to 100
            automatically — this measures what <em>you</em> care about, never right or wrong.
          </p>
          {(() => {
            const weights: ForgeScoreWeights = draft.scoreWeights ?? DEFAULT_WEIGHTS;
            const effective = renormalizeWeights(weights);
            return (
              <div className="flex flex-col gap-2.5">
                {WEIGHT_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <label htmlFor={`wt-${key}`} className="w-36 shrink-0 text-sm text-ivory">
                      {label}
                    </label>
                    <input
                      id={`wt-${key}`}
                      type="range"
                      min={0}
                      max={25}
                      step={1}
                      value={weights[key]}
                      aria-label={`${label} weight`}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          scoreWeights: { ...weights, [key]: Number(e.target.value) },
                        })
                      }
                      className="h-2 flex-1 accent-gold"
                    />
                    <span className="w-10 shrink-0 text-right text-sm font-semibold text-gold tabular-nums">
                      {Math.round(effective[key])}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
          <button
            type="button"
            onClick={() => setDraft({ ...draft, scoreWeights: undefined })}
            className="self-start text-xs font-semibold text-muted underline underline-offset-2 active:text-ivory"
          >
            Reset to default weights
          </button>
        </CardContent>
      </Card>

      <Button size="lg" onClick={save}>
        <Save className="size-5" /> Save settings
      </Button>
      {savedAt && <p className="text-center text-xs text-muted">Saved {savedAt}</p>}

      {/* Backup & restore */}
      <Card>
        <CardHeader>
          <CardTitle>Data — backup & restore</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            All data lives on this device. Export a JSON backup regularly; import restores it
            here or on another device.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={exportData}>
              <Download className="size-4 text-gold" /> Export data
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4 text-gold" /> Import data
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Choose a Forge30 export file"
            onChange={(e) => {
              void pickImportFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {pendingImport && (
            <div className="flex flex-col gap-2 rounded-(--radius-control) border border-line bg-elevated p-3">
              <p className="text-sm text-ivory">
                Import <span className="font-semibold">{pendingImport.name}</span>? This replaces
                everything currently stored on this device.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={confirmImport}>
                  Replace & import
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingImport(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {dataMessage && <p className="text-sm text-muted">{dataMessage}</p>}
        </CardContent>
      </Card>

      {flagEnabled("devTierSwitcher") && (
        <Card>
          <CardHeader>
            <CardTitle>Dev — entitlement tier (QA only)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Select
              aria-label="QA tier"
              value={tier}
              onChange={async (e) => {
                const next = e.target.value;
                if (isTier(next)) {
                  await adapter.saveTier(next);
                  touch();
                }
              }}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted">
              Exercises feature gates before payments exist. Not rendered in production builds.
            </p>
          </CardContent>
        </Card>
      )}

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
