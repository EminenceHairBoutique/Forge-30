"use client";

import { useEffect, useRef, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { getAssessmentDef } from "@/lib/engine/assessments/bank";
import { nextQuestion, scoreAssessment, visibleQuestions } from "@/lib/engine/assessments/scoring";
import { toISODate, uid } from "@/lib/utils";
import type { AssessmentId, AssessmentProgress, AssessmentResult } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TimedTaskItem } from "./TimedTaskItem";
import { SupportResourcesCard } from "./SupportResourcesCard";
import { supportTriggered } from "@/lib/engine/assessments/clusterB";

const LIKERT_LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

/**
 * Assessment runner (E10): one question at a time, answers saved after every
 * tap so closing the sheet never loses progress (resume exactly where you
 * left off). Response timing is captured for the disclosed validity system —
 * openly, like everything else here.
 */
export function AssessmentRunner({
  assessmentId,
  open,
  onOpenChange,
  onComplete,
  subject = "self",
}: {
  assessmentId: AssessmentId | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: AssessmentResult) => void;
  /** Couples passes (E11): who is answering this run. */
  subject?: "self" | "partner";
}) {
  const { adapter } = useStorage();
  const def = assessmentId ? getAssessmentDef(assessmentId) : undefined;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [ranking, setRanking] = useState<string[]>([]);
  const [timings, setTimings] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const shownAt = useRef(Date.now());

  // Resume saved progress when the sheet opens.
  useEffect(() => {
    if (!open || !assessmentId) return;
    setLoaded(false);
    adapter.getAssessmentProgress(assessmentId).then((saved) => {
      setAnswers(saved?.answers ?? {});
      setRanking(saved?.ranking ?? []);
      setTimings(saved?.timingsMs ?? []);
      setLoaded(true);
      shownAt.current = Date.now();
    });
  }, [open, assessmentId, adapter]);

  if (!def) return null;

  const persist = async (nextAnswers: Record<string, number>, nextRanking: string[], nextTimings: number[]) => {
    const progress: AssessmentProgress = {
      assessmentId: def.id,
      answers: nextAnswers,
      ranking: nextRanking,
      timingsMs: nextTimings,
      startedAt: new Date().toISOString(),
    };
    await adapter.saveAssessmentProgress(progress);
  };

  const finish = async (finalAnswers: Record<string, number>, finalRanking: string[], finalTimings: number[]) => {
    const result = {
      ...scoreAssessment({
        def,
        answers: finalAnswers,
        timingsMs: finalTimings,
        ranking: def.kind === "rank" ? finalRanking : undefined,
        id: uid(),
        date: toISODate(),
        createdAt: new Date().toISOString(),
      }),
      subject,
    };
    await adapter.saveAssessmentResult(result);
    await adapter.clearAssessmentProgress(def.id);
    setAnswers({});
    setRanking([]);
    setTimings([]);
    onComplete(result);
    onOpenChange(false);
  };

  const answer = async (value: number) => {
    const q = nextQuestion(def, answers);
    if (!q) return;
    const nextAnswers = { ...answers, [q.id]: value };
    // Timed items are *supposed* to be fast — their timings stay out of the
    // validity speed signal (B-2), so only likert/attention taps are logged.
    const nextTimings =
      q.kind === "timed" ? timings : [...timings, Date.now() - shownAt.current];
    shownAt.current = Date.now();
    setAnswers(nextAnswers);
    setTimings(nextTimings);
    if (nextQuestion(def, nextAnswers) === null) {
      await finish(nextAnswers, ranking, nextTimings);
    } else {
      await persist(nextAnswers, ranking, nextTimings);
    }
  };

  const pickRank = async (key: string) => {
    const nextRanking = [...ranking, key];
    setRanking(nextRanking);
    const total = def.rankItems?.length ?? 0;
    // Ranking the top half is enough signal; the rest keeps its shown order.
    if (nextRanking.length >= Math.min(5, total)) {
      await finish(answers, nextRanking, timings);
    } else {
      await persist(answers, nextRanking, timings);
    }
  };

  const current = def.kind === "likert" ? nextQuestion(def, answers) : null;
  const total = def.kind === "likert" ? visibleQuestions(def, answers).length : Math.min(5, def.rankItems?.length ?? 0);
  const done = def.kind === "likert" ? Object.keys(answers).length : ranking.length;
  const remainingRank = (def.rankItems ?? []).filter((i) => !ranking.includes(i.key));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={def.name}>
        {!loaded ? null : (
          <div className="flex flex-col gap-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-elevated" aria-hidden>
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{ width: `${Math.min(100, (done / Math.max(1, total)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted">
              {def.kind === "likert"
                ? `${done} of ~${total} · progress saves automatically`
                : `Pick your top ${total}, most important first (${done}/${total})`}
            </p>

            {/* Self-harm-adjacent routing (B-3): fires mid-run on an elevated
                flagged answer, stays visible, gated by nothing. */}
            {supportTriggered(def, answers) && <SupportResourcesCard />}

            {def.introNote && done === 0 && (
              <p className="rounded-(--radius-control) border border-gold/30 bg-gold/5 px-3 py-2.5 text-xs leading-relaxed text-ivory">
                {def.introNote}
              </p>
            )}

            {def.kind === "likert" && current && current.kind === "timed" && (
              <TimedTaskItem question={current} onScore={(s) => void answer(s)} />
            )}

            {def.kind === "likert" && current && current.kind !== "timed" && (
              <>
                <p className="min-h-16 text-base leading-relaxed text-ivory">{current.text}</p>
                <div className="flex flex-col gap-1.5">
                  {LIKERT_LABELS.map((label, i) => (
                    <Button
                      key={label}
                      variant="secondary"
                      size="lg"
                      className="justify-start"
                      onClick={() => void answer(i + 1)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </>
            )}

            {def.kind === "rank" && (
              <div className="flex flex-col gap-1.5">
                {ranking.length > 0 && (
                  <p className="text-xs text-gold">
                    {ranking
                      .map((k, i) => `${i + 1}. ${def.rankItems?.find((x) => x.key === k)?.label}`)
                      .join("   ")}
                  </p>
                )}
                {remainingRank.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => void pickRank(item.key)}
                    className="min-h-11 rounded-(--radius-control) border border-line bg-surface px-3 py-2 text-left active:border-gold/50"
                  >
                    <span className="block text-sm font-semibold text-ivory">{item.label}</span>
                    <span className="block text-xs text-muted">{item.blurb}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
