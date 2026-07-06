"use client";

import { useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { toISODate, uid } from "@/lib/utils";
import type { BodyMetric } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScaleSlider } from "@/components/ui/scale-slider";

function emptyMetric(date: string): BodyMetric {
  return {
    id: uid(),
    date,
    weightLb: 0,
    waistIn: 0,
    chestIn: 0,
    armsIn: 0,
    legsIn: 0,
    energy: 0,
    soreness: 0,
    photoUrl: "",
  };
}

/** Downscale a photo to a small data URL so it survives localStorage limits. */
async function fileToThumbnail(file: File, maxDim = 480): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BodyMetricSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { adapter, touch } = useStorage();
  const today = toISODate();
  const [draft, setDraft] = useState<BodyMetric>(() => emptyMetric(today));
  // §3.4: the photo never rides the metric record — it goes to the large
  // store (IndexedDB) keyed by metric id, and is excluded from cloud sync.
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhotoChanged(false);
    void adapter.getBodyMetric(today).then(async (m) => {
      const next = m ?? emptyMetric(today);
      setDraft(next);
      const stored = next.hasPhoto ? await adapter.getBodyPhoto(next.id) : null;
      setPhoto(stored ?? next.photoUrl ?? null);
    });
  }, [open, adapter, today]);

  const num = (key: keyof BodyMetric) => (v: string) =>
    setDraft({ ...draft, [key]: Math.max(0, Number(v) || 0) });

  const save = async () => {
    if (photoChanged && photo) await adapter.saveBodyPhoto(draft.id, photo);
    await adapter.saveBodyMetric({
      ...draft,
      date: today,
      photoUrl: "",
      hasPhoto: draft.hasPhoto || (photoChanged && !!photo),
    });
    touch();
    onOpenChange(false);
  };

  const MEASURES: { key: keyof BodyMetric; label: string }[] = [
    { key: "weightLb", label: "Morning weight (lb)" },
    { key: "waistIn", label: "Waist (in)" },
    { key: "chestIn", label: "Chest (in)" },
    { key: "armsIn", label: "Arms (in)" },
    { key: "legsIn", label: "Legs (in)" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Body metrics — today">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {MEASURES.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`bm-${key}`}>{label}</Label>
                <Input
                  id={`bm-${key}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={(draft[key] as number) || ""}
                  placeholder="—"
                  onChange={(e) => num(key)(e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Energy (1–10)</Label>
            <ScaleSlider label="Energy" value={draft.energy} onChange={(v) => setDraft({ ...draft, energy: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Soreness (1–10)</Label>
            <ScaleSlider label="Soreness" value={draft.soreness} onChange={(v) => setDraft({ ...draft, soreness: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bm-photo">Progress photo (stored on this device)</Label>
            <input
              id="bm-photo"
              type="file"
              accept="image/*"
              className="text-sm text-muted file:mr-3 file:min-h-11 file:rounded-(--radius-control) file:border file:border-line file:bg-elevated file:px-3 file:text-sm file:font-semibold file:text-ivory"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPhoto(await fileToThumbnail(file));
                  setPhotoChanged(true);
                }
              }}
            />
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt="Progress preview"
                className="mt-1 h-32 w-24 rounded-(--radius-control) border border-line object-cover"
              />
            )}
          </div>
          <Button size="lg" onClick={save}>
            Save metrics
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
