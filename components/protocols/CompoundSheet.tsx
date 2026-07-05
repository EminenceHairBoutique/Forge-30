"use client";

import { useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { publishedHalfLife } from "@/lib/data/protocolReference";
import { toISODate, uid } from "@/lib/utils";
import type { Compound, CompoundCategory, CompoundForm, ProtocolSchedule, SchedulePattern } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/**
 * Add/edit a prescribed compound + its schedule (v3 Phase 6). Every field is
 * transcription from the user's pharmacy label and prescriber instructions —
 * the sheet computes nothing except prefilling the published half-life for
 * the ESTIMATE curve (user-editable, from the reference table).
 */
export function CompoundSheet({
  open,
  onOpenChange,
  compound,
  schedule,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compound: Compound | null;
  schedule: ProtocolSchedule | null;
  onSaved: () => void;
}) {
  const { adapter } = useStorage();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CompoundCategory>("trt");
  const [form, setForm] = useState<CompoundForm>("injection");
  const [concentration, setConcentration] = useState("");
  const [concentrationUnit, setConcentrationUnit] = useState("mg/mL");
  const [vialVolume, setVialVolume] = useState("");
  const [halfLife, setHalfLife] = useState("");
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [pattern, setPattern] = useState<SchedulePattern>("weekly");
  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [timeOfDay, setTimeOfDay] = useState("08:00");

  useEffect(() => {
    if (!open) return;
    setName(compound?.name ?? "");
    setCategory(compound?.category ?? "trt");
    setForm(compound?.form ?? "injection");
    setConcentration(compound?.labelConcentration ? String(compound.labelConcentration) : "");
    setConcentrationUnit(compound?.concentrationUnit ?? "mg/mL");
    setVialVolume(compound?.vialVolumeMl ? String(compound.vialVolumeMl) : "");
    setHalfLife(compound?.halfLifeHours ? String(compound.halfLifeHours) : "");
    setExpiry(compound?.expiryDate ?? "");
    setNote(compound?.prescriberNote ?? "");
    setPattern(schedule?.pattern ?? "weekly");
    setDose(schedule?.dose ? String(schedule.dose) : "");
    setDoseUnit(schedule?.doseUnit ?? "mg");
    setTimeOfDay(schedule?.timeOfDay ?? "08:00");
  }, [open, compound, schedule]);

  // Prefill the published half-life when the name matches the reference
  // table and the field is empty — user-editable, estimate-only.
  const onNameChange = (v: string) => {
    setName(v);
    if (!halfLife) {
      const published = publishedHalfLife(v);
      if (published) setHalfLife(String(published));
    }
  };

  const save = async () => {
    if (!name.trim()) return;
    const compoundId = compound?.id ?? uid();
    await adapter.saveCompound({
      id: compoundId,
      name: name.trim(),
      category,
      form,
      labelConcentration: Number(concentration) > 0 ? Number(concentration) : null,
      concentrationUnit,
      vialVolumeMl: Number(vialVolume) > 0 ? Number(vialVolume) : null,
      halfLifeHours: Number(halfLife) > 0 ? Number(halfLife) : null,
      expiryDate: expiry || null,
      prescriberNote: note.trim(),
      createdAt: compound?.createdAt ?? new Date().toISOString(),
    });
    if (Number(dose) > 0) {
      await adapter.saveProtocolSchedule({
        id: schedule?.id ?? uid(),
        compoundId,
        pattern,
        timeOfDay,
        dose: Number(dose),
        doseUnit,
        startDate: schedule?.startDate ?? toISODate(),
        paused: schedule?.paused ?? false,
        resumeDate: schedule?.resumeDate ?? null,
      });
    }
    onSaved();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={compound ? "Edit compound" : "Add prescribed compound"}>
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-muted">
            Copy these from your pharmacy label and your prescriber&apos;s instructions — this
            is a record, and the app never changes it.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-name">Name (as on the label)</Label>
            <Input id="cp-name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Testosterone Cypionate" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-cat">Category</Label>
              <Select id="cp-cat" value={category} onChange={(e) => setCategory(e.target.value as CompoundCategory)}>
                <option value="trt">TRT</option>
                <option value="hgh">HGH</option>
                <option value="peptide">Peptide</option>
                <option value="glp1">GLP-1</option>
                <option value="ancillary">Ancillary</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-form">Form</Label>
              <Select id="cp-form" value={form} onChange={(e) => setForm(e.target.value as CompoundForm)}>
                <option value="injection">Injection</option>
                <option value="gel">Gel</option>
                <option value="patch">Patch</option>
                <option value="pellet">Pellet</option>
                <option value="oral">Oral</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-conc">Label concentration</Label>
              <Input id="cp-conc" type="number" inputMode="decimal" min="0" value={concentration} onChange={(e) => setConcentration(e.target.value)} placeholder="200" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-concu">Unit</Label>
              <Input id="cp-concu" value={concentrationUnit} onChange={(e) => setConcentrationUnit(e.target.value)} placeholder="mg/mL" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-vial">Vial volume (mL)</Label>
              <Input id="cp-vial" type="number" inputMode="decimal" min="0" value={vialVolume} onChange={(e) => setVialVolume(e.target.value)} placeholder="10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-exp">Expiry date</Label>
              <Input id="cp-exp" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-hl">Half-life (hours) — for the estimate curve only</Label>
            <Input id="cp-hl" type="number" inputMode="decimal" min="0" value={halfLife} onChange={(e) => setHalfLife(e.target.value)} placeholder="prefilled from published data when known" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-note">Prescriber instructions (verbatim)</Label>
            <Input id="cp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="as written on the label" />
          </div>

          <p className="microlabel mt-1 text-muted">Prescribed schedule</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-pattern">Frequency</Label>
              <Select id="cp-pattern" value={pattern} onChange={(e) => setPattern(e.target.value as SchedulePattern)}>
                <option value="daily">Daily</option>
                <option value="eod">Every other day</option>
                <option value="e3_5d">Twice weekly (3.5-day)</option>
                <option value="weekly">Weekly</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-time">Reminder time</Label>
              <Input id="cp-time" type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-dose">Prescribed dose</Label>
              <Input id="cp-dose" type="number" inputMode="decimal" min="0" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="100" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-doseu">Dose unit</Label>
              <Input id="cp-doseu" value={doseUnit} onChange={(e) => setDoseUnit(e.target.value)} placeholder="mg" />
            </div>
          </div>
          <Button size="lg" onClick={() => void save()} disabled={!name.trim()}>
            Save to record
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
