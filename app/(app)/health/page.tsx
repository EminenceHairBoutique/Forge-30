"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Camera,
  FileText,
  HeartPulse,
  Printer,
  Stethoscope,
  Trash2,
  Watch,
} from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import {
  BP_CATEGORY_LABEL,
  buildHealthScoreInputs,
  calculateHealthScore,
  categorizeBloodPressure,
  doctorQuestions,
  markerStatus,
  summarizeBloodwork,
} from "@/lib/engine/healthRules";
import { DISCLAIMERS } from "@/lib/engine/safetyCopy";
import { flagEnabled } from "@/lib/flags";
import { addDays, cn, toISODate } from "@/lib/utils";
import type {
  BloodPressureEntry,
  BloodworkReport,
  DailyLog,
  HealthMarkerEntry,
} from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { HealthScoreRing } from "@/components/health/HealthScoreRing";
import { BloodPressureSheet } from "@/components/health/BloodPressureSheet";
import { BloodworkSheet } from "@/components/health/BloodworkSheet";
import { HealthMarkerSheet } from "@/components/health/HealthMarkerSheet";

/** Category chip tone — warning/danger are earned here (genuine safety signal). */
const BP_TONE: Record<string, string> = {
  normal: "border-success/50 bg-success/15 text-success",
  elevated: "border-line bg-elevated text-muted",
  stage1: "border-danger/40 bg-safety text-danger",
  stage2: "border-danger/50 bg-safety text-danger",
  crisis: "border-danger bg-safety text-danger",
};

/** Doctor-ready print export: a clean same-origin print window. */
function printReport(report: BloodworkReport) {
  const summary = summarizeBloodwork(report);
  const questions = doctorQuestions(report);
  const rows = report.markers
    .map((m) => {
      const status = markerStatus(m);
      const flag =
        status === "aboveRange" ? "HIGH" : status === "belowRange" ? "LOW" : status === "inRange" ? "in range" : "";
      return `<tr><td>${m.name}</td><td>${m.value} ${m.unit}</td><td>${m.refLow ?? "—"}–${m.refHigh ?? "—"}</td><td>${flag}</td></tr>`;
    })
    .join("");
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Bloodwork — ${report.date}</title>
<style>
  body { font: 13px/1.5 -apple-system, system-ui, sans-serif; color: #111; margin: 40px; }
  h1 { font-size: 18px; } h2 { font-size: 14px; margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f3f3; }
  .muted { color: #555; font-size: 12px; }
  ul { padding-left: 18px; }
</style></head><body>
<h1>Bloodwork report — ${report.date}${report.labName ? ` · ${report.labName}` : ""}</h1>
<p class="muted">Prepared with Forge30 for discussion with a clinician. Educational only — not a diagnosis.</p>
<table><thead><tr><th>Marker</th><th>Value</th><th>Reference</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>Summary</h2><ul>${summary.lines.map((l) => `<li>${l}</li>`).join("")}</ul>
<h2>Questions for the visit</h2><ul>${questions.map((q) => `<li>${q}</li>`).join("")}</ul>
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

export default function HealthPage() {
  const { adapter, profile, revision } = useStorage();
  const today = toISODate();
  const windowStart = addDays(today, -13);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [bp, setBp] = useState<BloodPressureEntry[]>([]);
  const [markers, setMarkers] = useState<HealthMarkerEntry[]>([]);
  const [reports, setReports] = useState<BloodworkReport[]>([]);
  const [bpOpen, setBpOpen] = useState(false);
  const [bwOpen, setBwOpen] = useState(false);
  const [hmOpen, setHmOpen] = useState(false);
  const [detail, setDetail] = useState<BloodworkReport | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    Promise.all([
      adapter.listDailyLogs(windowStart, today),
      adapter.listBloodPressure(addDays(today, -29), today),
      adapter.listHealthMarkers(windowStart, today),
      adapter.listBloodwork(),
    ]).then(([l, b, m, r]) => {
      if (cancelled) return;
      setLogs(l);
      setBp(b);
      setMarkers(m);
      setReports(r);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, profile, windowStart, today, revision]);

  const scoreResult = useMemo(() => {
    if (!profile) return null;
    return calculateHealthScore(
      buildHealthScoreInputs({
        logs,
        bp,
        markers,
        reports,
        calorieTarget: profile.calorieTarget,
        proteinTarget: profile.proteinTarget,
      })
    );
  }, [profile, logs, bp, markers, reports]);

  if (!profile) return null;

  const latestBp = bp[bp.length - 1];
  const latestMarkers = markers[markers.length - 1];
  const detailSummary = detail ? summarizeBloodwork(detail) : null;
  const detailQuestions = detail ? doctorQuestions(detail) : [];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader title="Health" subtitle="Readings and markers, in context — never a diagnosis." />

      {scoreResult && (
        <div className="flex flex-col items-center py-1">
          <HealthScoreRing result={scoreResult} />
        </div>
      )}

      {/* Blood pressure */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="size-4 text-gold" /> Blood pressure
          </CardTitle>
          <Button size="sm" onClick={() => setBpOpen(true)}>
            Log reading
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {latestBp ? (
            <>
              <div className="flex items-baseline gap-3">
                <p className="display-num text-3xl text-ivory">
                  {latestBp.systolic}/{latestBp.diastolic}
                </p>
                {latestBp.pulse !== null && (
                  <span className="text-sm text-muted">pulse {latestBp.pulse}</span>
                )}
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    BP_TONE[categorizeBloodPressure(latestBp.systolic, latestBp.diastolic)]
                  )}
                >
                  {BP_CATEGORY_LABEL[categorizeBloodPressure(latestBp.systolic, latestBp.diastolic)]}
                </span>
              </div>
              <p className="text-xs text-muted">
                {latestBp.date} {latestBp.time}
                {latestBp.caffeine || latestBp.exercise || latestBp.stress
                  ? ` · context: ${[
                      latestBp.caffeine && "caffeine",
                      latestBp.exercise && "exercise",
                      latestBp.stress && "stress",
                    ]
                      .filter(Boolean)
                      .join(", ")}`
                  : ""}
              </p>
              {bp.length > 1 && (
                <div className="flex flex-col gap-1 border-t border-line pt-2">
                  {bp
                    .slice(-6, -1)
                    .reverse()
                    .map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted">
                          {e.date} {e.time}
                        </span>
                        <span className="tabular text-ivory">
                          {e.systolic}/{e.diastolic}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">
              No readings yet. Seated, rested, arm supported — patterns beat single numbers.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Fitness markers */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4 text-gold" /> Fitness markers
          </CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setHmOpen(true)}>
            Log markers
          </Button>
        </CardHeader>
        <CardContent>
          {latestMarkers ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ["Resting HR", latestMarkers.restingHR, "bpm"],
                  ["HRV", latestMarkers.hrv, "ms"],
                  ["Cardio", latestMarkers.cardioMinutes, "min"],
                  ["Zone 2", latestMarkers.zone2Minutes, "min"],
                  ["Grip", latestMarkers.gripStrengthLb, "lb"],
                  ["Push-ups", latestMarkers.pushUps, ""],
                  ["Plank", latestMarkers.plankSec, "s"],
                  ["Mile", latestMarkers.mileTimeSec, "s"],
                  ["Body fat", latestMarkers.bodyFatPct, "%"],
                ] as const
              )
                .filter(([, v]) => v !== null)
                .map(([label, v, unit]) => (
                  <div key={label} className="rounded-(--radius-control) bg-elevated px-2 py-2">
                    <p className="display-num text-lg text-ivory">
                      {v}
                      <span className="text-xs text-muted"> {unit}</span>
                    </p>
                    <p className="microlabel text-muted">
                      {label}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Grip, push-ups, plank, mile time, resting HR — log what you measure, skip the rest.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bloodwork */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="size-4 text-gold" /> Bloodwork
          </CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setBwOpen(true)}>
            Add report
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {reports.length === 0 ? (
            <p className="text-sm text-muted">
              Paste a panel from your lab portal — the parser reads the common formats and keeps
              your lab&apos;s own reference ranges.
            </p>
          ) : (
            reports.map((r) => {
              const s = summarizeBloodwork(r);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDetail(r)}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-(--radius-control) bg-elevated px-3 py-2 text-left active:border-gold/50"
                >
                  <span className="flex items-center gap-2 text-sm text-ivory">
                    <FileText className="size-4 text-gold" />
                    {r.date}
                    {r.labName ? ` · ${r.labName}` : ""}
                  </span>
                  <Badge variant={s.outOfRange.length > 0 ? "default" : "success"}>
                    {s.outOfRange.length > 0
                      ? `${s.outOfRange.length} out of range`
                      : "all in range"}
                  </Badge>
                </button>
              );
            })
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled className="w-full">
              <Camera className="size-4" /> PDF / photo
              <Badge className="ml-1">{flagEnabled("bloodworkUpload") ? "beta" : "soon"}</Badge>
            </Button>
            <Button variant="outline" disabled className="w-full">
              <Watch className="size-4" /> Wearables
              <Badge className="ml-1">{flagEnabled("wearables") ? "beta" : "soon"}</Badge>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="px-2 pb-2 text-center text-xs leading-relaxed text-muted">
        {DISCLAIMERS.health}
      </p>

      {/* Report detail */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent title={detail ? `Bloodwork — ${detail.date}` : "Bloodwork"}>
          {detail && detailSummary && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                {detail.markers.map((m, i) => {
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
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          status === "inRange"
                            ? "text-success"
                            : status === "noRange"
                              ? "text-muted"
                              : "text-danger"
                        )}
                      >
                        {status === "inRange"
                          ? "in range"
                          : status === "aboveRange"
                            ? "above"
                            : status === "belowRange"
                              ? "below"
                              : "no range"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-(--radius-control) border border-gold/25 bg-gold/5 px-3 py-2.5">
                <p className="microlabel text-gold">
                  What this says (and doesn&apos;t)
                </p>
                {detailSummary.lines.map((line) => (
                  <p key={line} className="mt-1 text-sm leading-relaxed text-ivory">
                    {line}
                  </p>
                ))}
              </div>

              <div>
                <p className="microlabel text-muted">
                  Questions for your clinician
                </p>
                <ul className="mt-1 flex flex-col gap-1.5">
                  {detailQuestions.map((q) => (
                    <li key={q} className="text-sm leading-relaxed text-ivory">
                      · {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => printReport(detail)}>
                  <Printer className="size-4" /> Print / save PDF
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Delete report"
                  onClick={async () => {
                    await adapter.deleteBloodwork(detail.id);
                    setDetail(null);
                    setReports(reports.filter((r) => r.id !== detail.id));
                  }}
                >
                  <Trash2 className="size-5" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <BloodPressureSheet open={bpOpen} onOpenChange={setBpOpen} />
      <BloodworkSheet open={bwOpen} onOpenChange={setBwOpen} />
      <HealthMarkerSheet open={hmOpen} onOpenChange={setHmOpen} />
    </div>
  );
}
