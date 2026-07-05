"use client";

import { Flame, Snowflake } from "lucide-react";
import type { StreakState } from "@/lib/types";

/**
 * The consistency flame that sits above the Forge Score ring. Streaks measure
 * showing up, never quality — so this is always warm/neutral: gold when lit,
 * muted when the run is at zero, with banked freezes shown as snowflakes. No
 * warning color ever (adherence-neutral rule).
 */
export function StreakFlame({ streak }: { streak: StreakState }) {
  const lit = streak.current > 0;
  const label = lit
    ? `${streak.current}-day Minimum Viable Day streak${
        streak.atRisk ? ", log today to keep it" : ""
      }${streak.freezes > 0 ? `, ${streak.freezes} freeze${streak.freezes > 1 ? "s" : ""} banked` : ""}`
    : "No active streak — today starts a fresh one";

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-line bg-elevated px-3 py-1.5"
      aria-label={label}
    >
      <Flame className={lit ? "size-4 text-gold" : "size-4 text-muted"} aria-hidden />
      <span className="text-sm font-semibold text-ivory">
        {lit ? `${streak.current}-day streak` : "Start your streak"}
      </span>
      {streak.atRisk && (
        <span className="text-[11px] font-medium text-muted">· log today to keep it</span>
      )}
      {streak.freezes > 0 && (
        <span className="flex items-center gap-0.5" aria-hidden>
          {Array.from({ length: streak.freezes }).map((_, i) => (
            <Snowflake key={i} className="size-3 text-[#4C86D8]" />
          ))}
        </span>
      )}
    </div>
  );
}
