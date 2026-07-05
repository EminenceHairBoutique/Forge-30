"use client";

import { Ring } from "@/components/cards/Ring";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { HealthScoreResult } from "@/lib/engine/healthRules";

/**
 * The Health Score ring — same explainable pattern as the Forge Score ring:
 * tap for the component breakdown. Educational composite over what's
 * actually tracked (untracked inputs renormalize away); never diagnostic.
 */
export function HealthScoreRing({ result }: { result: HealthScoreResult }) {
  const { score, components } = result;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          aria-label={
            score === null
              ? "Health Score — no tracked inputs yet, tap for details"
              : `Health Score ${score} out of 100 — tap for breakdown`
          }
        >
          <Ring
            value={score ?? 0}
            max={100}
            size={148}
            stroke={10}
            ticks={30}
            majorEvery={3}
            gradient={["#ffd98a", "#ffb13d", "#ff6a3d"]}
            label={score === null ? "Health Score not started" : `Health Score ${score}/100`}
          >
            <span
              className={
                score === null
                  ? "display-num text-5xl leading-none text-muted"
                  : "display-num text-molten text-5xl leading-none"
              }
            >
              {score === null ? "—" : score}
            </span>
            <span className="mt-1 microlabel text-muted">
              Health Score
            </span>
          </Ring>
          <span className="text-xs text-muted">
            {score === null ? "log anything below to start" : "tap for breakdown"}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent title="Health Score breakdown">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            An educational composite of what you actually track — inputs you don’t track are
            left out and the rest re-balance, so missing gear never lowers the score. It
            describes habits and readings, never a medical status.
          </p>
          <ul className="flex flex-col gap-1.5">
            {components.map((c) => (
              <li
                key={c.key}
                className="flex items-center justify-between rounded-(--radius-control) bg-elevated px-3 py-2"
              >
                <span className={c.tracked ? "text-sm text-ivory" : "text-sm text-muted"}>
                  {c.label}
                </span>
                <span className="tabular text-sm font-semibold text-ivory">
                  {c.tracked ? `${c.points} / ${c.max}` : "not tracked"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
