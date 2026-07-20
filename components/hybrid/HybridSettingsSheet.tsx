"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useStorage } from "@/lib/storage/provider";
import { toISODate, cn } from "@/lib/utils";
import { DEFAULT_HYBRID_THRESHOLDS, MESO_TEMPLATES } from "@/lib/engine/hybridTraining";
import { programCsv, programJson } from "@/lib/engine/hybridExport";
import type { AestheticPriority, EquipmentAccess, HybridSettings, TrainingExperience } from "@/lib/types";

/**
 * Hybrid program customization (HT Phase 11): schedule length, session time,
 * equipment, boxing frequency, mesocycle length + repeat week, configurable
 * readiness thresholds, aesthetic priorities with the trap-dominance guard,
 * and remembered-substitution management.
 */

const PRIORITIES: Array<{ id: AestheticPriority; label: string }> = [
  { id: "upperChest", label: "Upper chest" },
  { id: "lats", label: "Lats" },
  { id: "sideDelts", label: "Side delts" },
  { id: "rearDelts", label: "Rear delts" },
  { id: "arms", label: "Arms" },
  { id: "glutes", label: "Glutes" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "quads", label: "Quads" },
  { id: "calves", label: "Calves" },
  { id: "abs", label: "Abs" },
  { id: "neckTraps", label: "Neck + traps" },
];

export function HybridSettingsSheet({
  open,
  onOpenChange,
  settings,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: HybridSettings;
  onSaved: (s: HybridSettings) => void;
}) {
  const { adapter, touch } = useStorage();
  const [draft, setDraft] = useState<HybridSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const set = <K extends keyof HybridSettings>(key: K, value: HybridSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const download = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setThreshold = (key: "yellowPain" | "orangePain" | "redPain", raw: string) => {
    const v = Math.min(10, Math.max(0, Number(raw) || 0));
    setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, [key]: v } }));
  };

  const thresholdsValid =
    draft.thresholds.yellowPain < draft.thresholds.orangePain &&
    draft.thresholds.orangePain < draft.thresholds.redPain;

  const save = async () => {
    const cleaned: HybridSettings = {
      ...draft,
      thresholds: thresholdsValid ? draft.thresholds : DEFAULT_HYBRID_THRESHOLDS,
    };
    await adapter.saveHybridSettings(cleaned);
    touch();
    onSaved(cleaned);
    onOpenChange(false);
  };

  const togglePriority = (id: AestheticPriority) =>
    set(
      "aestheticPriorities",
      draft.aestheticPriorities.includes(id)
        ? draft.aestheticPriorities.filter((p) => p !== id)
        : [...draft.aestheticPriorities, id]
    );

  const mesoLen = MESO_TEMPLATES[draft.mesoWeeks].length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Hybrid training settings">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ivory">Hybrid training</p>
              <p className="text-xs text-muted">Show the Hybrid tab and daily loop</p>
            </div>
            <Switch checked={draft.enabled} onCheckedChange={(v) => set("enabled", v)} aria-label="Enable hybrid training" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="microlabel text-muted">Training days / week</span>
              <Select value={String(draft.daysPerWeek)} onChange={(e) => set("daysPerWeek", Number(e.target.value) as 3 | 4 | 5 | 6)} className="mt-1">
                {[3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="microlabel text-muted">Session length (min)</span>
              <Input inputMode="numeric" value={String(draft.sessionMinutes)} onChange={(e) => set("sessionMinutes", Number(e.target.value) || 60)} className="mt-1" />
            </label>
            <label className="block">
              <span className="microlabel text-muted">Equipment</span>
              <Select value={draft.equipment} onChange={(e) => set("equipment", e.target.value as EquipmentAccess)} className="mt-1">
                <option value="none">Bodyweight only</option>
                <option value="minimal">Minimal (DBs, bands)</option>
                <option value="homeGym">Home gym</option>
                <option value="fullGym">Full gym</option>
              </Select>
            </label>
            <label className="block">
              <span className="microlabel text-muted">Experience</span>
              <Select value={draft.experience} onChange={(e) => set("experience", e.target.value as TrainingExperience)} className="mt-1">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </label>
            <label className="block">
              <span className="microlabel text-muted">Boxing days / week</span>
              <Select value={String(draft.boxingDaysPerWeek)} onChange={(e) => set("boxingDaysPerWeek", Number(e.target.value))} className="mt-1">
                {[0, 1, 2, 3].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="microlabel text-muted">Boxing experience</span>
              <Select value={draft.boxingExperience} onChange={(e) => set("boxingExperience", e.target.value as HybridSettings["boxingExperience"])} className="mt-1">
                <option value="none">New to boxing</option>
                <option value="some">Some experience</option>
                <option value="experienced">Experienced</option>
              </Select>
            </label>
          </div>

          {/* Mesocycle */}
          <div>
            <p className="microlabel mb-2 text-muted">Mesocycle</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="microlabel text-muted">Length</span>
                <Select value={String(draft.mesoWeeks)} onChange={(e) => set("mesoWeeks", Number(e.target.value) as 4 | 5 | 6 | 8)} className="mt-1">
                  {[4, 5, 6, 8].map((w) => (
                    <option key={w} value={w}>
                      {w} weeks
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="microlabel text-muted">Repeat a week</span>
                <Select
                  value={draft.repeatWeek === null ? "" : String(draft.repeatWeek)}
                  onChange={(e) => set("repeatWeek", e.target.value === "" ? null : Number(e.target.value))}
                  className="mt-1"
                >
                  <option value="">No repeat</option>
                  {Array.from({ length: mesoLen }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      Week {w} twice
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Repeating a week is smart planning after poor readiness or missed sessions — never a setback.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => set("mesoStartDate", toISODate())}
            >
              {draft.mesoStartDate ? `Restart cycle today (started ${draft.mesoStartDate})` : "Start cycle today"}
            </Button>
          </div>

          {/* Readiness thresholds */}
          <div>
            <p className="microlabel mb-2 text-muted">Readiness pain thresholds (0–10)</p>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="microlabel text-muted">Yellow ≥</span>
                <Input inputMode="numeric" value={String(draft.thresholds.yellowPain)} onChange={(e) => setThreshold("yellowPain", e.target.value)} className="mt-1" />
              </label>
              <label className="block">
                <span className="microlabel text-muted">Orange ≥</span>
                <Input inputMode="numeric" value={String(draft.thresholds.orangePain)} onChange={(e) => setThreshold("orangePain", e.target.value)} className="mt-1" />
              </label>
              <label className="block">
                <span className="microlabel text-muted">Red ≥</span>
                <Input inputMode="numeric" value={String(draft.thresholds.redPain)} onChange={(e) => setThreshold("redPain", e.target.value)} className="mt-1" />
              </label>
            </div>
            {!thresholdsValid && (
              <p className="mt-1.5 text-xs text-danger">
                Thresholds must increase (yellow &lt; orange &lt; red) — defaults 3 / 5 / 7 will be used instead.
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted">
              Neurological symptoms always classify red regardless of these values.
            </p>
          </div>

          {/* Aesthetic priorities */}
          <div>
            <p className="microlabel mb-2 text-muted">Aesthetic priorities (+1 accessory set focus)</p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={draft.aestheticPriorities.includes(p.id)}
                  onClick={() => togglePriority(p.id)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-xs",
                    draft.aestheticPriorities.includes(p.id)
                      ? "border-gold/50 bg-gold/10 text-gold"
                      : "border-line text-muted"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="min-w-0 pr-3">
                <p className="text-sm text-ivory">Trap-dominance guard</p>
                <p className="text-xs text-muted">
                  Skip extra upper-trap volume (recommended with trap dominance or neck/scapular/thoracic symptoms)
                </p>
              </div>
              <Switch checked={draft.avoidTrapEmphasis} onCheckedChange={(v) => set("avoidTrapEmphasis", v)} aria-label="Trap-dominance guard" />
            </div>
          </div>

          {Object.keys(draft.preferredSubs).length > 0 && (
            <div>
              <p className="microlabel mb-1.5 text-muted">Remembered substitutions</p>
              <p className="text-xs text-muted">
                {Object.keys(draft.preferredSubs).length} movement{Object.keys(draft.preferredSubs).length > 1 ? "s" : ""} auto-substituted from past sessions.
              </p>
              <Button variant="ghost" size="sm" className="mt-1 text-muted" onClick={() => set("preferredSubs", {})}>
                Clear remembered substitutions
              </Button>
            </div>
          )}

          {/* Program export (never paywalled — DECISIONS §13) */}
          <div>
            <p className="microlabel mb-2 text-muted">Program export</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => download(programCsv(), "forge30-hybrid-program.csv", "text/csv")}>
                CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => download(programJson(), "forge30-hybrid-program.json", "application/json")}
              >
                JSON
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Full program + mobility library with instructions, cues, and cautions. Logged
              workouts export from Settings → Data.
            </p>
          </div>

          <Button className="w-full" onClick={save}>
            Save settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
