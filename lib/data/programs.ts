import type { ProgramId } from "@/lib/types";

/**
 * The 30-day program gallery (v3.3 §3.2) — three opinionated presets over
 * the same engine, plus "custom" (= exactly the pre-program behavior).
 * Programs bias defaults; they never lock anything: every knob stays
 * user-editable, and switching mid-cycle only affects future days.
 */

export interface ProgramDef {
  id: Exclude<ProgramId, "custom">;
  name: string;
  tagline: string;
  /** What the program changes, in plain language. */
  description: string;
  /** Builder bias: hard cap on session length. */
  maxSessionMinutes: 20 | 30 | 45 | 60 | 75 | 90;
  /** Builder bias: training-day ceiling. */
  maxDaysPerWeek: 2 | 3 | 4 | 5 | 6;
  /** Pain-aware: bias exercise selection/progression toward caution. */
  painAware: boolean;
  /** Nutrition emphasis: lead meal logging with quick-adds. */
  quickAddFirst: boolean;
}

export const PROGRAMS: ProgramDef[] = [
  {
    id: "first30",
    name: "First 30",
    tagline: "Your first 30 days, built on the Minimum Viable Day.",
    description:
      "For a first run or a return after years away: 3 short full-body sessions, generous rest, and targets that reward showing up. Nothing here assumes a training history.",
    maxSessionMinutes: 45,
    maxDaysPerWeek: 3,
    painAware: false,
    quickAddFirst: false,
  },
  {
    id: "comeback30",
    name: "Comeback 30",
    tagline: "Training around a body that has opinions.",
    description:
      "Pain-aware from day one: exercise selection respects your flagged areas, loads progress slower, and every session leaves room to stop early without losing the day.",
    maxSessionMinutes: 60,
    maxDaysPerWeek: 4,
    painAware: true,
    quickAddFirst: false,
  },
  {
    id: "busy30",
    name: "Busy 30",
    tagline: "Twenty-minute sessions, ten-second logging.",
    description:
      "Built for full calendars: sessions cap at 20 minutes, nutrition leans on quick-adds and search, and the Minimum Viable Day carries the streak on the worst days.",
    maxSessionMinutes: 20,
    maxDaysPerWeek: 4,
    painAware: false,
    quickAddFirst: true,
  },
];

export function programById(id: ProgramId): ProgramDef | null {
  return PROGRAMS.find((p) => p.id === id) ?? null;
}
