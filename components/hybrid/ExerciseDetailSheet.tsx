"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useStorage } from "@/lib/storage/provider";
import { hybridExerciseById } from "@/lib/data/hybridProgram";
import { progressionKindFor, suggestProgression } from "@/lib/engine/hybridTraining";
import type { WorkoutEntry } from "@/lib/types";

/**
 * Exercise-detail experience (HT Phase 7): the full movement record —
 * muscles, qualities, prescription, cues, mistakes, cautions, regression /
 * progression, substitutions, and this user's training history for the lift.
 */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/50 py-1.5 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right text-ivory">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="microlabel mb-1.5 text-muted">{title}</p>
      {children}
    </div>
  );
}

export function ExerciseDetailSheet({
  exerciseId,
  open,
  onOpenChange,
}: {
  exerciseId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { adapter } = useStorage();
  const [history, setHistory] = useState<WorkoutEntry[]>([]);
  const ex = exerciseId ? hybridExerciseById(exerciseId) : undefined;

  useEffect(() => {
    if (!open || !exerciseId) return;
    void adapter.listAllWorkouts().then((all) => {
      setHistory(
        all
          .filter((w) => w.exercises.some((e) => e.exerciseId === exerciseId && e.sets.length > 0))
          .slice(-5)
          .reverse()
      );
    });
  }, [adapter, open, exerciseId]);

  if (!ex) return null;

  const lastPerf = history[0]?.exercises.find((e) => e.exerciseId === ex.id);
  const prevPerf = history[1]?.exercises.find((e) => e.exerciseId === ex.id);
  const progression = suggestProgression(
    progressionKindFor(ex),
    ex.reps,
    (lastPerf?.sets ?? []).map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe, rir: s.rir })),
    (prevPerf?.sets ?? []).map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe, rir: s.rir }))
  );

  const rest = ex.restSeconds
    ? ex.restSeconds[0] === ex.restSeconds[1]
      ? `${ex.restSeconds[0]} s`
      : `${ex.restSeconds[0]}–${ex.restSeconds[1]} s`
    : "continuous";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={ex.name}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {ex.qualities.map((q) => (
              <Badge key={q} variant="gold">
                {q}
              </Badge>
            ))}
            {ex.explosive && <Badge variant="default">quality-first power</Badge>}
            {ex.cautions.map((c) => (
              <Badge key={c} variant="caution">
                caution: {c}
              </Badge>
            ))}
          </div>

          <p className="text-sm leading-relaxed text-ivory">{ex.explanation}</p>

          <div>
            <Row label="Primary" value={ex.primaryMuscles.join(", ")} />
            {ex.secondaryMuscles.length > 0 && <Row label="Secondary" value={ex.secondaryMuscles.join(", ")} />}
            <Row label="Pattern" value={ex.pattern} />
            <Row label="Prescription" value={`${ex.sets} × ${ex.reps}${ex.perSide ? " per side" : ""}`} />
            <Row label="Rest" value={rest} />
            {ex.tempo && <Row label="Tempo" value={ex.tempo} />}
            {ex.rpe && <Row label="Effort" value={`RPE ${ex.rpe}`} />}
            {ex.holdSeconds && <Row label="Hold" value={`${ex.holdSeconds} s`} />}
            <Row label="Equipment" value={ex.equipment} />
            <Row label="Difficulty" value={"●".repeat(ex.difficulty) + "○".repeat(3 - ex.difficulty)} />
          </div>

          {ex.setup && (
            <Section title="Setup">
              <p className="text-sm text-ivory">{ex.setup}</p>
            </Section>
          )}

          <Section title="How to perform">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ivory">
              {ex.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Section>

          {ex.breathing && (
            <Section title="Breathing">
              <p className="text-sm text-ivory">{ex.breathing}</p>
            </Section>
          )}

          <Section title="Cues">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ivory">
              {ex.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Section>

          <Section title="Common mistakes">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {ex.mistakes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Section>

          {(ex.regression || ex.progression) && (
            <div className="grid grid-cols-1 gap-2">
              {ex.regression && (
                <div className="rounded-(--radius-control) border border-line p-2.5 text-sm">
                  <span className="microlabel text-muted">Easier</span>
                  <p className="text-ivory">{ex.regression}</p>
                </div>
              )}
              {ex.progression && (
                <div className="rounded-(--radius-control) border border-line p-2.5 text-sm">
                  <span className="microlabel text-muted">Harder</span>
                  <p className="text-ivory">{ex.progression}</p>
                </div>
              )}
            </div>
          )}

          <Section title="Progression suggestion">
            <p className="text-sm text-ivory">{progression.detail}</p>
          </Section>

          {ex.substitutions.length > 0 && (
            <Section title="Substitutions">
              <div className="space-y-2">
                {ex.substitutions.map((s) => (
                  <div key={s.id} className="rounded-(--radius-control) border border-line p-2.5">
                    <p className="flex items-center justify-between text-sm font-semibold text-ivory">
                      {s.name}
                      <Badge variant="default">{s.kind}</Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{s.whySafer}</p>
                    <p className="text-xs text-muted">Preserves: {s.preservesGoal}</p>
                    <p className="text-xs text-muted">{s.injuryNotes}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {history.length > 0 && (
            <Section title="Your history">
              <div className="space-y-1.5">
                {history.map((w) => {
                  const perf = w.exercises.find((e) => e.exerciseId === ex.id);
                  if (!perf) return null;
                  const best = perf.sets.reduce(
                    (b, s) => (s.weight * s.reps > b.weight * b.reps ? s : b),
                    perf.sets[0]!
                  );
                  return (
                    <div key={w.id} className="flex justify-between text-sm">
                      <span className="text-muted">{w.date}</span>
                      <span className="text-ivory">
                        {perf.sets.length} sets · best {best.weight > 0 ? `${best.weight} × ` : ""}
                        {best.reps}
                        {best.rpe > 0 ? ` @ RPE ${best.rpe}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
