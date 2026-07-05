/**
 * Daily ritual logic (expansion plan E2) — pure decisions about which ritual
 * surface Today shows and whether the Minimum Viable Day is met.
 *
 * The MVD is the adherence-neutral floor: on a hard day, one meal logged plus
 * the daily check-in still counts as showing up. Perfection is measured by
 * the Forge Score; consistency is measured by the MVD/streaks — never
 * conflated (spec §Core UX Principles 4). The default definition below
 * becomes user-configurable in E5.
 */

import type { DailyLog, MvdDefinition } from "@/lib/types";
import { DEFAULT_MVD } from "@/lib/data/defaults";
import type { ScoreState } from "./forgeScore";

export interface MvdStatus {
  met: boolean;
  /** Human, neutral description of what's still open (empty when met). */
  remaining: string[];
}

export type MvdLog = Pick<
  DailyLog,
  "calories" | "protein" | "journalDone" | "waterMl" | "workoutStatus" | "steps"
>;

/**
 * Minimum Viable Day, against the user's own definition (E5) — default: one
 * meal + the check-in. A definition with every part unchecked falls back to
 * the default: an empty MVD would be trivially met and hollow out the streak.
 */
export function mvdStatus(log: MvdLog, def: MvdDefinition = DEFAULT_MVD): MvdStatus {
  const active = def.meal || def.checkIn || def.water || def.movement ? def : DEFAULT_MVD;
  const remaining: string[] = [];
  if (active.meal && !(log.calories > 0 || log.protein > 0)) remaining.push("log one meal");
  if (active.checkIn && !log.journalDone) remaining.push("do the 2-minute check-in");
  if (active.water && !(log.waterMl > 0)) remaining.push("log some water");
  if (
    active.movement &&
    !(log.workoutStatus === "complete" || log.workoutStatus === "rest" || log.steps > 0)
  ) {
    remaining.push("move a little — any workout or a walk");
  }
  return { met: remaining.length === 0, remaining };
}

/**
 * Morning Plan: shown once per day, while the day is still in progress.
 * Dismissal persists on the log (`morningPlanSeen`).
 */
export function shouldShowMorningPlan(
  log: Pick<DailyLog, "morningPlanSeen">,
  scoreState: ScoreState
): boolean {
  return scoreState === "inProgress" && !log.morningPlanSeen;
}

/**
 * Evening Review: shown after the day boundary until the day's review has
 * been generated — the moment the "in progress" score resolves into a
 * finished day.
 */
export function shouldShowEveningReview(scoreState: ScoreState, hasReview: boolean): boolean {
  return scoreState === "final" && !hasReview;
}
