"use client";

import { Ring } from "./Ring";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { ForgeScoreResult, ScoreState } from "@/lib/engine/forgeScore";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { cn } from "@/lib/utils";

/**
 * The hero Forge Score gauge on Today (HUD treatment: 30 day-ticks, thin
 * outer track, gold glow only at the final state — the one rationed hero
 * glow). Tapping it opens the full score breakdown (components earned +
 * penalties applied). While the day is in progress the gauge reads as a
 * pulsing partial sweep — a building number, not a verdict.
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
  const shown = useCountUp(score, !building, 400);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-gold/50 rounded-full"
          aria-label={`Forge Score ${score} out of 100${building ? " so far, day in progress" : ""} — tap for breakdown`}
        >
          <Ring
            value={shown}
            max={100}
            size={176}
            stroke={12}
            ticks={30}
            majorEvery={3}
            glow={!building && score > 0}
            pulse={building && score > 0}
            label={`Forge Score ${score}/100`}
          >
            <span className="display-num text-6xl leading-none text-ivory">{shown}</span>
            <span className="microlabel mt-1 text-muted">
              {building ? "Score building" : "Forge Score"}
            </span>
            {building && <span className="microlabel mt-0.5 text-[9px] text-muted/70">Day in progress</span>}
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
