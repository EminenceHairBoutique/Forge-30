"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, ClipboardList, RotateCcw, Sparkles } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { ASSESSMENT_BANK, getAssessmentDef } from "@/lib/engine/assessments/bank";
import { compareResults, retakeDue } from "@/lib/engine/assessments/scoring";
import { buildPsycheReport } from "@/lib/engine/assessments/report";
import { notesForConsumer, themesForCoach, JOURNAL_ATTRIBUTION } from "@/lib/engine/journalRules";
import { DISCLAIMERS, NOT_A_DIAGNOSIS, confidenceNote } from "@/lib/engine/safetyCopy";
import { addDays, toISODate } from "@/lib/utils";
import type { AssessmentId, AssessmentResult } from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PaywallCard } from "@/components/cards/PaywallCard";
import { AssessmentRunner } from "@/components/assessments/AssessmentRunner";
import { ClusterBResultExtras } from "@/components/assessments/ClusterBResultExtras";
import { SupportResourcesCard } from "@/components/assessments/SupportResourcesCard";

export default function AssessmentsPage() {
  const { adapter, revision } = useStorage();
  const today = toISODate();
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [running, setRunning] = useState<AssessmentId | null>(null);
  const [detail, setDetail] = useState<AssessmentResult | null>(null);
  const [journalThemes, setJournalThemes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([adapter.listAssessmentResults(), adapter.getJournalConsent()]).then(
      async ([r, consent]) => {
        if (cancelled) return;
        setResults(r);
        // Journal → Psyche Report strictly through the E6 consent gate.
        if (consent.assessments) {
          const notes = await adapter.listJournalNotes(addDays(today, -13), today);
          if (!cancelled) {
            setJournalThemes(themesForCoach(notesForConsumer(notes, consent, "assessments")));
          }
        } else {
          setJournalThemes([]);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [adapter, today, revision]);

  const latestById = useMemo(() => {
    const map = new Map<string, AssessmentResult>();
    for (const r of results) map.set(r.assessmentId, r);
    return map;
  }, [results]);

  const previousOf = (result: AssessmentResult) =>
    [...results]
      .filter((r) => r.assessmentId === result.assessmentId && r.createdAt < result.createdAt)
      .pop() ?? null;

  const report = useMemo(() => buildPsycheReport(results, journalThemes), [results, journalThemes]);
  const detailDef = detail ? getAssessmentDef(detail.assessmentId) : undefined;
  const detailPrev = detail ? previousOf(detail) : null;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Assessments"
        subtitle="Structured self-portraits — educational, retakeable, never a verdict."
      />

      <PaywallCard
        feature="assessments"
        title="Self-insight assessments"
        description="Big Five, values, conflict, communication, and attachment patterns — scored on your device, tied into your coach."
      >
        <div className="flex flex-col gap-3">
          {ASSESSMENT_BANK.map((def) => {
            const latest = latestById.get(def.id);
            const due = latest ? retakeDue(latest.date, today) : false;
            return (
              <Card key={def.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle>{def.name}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted">{def.tagline}</p>
                  </div>
                  <Badge>{def.minutes} min</Badge>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  {latest ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setDetail(latest)}
                        className="min-w-0 flex-1 rounded-(--radius-control) bg-elevated px-3 py-2 text-left active:border-gold/50"
                      >
                        <span className="block text-xs text-muted">
                          Taken {latest.date} · {confidenceNote(latest.validity.confidenceLevel)}
                        </span>
                        <span className="block truncate text-sm text-ivory">
                          {latest.ranking
                            ? latest.ranking
                                .slice(0, 3)
                                .map((k) => def.rankItems?.find((i) => i.key === k)?.label ?? k)
                                .join(" · ")
                            : [...latest.traits]
                                .sort((a, b) => b.score - a.score)
                                .slice(0, 2)
                                .map((t) => `${t.label} ${t.score}`)
                                .join(" · ")}
                        </span>
                      </button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRunning(def.id)}
                        aria-label={`Retake ${def.name}`}
                      >
                        <RotateCcw className="size-4" />
                        {due ? "Retake" : ""}
                      </Button>
                    </>
                  ) : (
                    <Button className="flex-1" onClick={() => setRunning(def.id)}>
                      <ClipboardList className="size-4" /> Start
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Psyche Report */}
          <Card className={report.ready ? "border-gold/40 bg-gold/5" : undefined}>
            <CardHeader className="flex-row items-center gap-2">
              <Sparkles className="size-4 text-gold" />
              <CardTitle>Psyche Report</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!report.ready ? (
                <p className="text-sm text-muted">
                  Complete {report.remaining} more assessment{report.remaining === 1 ? "" : "s"} and
                  the unified report builds itself — one narrative across personality, values, and
                  how you handle friction.
                </p>
              ) : (
                <>
                  {report.sections.map((s) => (
                    <div key={s.heading}>
                      <p className="microlabel text-gold">
                        {s.heading}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ivory">{s.body}</p>
                    </div>
                  ))}
                  <div className="rounded-(--radius-control) border border-gold/30 bg-gold/5 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 microlabel text-gold">
                      <BookOpenCheck className="size-3.5" /> Growth plan
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {report.growthPlan.map((g) => (
                        <li key={g} className="text-sm leading-relaxed text-ivory">
                          · {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted">{confidenceNote(report.confidenceLevel)}</p>
                  {report.journalInformed && (
                    <p className="text-xs text-muted">{JOURNAL_ATTRIBUTION}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </PaywallCard>

      {/* Crisis routing + resources: outside the paywall, free at every tier,
          permanently (B-3 rule — safety features are never gated). */}
      <SupportResourcesCard />

      <p className="px-2 pb-2 text-center text-xs leading-relaxed text-muted">
        {DISCLAIMERS.mentalHealth}
      </p>

      {/* Result detail */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent title={detailDef?.name ?? "Result"}>
          {detail && detailDef && (
            <div className="flex flex-col gap-4">
              {detail.ranking ? (
                <ol className="flex flex-col gap-1.5">
                  {detail.ranking.map((k, i) => {
                    const item = detailDef.rankItems?.find((x) => x.key === k);
                    return (
                      <li key={k} className="rounded-(--radius-control) bg-elevated px-3 py-2">
                        <span className="text-sm font-semibold text-ivory">
                          {i + 1}. {item?.label ?? k}
                        </span>
                        <span className="block text-xs text-muted">{item?.blurb}</span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {detail.traits.map((t) => (
                    <div key={t.key}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-ivory">{t.label}</span>
                        <span className="tabular text-sm text-gold">{t.score}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated" aria-hidden>
                        <div className="h-full rounded-full bg-gold" style={{ width: `${t.score}%` }} />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{t.summary}</p>
                    </div>
                  ))}
                </div>
              )}

              {detailPrev && (
                <div className="rounded-(--radius-control) bg-elevated px-3 py-2.5">
                  <p className="microlabel text-muted">
                    Since last time
                  </p>
                  <p className="mt-1 text-sm text-ivory">
                    {compareResults(detailPrev, detail).framing}
                  </p>
                </div>
              )}

              {detail.assessmentId === "clusterB" && (
                <ClusterBResultExtras result={detail} journalThemes={journalThemes} />
              )}

              {detail.validity.notes.length > 0 && (
                <div className="rounded-(--radius-control) bg-elevated px-3 py-2.5">
                  <p className="microlabel text-muted">
                    {confidenceNote(detail.validity.confidenceLevel)}
                  </p>
                  {detail.validity.notes.map((n) => (
                    <p key={n} className="mt-1 text-xs leading-relaxed text-muted">
                      {n}
                    </p>
                  ))}
                </div>
              )}

              <p className="text-xs leading-relaxed text-muted">{detailDef.resultNote}</p>
              <p className="text-xs leading-relaxed text-muted">
                {NOT_A_DIAGNOSIS} If anything here connects to real distress, a licensed
                therapist or counselor is the right next step — this report can be a good
                conversation starter.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AssessmentRunner
        assessmentId={running}
        open={running !== null}
        onOpenChange={(o) => !o && setRunning(null)}
        onComplete={(r) => {
          setResults((prev) => [...prev, r]);
          setDetail(r);
        }}
      />
    </div>
  );
}
