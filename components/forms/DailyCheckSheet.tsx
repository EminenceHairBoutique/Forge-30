"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Watch } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getHealthProvider } from "@/lib/health/provider";
import { useStorage } from "@/lib/storage/provider";
import { detectedSuggestions, type DetectedSuggestion } from "@/lib/engine/healthMerge";
import { PROTOCOL_SYMPTOM_TAGS } from "@/lib/data/protocolReference";
import type { ProtocolSymptom } from "@/lib/types";
import type { DailyLog } from "@/lib/types";

/**
 * Quick sheet for the manually-tracked daily basics: sleep, steps, mobility.
 * Under the native shell (v3 Phase 3), HealthKit pre-fills as "detected"
 * chips — one tap accepts into the input, manual typing always wins, and on
 * the web nothing changes (the null provider never detects anything).
 */
export function DailyCheckSheet({
  log,
  onSave,
}: {
  log: DailyLog;
  onSave: (patch: Partial<DailyLog>) => Promise<void>;
}) {
  const { adapter } = useStorage();
  const [open, setOpen] = useState(false);
  const [sleep, setSleep] = useState(log.sleepHours ? String(log.sleepHours) : "");
  const [steps, setSteps] = useState(log.steps ? String(log.steps) : "");
  const [mobility, setMobility] = useState(log.mobilityDone);
  const [detected, setDetected] = useState<DetectedSuggestion[]>([]);
  const [protocolsOn, setProtocolsOn] = useState(false);
  const [symptoms, setSymptoms] = useState<ProtocolSymptom[]>(log.protocolSymptoms ?? []);

  useEffect(() => {
    if (!open) return;
    // Symptom tags render only when Protocols is enabled (§6.0.6).
    void adapter.getProtocolSettings().then((s) => setProtocolsOn(s.enabled));
    let cancelled = false;
    void (async () => {
      const provider = await getHealthProvider();
      if (!provider.isAvailable()) return;
      const [sleepH, stepCount] = await Promise.all([
        provider.getSleep(log.date),
        provider.getSteps(log.date),
      ]);
      if (cancelled) return;
      setDetected(detectedSuggestions(log, { sleepHours: sleepH, steps: stepCount }));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, log]);

  const accept = (s: DetectedSuggestion) => {
    if (s.field === "sleepHours") setSleep(String(s.value));
    else setSteps(String(s.value));
    setDetected((d) => d.filter((x) => x.field !== s.field));
  };

  const toggleSymptom = (tag: ProtocolSymptom["tag"]) => {
    setSymptoms((xs) =>
      xs.some((x) => x.tag === tag) ? xs.filter((x) => x.tag !== tag) : [...xs, { tag, severity: 2 }]
    );
  };

  const setSeverity = (tag: ProtocolSymptom["tag"], severity: number) => {
    setSymptoms((xs) => xs.map((x) => (x.tag === tag ? { ...x, severity } : x)));
  };

  const save = async () => {
    await onSave({
      sleepHours: Math.max(0, Number(sleep) || 0),
      steps: Math.max(0, Math.round(Number(steps) || 0)),
      mobilityDone: mobility,
      ...(protocolsOn ? { protocolSymptoms: symptoms } : {}),
    });
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setSleep(log.sleepHours ? String(log.sleepHours) : "");
          setSteps(log.steps ? String(log.steps) : "");
          setMobility(log.mobilityDone);
          setSymptoms(log.protocolSymptoms ?? []);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <ClipboardCheck className="size-4 text-gold" /> Daily check
        </Button>
      </SheetTrigger>
      <SheetContent title="Daily check">
        <div className="flex flex-col gap-4">
          {detected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detected.map((s) => (
                <button
                  key={s.field}
                  type="button"
                  onClick={() => accept(s)}
                  className="press-scale flex min-h-11 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 text-sm font-semibold text-gold"
                >
                  <Watch className="size-4" />
                  {s.label}: {s.value.toLocaleString()}
                  {s.unit} — tap to use
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dc-sleep">Sleep (hours)</Label>
              <Input
                id="dc-sleep"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                max="16"
                placeholder="7.5"
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dc-steps">Steps</Label>
              <Input
                id="dc-steps"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="8000"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-1">
            <span className="text-sm font-medium text-ivory">Mobility / prehab done</span>
            <Switch checked={mobility} onCheckedChange={setMobility} aria-label="Mobility done" />
          </div>
          {protocolsOn && (
            <div className="flex flex-col gap-2">
              <p className="microlabel text-muted">Protocol notes (optional)</p>
              <div className="flex flex-wrap gap-2">
                {PROTOCOL_SYMPTOM_TAGS.map(({ tag, label }) => {
                  const active = symptoms.find((x) => x.tag === tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={!!active}
                      onClick={() => toggleSymptom(tag as ProtocolSymptom["tag"])}
                      className={`min-h-11 rounded-full border px-3 text-sm font-semibold transition-colors ${
                        active ? "border-gold/50 bg-gold/10 text-gold" : "border-line bg-elevated text-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {symptoms.map((sym) => (
                <div key={sym.tag} className="flex items-center justify-between gap-2 rounded-(--radius-control) bg-elevated px-3 py-2">
                  <span className="text-sm text-ivory">
                    {PROTOCOL_SYMPTOM_TAGS.find((t) => t.tag === sym.tag)?.label} severity
                  </span>
                  <div className="flex gap-1" role="radiogroup" aria-label={`${sym.tag} severity`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={sym.severity === n}
                        onClick={() => setSeverity(sym.tag, n)}
                        className={`size-9 rounded-full border text-sm font-semibold ${
                          sym.severity === n ? "border-gold/60 bg-gold/15 text-gold" : "border-line text-muted"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button size="lg" onClick={save}>
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
