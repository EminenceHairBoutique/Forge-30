"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, FlaskConical, Plus, Trash2 } from "lucide-react";
import { apiUrl, authHeaders } from "@/lib/api";
import { useTier } from "@/lib/hooks/useTier";
import type { LabImportResult } from "@/app/api/protocols/labimport/route";
import { useStorage } from "@/lib/storage/provider";
import { LAB_MARKER_CATALOG, LAB_RANGE_DISCLAIMER } from "@/lib/data/protocolReference";
import { labStatus } from "@/lib/engine/protocols";
import { toISODate, uid } from "@/lib/utils";
import type { LabMarkerValue, LabPanel } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TrendChart } from "@/components/charts/TrendChart";

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  in: { label: "in range", cls: "border-success/30 bg-success/10 text-success" },
  borderline: { label: "borderline", cls: "border-gold/40 bg-gold/10 text-gold" },
  out: { label: "out of range", cls: "border-danger/40 bg-safety text-danger" },
  noRange: { label: "no range set", cls: "border-line bg-elevated text-muted" },
};

/**
 * Lab tracking (v3 Phase 6): panels in, per-marker trends out. Ranges are
 * the user's own lab's ranges (editable per entry); chips are visibility
 * only — out-of-range says "discuss with your provider", never interprets.
 */
export function LabsSection({
  panels,
  onChanged,
}: {
  panels: LabPanel[];
  onChanged: () => void;
}) {
  const { adapter } = useStorage();
  const [entryOpen, setEntryOpen] = useState(false);
  const [trendMarker, setTrendMarker] = useState<string | null>(null);

  // Latest panel first.
  const latest = panels[0] ?? null;

  const trendData = useMemo(() => {
    if (!trendMarker) return [];
    return [...panels]
      .reverse()
      .map((p) => {
        const m = p.markers.find((x) => x.name === trendMarker);
        return m ? { label: p.date.slice(5), a: m.value } : null;
      })
      .filter((x): x is { label: string; a: number } => x !== null);
  }, [panels, trendMarker]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-gold" /> Labs
        </CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setEntryOpen(true)}>
          <Plus className="size-4" /> Add panel
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {panels.length === 0 && (
          <p className="text-sm text-muted">
            Enter panels from your lab reports — trends build from the second panel on.
          </p>
        )}
        {latest && (
          <div className="flex flex-col gap-1.5">
            <p className="microlabel text-muted">
              Latest — {latest.date} {latest.source && `· ${latest.source}`}
            </p>
            {latest.markers.map((m) => {
              const status = STATUS_CHIP[labStatus(m)]!;
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setTrendMarker(m.name)}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-(--radius-control) border border-line bg-elevated px-3 py-2 text-left active:border-gold/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ivory">{m.name}</span>
                    <span className="block text-xs text-muted tabular">
                      {m.value} {m.unit}
                      {m.refLow !== null || m.refHigh !== null
                        ? ` · range ${m.refLow ?? "—"}–${m.refHigh ?? "—"}`
                        : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>
                    {status.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {trendMarker && trendData.length >= 2 && (
          <div>
            <p className="microlabel mb-1 text-gold">{trendMarker} trend</p>
            <TrendChart data={trendData} seriesA={trendMarker} height={160} />
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted">{LAB_RANGE_DISCLAIMER}</p>
      </CardContent>

      <LabPanelSheet
        open={entryOpen}
        onOpenChange={setEntryOpen}
        onSaved={() => {
          onChanged();
        }}
        adapterSave={(p) => adapter.saveLabPanel(p)}
      />
    </Card>
  );
}

function LabPanelSheet({
  open,
  onOpenChange,
  onSaved,
  adapterSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  adapterSave: (p: LabPanel) => Promise<void>;
}) {
  const { can } = useTier();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [date, setDate] = useState(toISODate());
  const [source, setSource] = useState("");
  const [markers, setMarkers] = useState<LabMarkerValue[]>([]);
  const [pick, setPick] = useState("");

  // AI lab import (Pro): transcription prefill only — every value stays
  // editable here and nothing saves until the user says so.
  const importFromPhoto = async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const res = await fetch(apiUrl("/api/protocols/labimport"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ image: dataUrl.split(",")[1], mediaType: "image/jpeg" }),
      });
      const data = (await res.json()) as { result?: LabImportResult; error?: string };
      if (!res.ok || !data.result) throw new Error(data.error ?? "Import failed.");
      setMarkers(data.result.markers);
      if (data.result.drawDate) setDate(data.result.drawDate);
      if (data.result.source) setSource(data.result.source);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed — manual entry works the same.");
    } finally {
      setImporting(false);
    }
  };

  const addMarker = (name: string) => {
    if (!name || markers.some((m) => m.name === name)) return;
    const def = LAB_MARKER_CATALOG.find((d) => d.name === name);
    setMarkers([
      ...markers,
      {
        name,
        value: 0,
        unit: def?.unit ?? "",
        refLow: def?.refLow ?? null,
        refHigh: def?.refHigh ?? null,
      },
    ]);
    setPick("");
  };

  const update = (i: number, patch: Partial<LabMarkerValue>) =>
    setMarkers((xs) => xs.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const save = async () => {
    const clean = markers.filter((m) => m.value > 0);
    if (clean.length === 0) return;
    await adapterSave({
      id: uid(),
      date,
      source: source.trim(),
      markers: clean,
      createdAt: new Date().toISOString(),
    });
    setMarkers([]);
    setSource("");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Add lab panel">
        <div className="flex flex-col gap-3">
          {can("protocolLabImport") && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importFromPhoto(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="secondary"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="size-4" />
                {importing ? "Reading the report…" : "Import from a report photo"}
              </Button>
              <p className="text-xs text-muted">
                Transcription only — review and edit every value below before saving.
              </p>
              {importError && <p className="text-sm text-muted">{importError}</p>}
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lab-date">Draw date</Label>
              <Input id="lab-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lab-src">Lab / source</Label>
              <Input id="lab-src" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Quest" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lab-pick">Add marker</Label>
            <Select id="lab-pick" value={pick} onChange={(e) => addMarker(e.target.value)}>
              <option value="">Choose a marker…</option>
              {LAB_MARKER_CATALOG.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.unit})
                </option>
              ))}
            </Select>
          </div>
          {markers.map((m, i) => (
            <div key={m.name} className="flex flex-col gap-2 rounded-(--radius-control) border border-line bg-elevated p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ivory">{m.name}</p>
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => setMarkers((xs) => xs.filter((_, idx) => idx !== i))}
                  className="flex size-9 items-center justify-center rounded-full text-muted active:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`lab-${i}-v`} className="text-[10px]">Value ({m.unit})</Label>
                  <Input id={`lab-${i}-v`} type="number" inputMode="decimal" value={m.value || ""} onChange={(e) => update(i, { value: Number(e.target.value) || 0 })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`lab-${i}-lo`} className="text-[10px]">Range low</Label>
                  <Input id={`lab-${i}-lo`} type="number" inputMode="decimal" value={m.refLow ?? ""} onChange={(e) => update(i, { refLow: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`lab-${i}-hi`} className="text-[10px]">Range high</Label>
                  <Input id={`lab-${i}-hi`} type="number" inputMode="decimal" value={m.refHigh ?? ""} onChange={(e) => update(i, { refHigh: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
              </div>
            </div>
          ))}
          <Button size="lg" onClick={() => void save()} disabled={!markers.some((m) => m.value > 0)}>
            Save panel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
