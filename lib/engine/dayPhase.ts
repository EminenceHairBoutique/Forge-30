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

import type { DailyLog } from "@/lib/types";
import type { ScoreState } from "./forgeScore";

export interface MvdStatus {
  met: boolean;
  /** Human, neutral description of what's still open (empty when met). */
  remaining: string[];
}

/** Default Minimum Viable Day: one meal logged + the daily mind check-in. */
export function mvdStatus(log: Pick<DailyLog, "calories" | "protein" | "journalDone">): MvdStatus {
  const mealLogged = log.calories > 0 || log.protein > 0;
  const remaining: string[] = [];
  if (!mealLogged) remaining.push("log one meal");
  if (!log.journalDone) remaining.push("do the 2-minute check-in");
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
