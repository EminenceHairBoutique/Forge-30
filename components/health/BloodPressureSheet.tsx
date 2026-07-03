"use client";

import { useState } from "react";
import { AlertTriangle, PhoneCall } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import {
  BP_CATEGORY_LABEL,
  EMERGENCY_SYMPTOMS,
  bpGuidance,
  categorizeBloodPressure,
} from "@/lib/engine/healthRules";
import { toISODate, uid } from "@/lib/utils";
import type { BloodPressureEntry, BodyPosition, CuffLocation } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CheckItem } from "@/components/ui/checkbox";

/**
 * Blood-pressure logging with the crisis flow (E7). A crisis-range save
 * doesn't just store the number — it walks the emergency-symptom check and
 * escalates to "call emergency services" when any are present. This is one
 * of the few legitimate uses of warning/danger colors.
 */
export function BloodPressureSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { adapter, touch } = useStorage();
  const now = new Date();
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [time, setTime] = useState(
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  );
  const [position, setPosition] = useState<BodyPosition>("seated");
  const [cuff, setCuff] = useState<CuffLocation>("leftArm");
  const [context, setContext] = useState({ caffeine: false, exercise: false, stress: false });
  const [notes, setNotes] = useState("");
  // Crisis flow state: after a crisis-range save we ask about symptoms.
  const [crisisCheck, setCrisisCheck] = useState(false);
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());

  const sys = Number(systolic) || 0;
  const dia = Number(diastolic) || 0;
  const valid = sys >= 60 && sys <= 260 && dia >= 30 && dia <= 200;
  const category = valid ? categorizeBloodPressure(sys, dia) : null;

  const reset = () => {
    setSystolic("");
    setDiastolic("");
    setPulse("");
    setNotes("");
    setContext({ caffeine: false, exercise: false, stress: false });
    setCrisisCheck(false);
    setSymptoms(new Set());
  };

  const save = async () => {
    if (!valid) return;
    const entry: BloodPressureEntry = {
      id: uid(),
      date: toISODate(),
      time,
      systolic: sys,
      diastolic: dia,
      pulse: pulse === "" ? null : Number(pulse) || null,
      position,
      cuffLocation: cuff,
      ...context,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
    await adapter.saveBloodPressure(entry);
    touch();
    if (category === "crisis") {
      // Don't close — walk the emergency-symptom check first.
      setCrisisCheck(true);
      return;
    }
    reset();
    onOpenChange(false);
  };

  const guidance = category ? bpGuidance(category, symptoms.size > 0) : null;

  if (crisisCheck) {
    const emergency = symptoms.size > 0;
    const g = bpGuidance("crisis", emergency);
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) { reset(); } onOpenChange(o); }}>
        <SheetContent title="Crisis-range reading">
          <div className="flex flex-col gap-4">
            <div
              className={`flex items-start gap-3 rounded-(--radius-card) border p-3 ${
                emergency ? "border-danger bg-danger/10" : "border-danger/50 bg-danger/5"
              }`}
            >
              {emergency ? (
                <PhoneCall className="mt-0.5 size-5 shrink-0 text-danger" />
              ) : (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
              )}
              <div>
                <p className="text-sm font-bold text-danger">{g.headline}</p>
                <p className="mt-1 text-sm leading-relaxed text-ivory">{g.body}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Is any of this happening right now?</Label>
              <div className="rounded-(--radius-card) border border-line bg-surface p-1">
                {EMERGENCY_SYMPTOMS.map((s) => (
                  <CheckItem
                    key={s}
                    variant="toggle"
                    label={s}
                    checked={symptoms.has(s)}
                    onCheckedChange={(v) => {
                      const next = new Set(symptoms);
                      if (v) next.add(s);
                      else next.delete(s);
                      setSymptoms(next);
                    }}
                  />
                ))}
              </div>
            </div>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              I've read this — close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Log blood pressure">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-sys">Systolic</Label>
              <Input
                id="bp-sys"
                type="number"
                inputMode="numeric"
                placeholder="120"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-dia">Diastolic</Label>
              <Input
                id="bp-dia"
                type="number"
                inputMode="numeric"
                placeholder="80"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-pulse">Pulse</Label>
              <Input
                id="bp-pulse"
                type="number"
                inputMode="numeric"
                placeholder="—"
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
              />
            </div>
          </div>

          {guidance && category && (
            <div
              className={`rounded-(--radius-control) border px-3 py-2 text-sm ${
                guidance.severity === "emergency"
                  ? "border-danger/60 bg-danger/10 text-ivory"
                  : guidance.severity === "warning"
                    ? "border-warning/50 bg-warning/10 text-ivory"
                    : "border-line bg-elevated text-muted"
              }`}
            >
              <span className="font-semibold text-ivory">{BP_CATEGORY_LABEL[category]}.</span>{" "}
              {guidance.body}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-time">Time</Label>
              <Input id="bp-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-pos">Position</Label>
              <Select id="bp-pos" value={position} onChange={(e) => setPosition(e.target.value as BodyPosition)}>
                <option value="seated">Seated</option>
                <option value="standing">Standing</option>
                <option value="lying">Lying</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-cuff">Cuff</Label>
              <Select id="bp-cuff" value={cuff} onChange={(e) => setCuff(e.target.value as CuffLocation)}>
                <option value="leftArm">Left arm</option>
                <option value="rightArm">Right arm</option>
                <option value="wrist">Wrist</option>
              </Select>
            </div>
          </div>

          <div className="rounded-(--radius-card) border border-line bg-surface p-1">
            <CheckItem
              variant="toggle"
              label="Caffeine in the last 30 min"
              checked={context.caffeine}
              onCheckedChange={(v) => setContext({ ...context, caffeine: v })}
            />
            <CheckItem
              variant="toggle"
              label="Exercise in the last 30 min"
              checked={context.exercise}
              onCheckedChange={(v) => setContext({ ...context, exercise: v })}
            />
            <CheckItem
              variant="toggle"
              label="Feeling stressed right now"
              checked={context.stress}
              onCheckedChange={(v) => setContext({ ...context, stress: v })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-notes">Notes (optional)</Label>
            <Input id="bp-notes" placeholder="anything unusual" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <p className="text-xs text-muted">
            Best technique: seated 5 minutes, feet flat, arm supported at heart height, no
            caffeine or exercise within 30 minutes.
          </p>

          <Button size="lg" disabled={!valid} onClick={save}>
            Save reading
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
