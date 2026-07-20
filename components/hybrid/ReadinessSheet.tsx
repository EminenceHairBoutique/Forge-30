"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScaleSlider } from "@/components/ui/scale-slider";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useStorage } from "@/lib/storage/provider";
import { uid, toISODate, cn } from "@/lib/utils";
import { BODY_REGIONS, NEURO_SYMPTOMS } from "@/lib/data/hybridProgram";
import { classifyHybridReadiness } from "@/lib/engine/hybridTraining";
import type { HybridReadinessCheckin, HybridSettings, WarmupResponse } from "@/lib/types";

/**
 * Pre-workout readiness check-in (HT Phase 5). Pain is primary; any
 * neurological symptom forces the red band. The result card explains the
 * classification and what today's session becomes. Red renders on the
 * safety surface (§2) — red family only, icon + explicit text label.
 */

const BAND_STYLE: Record<string, string> = {
  green: "border-success/40 text-success",
  yellow: "border-gold/40 text-gold",
  orange: "border-danger/40 text-danger",
  red: "border-danger/60 text-danger",
};

const BAND_LABEL: Record<string, string> = {
  green: "Green — full session",
  yellow: "Yellow — reduced session",
  orange: "Orange — recovery only",
  red: "Red — do not train",
};

export function ReadinessSheet({
  open,
  onOpenChange,
  settings,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: HybridSettings;
  onSaved: (checkin: HybridReadinessCheckin) => void;
}) {
  const { adapter, touch } = useStorage();
  const [pain, setPain] = useState(0);
  const [locations, setLocations] = useState<string[]>([]);
  const [sleepHours, setSleepHours] = useState("7.5");
  const [sleepQuality, setSleepQuality] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [soreness, setSoreness] = useState(2);
  const [stress, setStress] = useState(2);
  const [motivation, setMotivation] = useState(3);
  const [neuro, setNeuro] = useState<string[]>([]);
  const [warmup, setWarmup] = useState<WarmupResponse>("notTried");

  const result = classifyHybridReadiness(
    {
      painScore: pain,
      neuroSymptoms: neuro,
      sleepHours: Number(sleepHours) || undefined,
      energy,
      soreness,
      warmupResponse: warmup,
    },
    settings.thresholds
  );

  const toggle = (list: string[], set: (v: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const save = async () => {
    const checkin: HybridReadinessCheckin = {
      id: uid(),
      date: toISODate(),
      painScore: pain,
      painLocations: locations,
      sleepHours: Number(sleepHours) || 0,
      sleepQuality,
      energy,
      soreness,
      stress,
      motivation,
      neuroSymptoms: neuro,
      warmupResponse: warmup,
      band: result.band,
      loggedAt: new Date().toISOString(),
    };
    await adapter.saveHybridReadiness(checkin);
    touch();
    onSaved(checkin);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Readiness check-in">
        <div className="space-y-5">
          <ScaleSlider label="Worst pain right now (0–10)" min={0} max={10} value={pain} onChange={setPain} />

          {pain > 0 && (
            <div>
              <p className="microlabel mb-2 text-muted">Where?</p>
              <div className="flex flex-wrap gap-1.5">
                {BODY_REGIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={locations.includes(r)}
                    onClick={() => toggle(locations, setLocations, r)}
                    className={cn(
                      "min-h-9 rounded-full border px-3 text-xs",
                      locations.includes(r)
                        ? "border-gold/50 bg-gold/10 text-gold"
                        : "border-line text-muted"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="microlabel text-muted">Sleep (hours)</span>
              <Input
                inputMode="decimal"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="microlabel text-muted">Warm-up response</span>
              <Select
                value={warmup}
                onChange={(e) => setWarmup(e.target.value as WarmupResponse)}
                className="mt-1"
              >
                <option value="notTried">Not tried yet</option>
                <option value="better">Symptoms improve</option>
                <option value="same">No change</option>
                <option value="worse">Symptoms worsen</option>
              </Select>
            </label>
          </div>

          <ScaleSlider label="Sleep quality" min={1} max={5} value={sleepQuality} onChange={setSleepQuality} />
          <ScaleSlider label="Energy" min={1} max={5} value={energy} onChange={setEnergy} />
          <ScaleSlider label="Muscle soreness" min={1} max={5} value={soreness} onChange={setSoreness} />
          <ScaleSlider label="Stress" min={1} max={5} value={stress} onChange={setStress} />
          <ScaleSlider label="Motivation" min={1} max={5} value={motivation} onChange={setMotivation} />

          <div className="rounded-(--radius-control) bg-safety p-3">
            <p className="microlabel mb-2 flex items-center gap-1.5 text-danger">
              <ShieldAlert className="size-3.5" aria-hidden /> New symptoms — select any that apply
            </p>
            <div className="space-y-1.5">
              {NEURO_SYMPTOMS.map((s) => (
                <label key={s} className="flex min-h-9 items-center gap-2 text-sm text-ivory">
                  <input
                    type="checkbox"
                    checked={neuro.includes(s)}
                    onChange={() => toggle(neuro, setNeuro, s)}
                    className="size-4 accent-[var(--accent-danger)]"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Result */}
          <div
            className={cn(
              "rounded-(--radius-control) border p-3",
              result.band === "red" || result.band === "orange" ? "bg-safety" : "bg-elevated",
              BAND_STYLE[result.band]
            )}
          >
            <p className="flex items-center gap-2 text-sm font-bold">
              {(result.band === "red" || result.band === "orange") && (
                <AlertTriangle className="size-4" aria-hidden />
              )}
              {BAND_LABEL[result.band]}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-ivory">{result.guidance}</p>
            {result.band === "red" && (
              <p className="mt-2 text-xs text-muted">
                This app does not diagnose injuries or replace medical care.
              </p>
            )}
          </div>

          <Button className="w-full" onClick={save}>
            Save check-in
          </Button>
          <Badge variant="default" className="w-full justify-center text-[10px] text-muted">
            Thresholds are configurable in Hybrid settings
          </Badge>
        </div>
      </SheetContent>
    </Sheet>
  );
}
