"use client";

import { useEffect, useRef, useState } from "react";
import { Ring } from "@/components/cards/Ring";
import { Button } from "@/components/ui/button";
import { timedItemScore } from "@/lib/engine/assessments/scoring";
import type { TimedQuestion } from "@/lib/engine/assessments/defs";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Timed mini-task renderer (Phase NEXT B-2): visible countdown (HUD ring, or
 * plain text under reduced motion), optional memorize phase for recall
 * tasks, multiple-choice answers. The 0–100 score is computed by the pure
 * `timedItemScore` the moment an option is tapped; running out of time
 * scores 0 and moves on — framed as data, never failure.
 */
export function TimedTaskItem({
  question,
  onScore,
}: {
  question: TimedQuestion;
  onScore: (score: number) => void;
}) {
  const [phase, setPhase] = useState<"memorize" | "answer">(
    question.memorize ? "memorize" : "answer"
  );
  const [remainingMs, setRemainingMs] = useState(question.timeLimitMs);
  const answerStart = useRef<number | null>(null);
  const answered = useRef(false);
  const reduced = prefersReducedMotion();

  // Memorize phase: flash the content, then flip to the answer phase.
  useEffect(() => {
    answered.current = false;
    setPhase(question.memorize ? "memorize" : "answer");
    setRemainingMs(question.timeLimitMs);
    if (!question.memorize) {
      answerStart.current = Date.now();
      return;
    }
    answerStart.current = null;
    const t = setTimeout(() => {
      setPhase("answer");
      answerStart.current = Date.now();
    }, question.memorizeMs ?? 3000);
    return () => clearTimeout(t);
  }, [question]);

  // Countdown + timeout → 0 and advance.
  useEffect(() => {
    if (phase !== "answer") return;
    const tick = setInterval(() => {
      const start = answerStart.current;
      if (start === null) return;
      const left = question.timeLimitMs - (Date.now() - start);
      setRemainingMs(Math.max(0, left));
      if (left <= 0 && !answered.current) {
        answered.current = true;
        clearInterval(tick);
        onScore(0);
      }
    }, 200);
    return () => clearInterval(tick);
  }, [phase, question, onScore]);

  const pick = (index: number) => {
    if (answered.current || phase !== "answer") return;
    answered.current = true;
    const elapsed = Date.now() - (answerStart.current ?? Date.now());
    onScore(timedItemScore(index === question.correctIndex, elapsed, question.timeLimitMs));
  };

  const seconds = Math.ceil(remainingMs / 1000);

  if (phase === "memorize") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="microlabel text-muted">Memorize</p>
        <p className="display-num text-3xl tracking-[0.2em] text-ivory">{question.memorize}</p>
        <p className="text-xs text-muted">Options appear in a moment…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-h-12 flex-1 text-base leading-relaxed text-ivory">{question.prompt}</p>
        {reduced ? (
          <span className="microlabel shrink-0 text-gold" aria-label={`${seconds} seconds left`}>
            {seconds}s
          </span>
        ) : (
          <Ring value={remainingMs} max={question.timeLimitMs} size={44} stroke={4} label={`${seconds} seconds left`}>
            <span className="microlabel text-gold">{seconds}</span>
          </Ring>
        )}
      </div>
      <div
        className={
          question.task === "patternGrid" || question.task === "symbolMatch"
            ? "grid grid-cols-2 gap-1.5"
            : "flex flex-col gap-1.5"
        }
      >
        {question.options.map((opt, i) => (
          <Button
            key={opt}
            variant="secondary"
            size="lg"
            className="justify-center font-semibold"
            onClick={() => pick(i)}
          >
            {opt}
          </Button>
        ))}
      </div>
      <p className="text-center text-[11px] text-muted">
        Out of time just scores the item and moves on — no penalty beyond it.
      </p>
    </div>
  );
}
