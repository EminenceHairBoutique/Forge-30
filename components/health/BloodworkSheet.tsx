"use client";

import { useState } from "react";
import { ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { markerStatus, parseBloodworkText } from "@/lib/engine/healthRules";
import { findBiomarker } from "@/lib/data/biomarkers";
import { toISODate, uid } from "@/lib/utils";
import type { Biomarker, BloodworkReport } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Bloodwork entry (E7): paste a panel (parser handles common lab formats) or
 * add markers by hand; review the parsed rows before saving. PDF/photo
 * upload stays behind FLAG(bloodworkUpload).
 */
export function BloodworkSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { adapter, touch } = useStorage();
  const [labName, setLabName] = useState("");
  const [date, setDate] = useState(toISODate());
  const [pasteText, setPasteText] = useState("");
  const [markers, setMarkers] = useState<Biomarker[]>([]);
  const [manual, setManual] = useState({ name: "", value: "", unit: "" });

  const parse = () => {
    const parsed = parseBloodworkText(pasteText);
    if (parsed.length > 0) {
      setMarkers([...markers, ...parsed]);
      setPasteText("");
    }
  };

  const addManual = () => {
    if (!manual.name.trim() || manual.value === "") return;
    const def = findBiomarker(manual.name);
    setMarkers([
      ...markers,
      {
        name: def?.name ?? manual.name.trim(),
        value: Number(manual.value) || 0,
        unit: manual.unit.trim() || def?.unit || "",
        refLow: def?.refLow ?? null,
        refHigh: def?.refHigh ?? null,
      },
    ]);
    setManual({ name: "", value: "", unit: "" });
  };

  const save = async () => {
    if (markers.length === 0) return;
    const report: BloodworkReport = {
      id: uid(),
      date,
      labName: labName.trim(),
      markers,
      notes: "",
      createdAt: new Date().toISOString(),
    };
    await adapter.saveBloodwork(report);
    touch();
    setMarkers([]);
    setLabName("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Add bloodwork">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bw-date">Lab date</Label>
              <Input id="bw-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bw-lab">Lab (optional)</Label>
              <Input id="bw-lab" placeholder="Quest, Labcorp…" value={labName} onChange={(e) => setLabName(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bw-paste">Paste results — one marker per line</Label>
            <Textarea
              id="bw-paste"
              rows={5}
              placeholder={"Glucose 92 mg/dL (70-99)\nLDL 96 mg/dL (0-99)\nA1c 5.4 %"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <Button variant="secondary" size="sm" className="self-start" onClick={parse} disabled={!pasteText.trim()}>
              <ClipboardPaste className="size-4 text-gold" /> Parse pasted text
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Or add one by hand</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Marker"
                className="flex-1"
                value={manual.name}
                onChange={(e) => setManual({ ...manual, name: e.target.value })}
                aria-label="Marker name"
              />
              <Input
                placeholder="Value"
                type="number"
                inputMode="decimal"
                className="w-20"
                value={manual.value}
                onChange={(e) => setManual({ ...manual, value: e.target.value })}
                aria-label="Marker value"
              />
              <Input
                placeholder="Unit"
                className="w-20"
                value={manual.unit}
                onChange={(e) => setManual({ ...manual, unit: e.target.value })}
                aria-label="Marker unit"
              />
              <Button variant="secondary" size="sm" onClick={addManual} aria-label="Add marker">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {markers.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label>Ready to save ({markers.length})</Label>
              <div className="flex flex-col gap-1">
                {markers.map((m, i) => {
                  const status = markerStatus(m);
                  return (
                    <div
                      key={`${m.name}-${i}`}
                      className="flex items-center gap-2 rounded-(--radius-control) bg-elevated px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-ivory">{m.name}</span>
                      <span className="tabular text-ivory">
                        {m.value} {m.unit}
                      </span>
                      <span className="text-xs text-muted">
                        {m.refLow ?? "—"}–{m.refHigh ?? "—"}
                        {status === "aboveRange" ? " ↑" : status === "belowRange" ? " ↓" : ""}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${m.name}`}
                        onClick={() => setMarkers(markers.filter((_, j) => j !== i))}
                        className="flex size-9 items-center justify-center rounded-full text-muted active:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button size="lg" disabled={markers.length === 0} onClick={save}>
            Save report
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
