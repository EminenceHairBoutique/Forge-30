"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { RED_FLAGS, injuriesFromPainFlags, redFlagGuidance } from "@/lib/engine/trainingRules";
import { uid } from "@/lib/utils";
import type { InjuryProfile } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckItem } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

/**
 * Guided injury intake (E8-T). Opens with the red-flag screen — any checked
 * flag escalates to "seek medical evaluation, never train through this"
 * before anything else. The intake itself captures the InjuryProfile fields
 * in the user's own words; the builder and modification engine map them to
 * caution tags. Support around training, never treatment.
 */
export function InjuryIntakeSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile, saveProfile, touch } = useStorage();
  const [redFlags, setRedFlags] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState({
    bodyArea: "",
    diagnosis: "",
    symptoms: "",
    painScore: 0,
    aggravating: "",
    relieving: "",
    restrictions: "",
    professionalCare: false,
    notes: "",
  });

  if (!profile) return null;

  const derived = injuriesFromPainFlags(profile.painFlags);
  const own = profile.injuries ?? [];
  const escalation = redFlagGuidance([...redFlags]);

  const save = async () => {
    if (!draft.bodyArea.trim()) return;
    const entry: InjuryProfile = {
      id: uid(),
      bodyArea: draft.bodyArea.trim(),
      diagnosis: draft.diagnosis.trim(),
      symptoms: draft.symptoms.trim(),
      painScore: draft.painScore,
      aggravatingMovements: draft.aggravating
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      relievingMovements: draft.relieving
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      medicalRestrictions: draft.restrictions.trim(),
      onsetDate: null,
      professionalCare: draft.professionalCare,
      notes: draft.notes.trim(),
    };
    await saveProfile({ ...profile, injuries: [...own, entry] });
    touch();
    setDraft({
      bodyArea: "",
      diagnosis: "",
      symptoms: "",
      painScore: 0,
      aggravating: "",
      relieving: "",
      restrictions: "",
      professionalCare: false,
      notes: "",
    });
    onOpenChange(false);
  };

  const remove = async (id: string) => {
    await saveProfile({ ...profile, injuries: own.filter((i) => i.id !== id) });
    touch();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Injuries & limitations">
        <div className="flex flex-col gap-4">
          {/* Red flags first — always. */}
          <div className="flex flex-col gap-1">
            <Label className="flex items-center gap-1.5">
              <ShieldAlert className="size-4 text-danger" /> First: any of these right now?
            </Label>
            <div className="rounded-(--radius-card) border border-line bg-surface p-1">
              {RED_FLAGS.map((f) => (
                <CheckItem
                  key={f}
                  variant="toggle"
                  label={f}
                  checked={redFlags.has(f)}
                  onCheckedChange={(v) => {
                    const next = new Set(redFlags);
                    if (v) next.add(f);
                    else next.delete(f);
                    setRedFlags(next);
                  }}
                />
              ))}
            </div>
            {escalation.escalate && (
              <div className="flex items-start gap-3 rounded-(--radius-card) border border-danger/60 bg-danger/10 p-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
                <p className="text-sm leading-relaxed text-ivory">{escalation.message}</p>
              </div>
            )}
          </div>

          {/* Existing entries */}
          {(own.length > 0 || derived.length > 0) && (
            <div className="flex flex-col gap-1">
              <Label>On file — the plan builder works around these</Label>
              <div className="flex flex-col gap-1">
                {own.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 rounded-(--radius-control) bg-elevated px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ivory">{i.bodyArea}</p>
                      {i.aggravatingMovements.length > 0 && (
                        <p className="truncate text-xs text-muted">
                          aggravated by {i.aggravatingMovements.join(", ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${i.bodyArea}`}
                      onClick={() => void remove(i.id)}
                      className="flex size-9 items-center justify-center rounded-full text-muted active:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                {derived.map((i) => (
                  <div key={i.id} className="rounded-(--radius-control) bg-elevated px-3 py-2 opacity-80">
                    <p className="text-sm font-medium text-ivory">{i.bodyArea}</p>
                    <p className="text-xs text-muted">from your pain flags — manage in Settings</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Guided intake */}
          <div className="flex flex-col gap-3 border-t border-line pt-3">
            <Label className="text-gold">Add an injury or limitation</Label>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="in-area">Where is it?</Label>
              <Input
                id="in-area"
                placeholder="e.g. right knee, lower back, left shoulder"
                value={draft.bodyArea}
                onChange={(e) => setDraft({ ...draft, bodyArea: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="in-diag">Professional diagnosis, if you have one</Label>
              <Input
                id="in-diag"
                placeholder="only what a clinician told you — optional"
                value={draft.diagnosis}
                onChange={(e) => setDraft({ ...draft, diagnosis: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="in-symp">What does it feel like?</Label>
                <Input
                  id="in-symp"
                  placeholder="ache, sharp, stiff…"
                  value={draft.symptoms}
                  onChange={(e) => setDraft({ ...draft, symptoms: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="in-pain">Typical pain (0–10)</Label>
                <Input
                  id="in-pain"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="10"
                  value={draft.painScore}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      painScore: Math.min(10, Math.max(0, Math.round(Number(e.target.value) || 0))),
                    })
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="in-agg">What makes it worse? (comma-separated)</Label>
              <Input
                id="in-agg"
                placeholder="e.g. deep squats, overhead pressing, running"
                value={draft.aggravating}
                onChange={(e) => setDraft({ ...draft, aggravating: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="in-rel">What helps?</Label>
              <Input
                id="in-rel"
                placeholder="e.g. walking, heat, light rows"
                value={draft.relieving}
                onChange={(e) => setDraft({ ...draft, relieving: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="in-restrict">Restrictions from a clinician/PT</Label>
              <Input
                id="in-restrict"
                placeholder="e.g. no spinal compression for 6 weeks"
                value={draft.restrictions}
                onChange={(e) => setDraft({ ...draft, restrictions: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-2">
              <span className="text-sm text-ivory">Getting professional care for it</span>
              <Switch
                checked={draft.professionalCare}
                onCheckedChange={(v) => setDraft({ ...draft, professionalCare: v })}
                aria-label="Professional care"
              />
            </div>
            <p className="text-xs text-muted">
              This adapts your training around the limitation — it never treats it, and it never
              replaces a clinician, physical therapist, or athletic trainer.
            </p>
            <Button size="lg" disabled={!draft.bodyArea.trim()} onClick={save}>
              Save — build around it
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
