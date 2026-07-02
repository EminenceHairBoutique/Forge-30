"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DailyLog } from "@/lib/types";

/** Quick sheet for the manually-tracked daily basics: sleep, steps, mobility. */
export function DailyCheckSheet({
  log,
  onSave,
}: {
  log: DailyLog;
  onSave: (patch: Partial<DailyLog>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [sleep, setSleep] = useState(log.sleepHours ? String(log.sleepHours) : "");
  const [steps, setSteps] = useState(log.steps ? String(log.steps) : "");
  const [mobility, setMobility] = useState(log.mobilityDone);

  const save = async () => {
    await onSave({
      sleepHours: Math.max(0, Number(sleep) || 0),
      steps: Math.max(0, Math.round(Number(steps) || 0)),
      mobilityDone: mobility,
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
          <Button size="lg" onClick={save}>
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
