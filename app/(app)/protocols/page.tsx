"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Lock, Plus, Syringe } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import {
  dueToday,
  estimatedLevelCurve,
  suggestNextSite,
  vialInventory,
} from "@/lib/engine/protocols";
import { buildDoctorReport } from "@/lib/engine/protocolReport";
import { CURVE_DISCLAIMER, PROTOCOL_DISCLAIMER } from "@/lib/data/protocolReference";
import { addDays, toISODate, uid } from "@/lib/utils";
import type {
  Compound,
  DoseEvent,
  LabPanel,
  ProtocolSchedule,
  ProtocolSettings,
} from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendChart } from "@/components/charts/TrendChart";
import { BodyMap } from "@/components/protocols/BodyMap";
import { CompoundSheet } from "@/components/protocols/CompoundSheet";
import { LabsSection } from "@/components/protocols/LabsSection";
import { siteStatuses } from "@/lib/engine/protocols";

/**
 * Protocols (v3 Phase 6) — a patient record for prescribed therapy, on the
 * quiet instrument register: microlabels and data, no molten celebration,
 * no glow. The §6.0 rails hold everywhere: nothing here suggests,
 * calculates, or adjusts anything; the record belongs to the user and
 * their prescriber.
 */
export default function ProtocolsPage() {
  const { adapter, revision, touch } = useStorage();
  const today = toISODate();
  const [settings, setSettings] = useState<ProtocolSettings | null>(null);
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [schedules, setSchedules] = useState<ProtocolSchedule[]>([]);
  const [doses, setDoses] = useState<DoseEvent[]>([]);
  const [labs, setLabs] = useState<LabPanel[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Compound | null>(null);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [curveCompoundId, setCurveCompoundId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [s, cs, sch, ds, lp] = await Promise.all([
      adapter.getProtocolSettings(),
      adapter.listCompounds(),
      adapter.listProtocolSchedules(),
      adapter.listDoseEvents(addDays(toISODate(), -90), toISODate()),
      adapter.listLabPanels(),
    ]);
    setSettings(s);
    setCompounds(cs);
    setSchedules(sch);
    setDoses(ds);
    setLabs(lp);
  }, [adapter]);

  useEffect(() => {
    void reload();
  }, [reload, revision]);

  const due = useMemo(
    () => dueToday(schedules, compounds, doses, today),
    [schedules, compounds, doses, today]
  );
  const statuses = useMemo(() => siteStatuses(doses, today), [doses, today]);
  const suggested = useMemo(
    () => (doses.length || compounds.length ? suggestNextSite(doses, today) : null),
    [doses, compounds.length, today]
  );

  const logDose = async (compound: Compound, schedule: ProtocolSchedule) => {
    await adapter.saveDoseEvent({
      id: uid(),
      compoundId: compound.id,
      scheduleId: schedule.id,
      dose: schedule.dose,
      doseUnit: schedule.doseUnit,
      route: compound.form === "injection" ? "injection" : compound.form,
      site: compound.form === "injection" ? (selectedSite ?? suggested?.siteId ?? "") : "",
      timestamp: new Date().toISOString(),
      note: "",
    });
    setSelectedSite(null);
    touch();
  };

  const unlock = async () => {
    setLockError(null);
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          userVerification: "required",
          timeout: 60000,
        },
      });
      setUnlocked(true);
    } catch {
      setLockError("Unlock didn't complete — try again.");
    }
  };

  const openReport = () => {
    const report = buildDoctorReport({
      compounds,
      schedules,
      doses,
      labs,
      symptoms: [],
      from: addDays(today, -90),
      to: today,
      generatedAt: new Date().toISOString(),
    });
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const esc = (s: string) => s.replace(/</g, "&lt;");
    w.document.write(`<!doctype html><html><head><title>Forge30 — Protocol report</title>
      <style>body{font:13px/1.5 -apple-system,system-ui,sans-serif;color:#111;margin:32px;max-width:720px}
      h1{font-size:20px}h2{font-size:14px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}
      table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border:1px solid #ddd;padding:4px 8px;text-align:left;font-size:12px}
      .muted{color:#555;font-size:11px}</style></head><body>
      <h1>Protocol report — ${report.windowFrom} to ${report.windowTo}</h1>
      <p class="muted">Generated ${new Date(report.generatedAt).toLocaleString()} · patient-kept record</p>
      <h2>Prescribed protocol</h2>
      <table><tr><th>Compound</th><th>Category</th><th>Schedule</th><th>Prescriber note</th></tr>
      ${report.protocol.map((p) => `<tr><td>${esc(p.compound)}</td><td>${p.category}</td><td>${esc(p.schedule)}</td><td>${esc(p.prescriberNote)}</td></tr>`).join("")}</table>
      <h2>Adherence</h2>
      <p>${report.loggedCount} of ${report.scheduledCount} scheduled administrations logged${report.adherencePercent !== null ? ` (${report.adherencePercent}%)` : ""}.</p>
      <h2>Site rotation</h2>
      <table><tr><th>Site</th><th>Last used</th><th>Uses (90d)</th></tr>
      ${report.rotation.map((r) => `<tr><td>${esc(r.site)}</td><td>${r.lastUsed}</td><td>${r.uses}</td></tr>`).join("")}</table>
      <h2>Labs</h2>
      ${report.labs
        .map(
          (p) => `<p><strong>${p.date}</strong> ${esc(p.source)}</p>
      <table><tr><th>Marker</th><th>Value</th><th>Range</th><th>Status</th></tr>
      ${p.markers.map((m) => `<tr><td>${esc(m.name)}</td><td>${m.value}</td><td>${m.range}</td><td>${m.status}</td></tr>`).join("")}</table>`
        )
        .join("")}
      <h2>Dose log</h2>
      <table><tr><th>Date</th><th>Compound</th><th>Dose</th><th>Site</th></tr>
      ${report.doses.slice(0, 60).map((d) => `<tr><td>${d.date}</td><td>${esc(d.compound)}</td><td>${d.dose}</td><td>${d.site}</td></tr>`).join("")}</table>
      <p class="muted">${esc(report.disclaimer)}</p>
      </body></html>`);
    w.document.close();
    w.print();
  };

  if (settings && !settings.enabled) {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <PageHeader title="Protocols" subtitle="Not enabled" />
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted">
              Protocol tracking is off. Turn it on in{" "}
              <Link href="/settings" className="text-gold underline">
                Settings
              </Link>{" "}
              if you track a prescribed therapy.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (settings?.lockEnabled && !unlocked) {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <PageHeader title="Protocols" subtitle="Locked" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Lock className="size-8 text-muted" />
            <p className="text-sm text-muted">This section is protected on this device.</p>
            <Button variant="secondary" onClick={() => void unlock()}>
              Unlock
            </Button>
            {lockError && <p className="text-sm text-muted">{lockError}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  const curveCompound = compounds.find((c) => c.id === (curveCompoundId ?? compounds[0]?.id));
  const curve = curveCompound
    ? estimatedLevelCurve(curveCompound, doses, addDays(today, -30), addDays(today, 7))
    : [];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Protocols"
        subtitle="Your prescribed-therapy record"
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="size-4" /> Add compound
          </Button>
        }
      />

      {/* Due today — the one-tap log path (<5s). */}
      {due.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Syringe className="size-4 text-gold" /> Scheduled today
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {due.map(({ schedule, compound, logged }) => (
              <div
                key={schedule.id}
                className="flex min-h-11 items-center justify-between gap-3 rounded-(--radius-control) border border-line bg-elevated px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ivory">{compound.name}</p>
                  <p className="text-xs text-muted tabular">
                    {schedule.dose} {schedule.doseUnit} · {schedule.timeOfDay}
                  </p>
                </div>
                {logged ? (
                  <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                    logged
                  </span>
                ) : (
                  <Button size="sm" onClick={() => void logDose(compound, schedule)}>
                    Log dose
                  </Button>
                )}
              </div>
            ))}
            {suggested && (
              <p className="text-xs text-muted">
                Most-rested site: {suggested.label}. Tap a site below to use a different one.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compounds + inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Compounds on record</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {compounds.length === 0 && (
            <p className="text-sm text-muted">
              Add your prescribed compounds from the pharmacy label to start the record.
            </p>
          )}
          {compounds.map((c) => {
            const schedule = schedules.find((s) => s.compoundId === c.id) ?? null;
            const inv = vialInventory(c, schedule, doses, today);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setEditing(c);
                  setSheetOpen(true);
                }}
                className="flex min-h-11 items-center justify-between gap-3 rounded-(--radius-control) border border-line bg-elevated px-3 py-2 text-left active:border-gold/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ivory">{c.name}</p>
                  <p className="text-xs text-muted tabular">
                    {c.category.toUpperCase()}
                    {inv.remainingMl !== null && ` · ${inv.remainingMl} mL left`}
                    {inv.dosesRemaining !== null && ` (~${inv.dosesRemaining} doses)`}
                    {inv.daysToExpiry !== null && inv.daysToExpiry <= 30 && ` · expires in ${inv.daysToExpiry}d`}
                  </p>
                </div>
                {inv.lowSupply && (
                  <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
                    low supply
                  </span>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Site rotation */}
      {compounds.some((c) => c.form === "injection") && (
        <Card>
          <CardHeader>
            <CardTitle>Injection sites</CardTitle>
          </CardHeader>
          <CardContent>
            <BodyMap
              statuses={statuses}
              suggestedSiteId={suggested?.siteId ?? null}
              selectedSiteId={selectedSite}
              onSelect={setSelectedSite}
            />
          </CardContent>
        </Card>
      )}

      {/* Estimated level curve */}
      {curveCompound && curve.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Estimated level</CardTitle>
            {compounds.length > 1 && (
              <select
                aria-label="Curve compound"
                className="min-h-11 rounded-(--radius-control) border border-line bg-elevated px-2 text-sm text-ivory"
                value={curveCompound.id}
                onChange={(e) => setCurveCompoundId(e.target.value)}
              >
                {compounds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="microlabel text-muted">Estimate — not a measurement</p>
            <TrendChart
              data={curve.map((p) => ({ label: p.date.slice(5), a: p.level }))}
              seriesA={`${curveCompound.name} (est.)`}
              height={160}
            />
            <p className="text-xs leading-relaxed text-muted">{CURVE_DISCLAIMER}</p>
          </CardContent>
        </Card>
      )}

      <LabsSection panels={labs} onChanged={() => touch()} />

      {/* Doctor report — free at every tier, the safety story in one file. */}
      <Button variant="secondary" className="w-full" onClick={openReport} disabled={compounds.length === 0}>
        <FileText className="size-4 text-gold" /> Doctor report (print / PDF)
      </Button>

      <p className="px-2 pb-2 text-center text-xs leading-relaxed text-muted">{PROTOCOL_DISCLAIMER}</p>

      <CompoundSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        compound={editing}
        schedule={editing ? (schedules.find((s) => s.compoundId === editing.id) ?? null) : null}
        onSaved={() => touch()}
      />
    </div>
  );
}
