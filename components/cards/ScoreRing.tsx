"use client";

import { useEffect, useState } from "react";
import { Ring } from "./Ring";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { ForgeScoreResult, ScoreState } from "@/lib/engine/forgeScore";
import { cn, prefersReducedMotion } from "@/lib/utils";

/** Count-up + ring sweep on the final-score reveal (≤400ms, motion-safe). */
function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled || prefersReducedMotion() || target === 0) {
      setValue(target);
      return;
    }
    const duration = 400;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);
  return value;
}

/**
 * The hero Forge Score ring on Today. Tapping it opens the full score
 * breakdown (components earned + penalties applied). While the day is in
 * progress the ring reads "score so far" — a building number, not a verdict.
 */
export function ScoreRing({
  result,
  state = "final",
}: {
  result: ForgeScoreResult;
  state?: ScoreState;
}) {
  const { score, components, penalties } = result;
  const building = state === "inProgress";
  // The evening reveal: the finished day's score counts up as the ring sweeps.
  const shown = useCountUp(score, !building);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-gold/50 rounded-full"
          aria-label={`Forge Score ${score} out of 100${building ? " so far, day in progress" : ""} — tap for breakdown`}
        >
          <Ring value={shown} max={100} size={176} stroke={12} label={`Forge Score ${score}/100`}>
            <span className="display-num text-6xl leading-none text-ivory">{shown}</span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              {building ? "Score so far" : "Forge Score"}
            </span>
          </Ring>
          <span className="text-xs text-muted">
            {building ? "day in progress · tap for breakdown" : "tap for breakdown"}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent title={building ? `Score so far — ${score}/100` : `Forge Score ${score}/100`}>
        <ul className="flex flex-col gap-1">
          {components.map((c) => (
            <li key={c.key} className="flex items-center justify-between py-1.5 text-sm">
              <span className={cn(c.points > 0 ? "text-ivory" : "text-muted")}>{c.label}</span>
              <span
                className={cn(
                  "tabular font-semibold",
                  c.points >= c.max ? "text-success" : c.points > 0 ? "text-gold" : "text-muted"
                )}
              >
                {Math.round(c.points)}/{c.max}
              </span>
            </li>
          ))}
        </ul>
        {penalties.length > 0 && (
          <>
            <p className="mt-4 mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
              Penalties
            </p>
            <ul className="flex flex-col gap-1">
              {penalties.map((p) => (
                <li key={p.key} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-ivory">{p.label}</span>
                  <span className="tabular font-semibold text-danger">{p.points}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
