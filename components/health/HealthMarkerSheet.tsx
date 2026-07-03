"use client";

import { useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { toISODate, uid } from "@/lib/utils";
import type { HealthMarkerEntry } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: { key: keyof Omit<HealthMarkerEntry, "id" | "date" | "createdAt">; label: string; mode: "numeric" | "decimal" }[] = [
  { key: "restingHR", label: "Resting HR (bpm)", mode: "numeric" },
  { key: "hrv", label: "HRV (ms)", mode: "numeric" },
  { key: "cardioMinutes", label: "Cardio (min)", mode: "numeric" },
  { key: "zone2Minutes", label: "Zone 2 (min)", mode: "numeric" },
  { key: "gripStrengthLb", label: "Grip (lb)", mode: "decimal" },
  { key: "pushUps", label: "Push-up test", mode: "numeric" },
  { key: "plankSec", label: "Plank (sec)", mode: "numeric" },
  { key: "mileTimeSec", label: "Mile time (sec)", mode: "numeric" },
  { key: "bodyFatPct", label: "Body fat (%)", mode: "decimal" },
];

/** Fitness/recovery markers (E7) — log whichever you measured; blanks stay untracked. */
export function HealthMarkerSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { adapter, touch } = useStorage();
  const [values, setValues] = useState<Record<string, string>>({});

  const save = async () => {
    const entry: HealthMarkerEntry = {
      id: uid(),
      date: toISODate(),
      restingHR: null,
      hrv: null,
      cardioMinutes: null,
      zone2Minutes: null,
      gripStrengthLb: null,
      pushUps: null,
      plankSec: null,
      mileTimeSec: null,
      bodyFatPct: null,
      createdAt: new Date().toISOString(),
    };
    let any = false;
    for (const f of FIELDS) {
      const raw = values[f.key];
      if (raw !== undefined && raw !== "") {
        (entry[f.key] as number | null) = Math.max(0, Number(raw) || 0);
        any = true;
      }
    }
    if (!any) return;
    await adapter.saveHealthMarker(entry);
    touch();
    setValues({});
    onOpenChange(false);
  };

  const filled = FIELDS.some((f) => (values[f.key] ?? "") !== "");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Log fitness markers">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Log whatever you measured today — anything left blank simply stays untracked.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`hm-${f.key}`}>{f.label}</Label>
                <Input
                  id={`hm-${f.key}`}
                  type="number"
                  inputMode={f.mode}
                  placeholder="—"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <Button size="lg" disabled={!filled} onClick={save}>
            Save markers
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
