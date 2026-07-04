import type { ConflictDebrief, TomorrowPlan, UserProfile, WeeklySummary } from "@/lib/types";
import { summarizeWeek } from "./weeklySummary";
import type { JournalSummary } from "./journalRules";
import { JOURNAL_ATTRIBUTION } from "./journalRules";
import { debriefSupport } from "./relationshipRules";
import type { DetectedPattern } from "./lifeGraph";
import { formatMoney } from "@/lib/utils";

/**
 * Coach mode architecture (E15). Every mode is deterministic and works with
 * zero API key — each generator maps existing engine output into the same
 * {label, text} section shape the coach page renders. The Daily Review mode
 * keeps its existing mock/live pair; these modes never call the network.
 */

export type CoachModeId =
  | "dailyReview"
  | "weeklyReview"
  | "tomorrowPlan"
  | "hardDay"
  | "relationshipDebrief"
  | "journalReflection"
  | "patternReview";

export interface CoachModeDef {
  id: CoachModeId;
  label: string;
  /** One-line explanation shown in the mode picker. */
  description: string;
  /** Where the mode's full flow lives when the coach view is a doorway. */
  href?: string;
}

export const COACH_MODES: CoachModeDef[] = [
  { id: "dailyReview", label: "Daily review", description: "The honest read on today's log." },
  { id: "weeklyReview", label: "Weekly review", description: "Seven days in one picture." },
  { id: "tomorrowPlan", label: "Tomorrow plan", description: "Set tomorrow's intent tonight." },
  {
    id: "hardDay",
    label: "Hard day",
    description: "Collapse today to the minimum viable day.",
    href: "/today",
  },
  {
    id: "relationshipDebrief",
    label: "Relationship debrief",
    description: "Work through a conflict calmly.",
    href: "/relationships",
  },
  {
    id: "journalReflection",
    label: "Journal reflection",
    description: "Themes from your journal — with your consent.",
  },
  {
    id: "patternReview",
    label: "Pattern review",
    description: "Cross-domain co-occurrences from your own logs.",
  },
];

export interface ModeSection {
  label: string;
  text: string;
}

/** Weekly Review: the weekly summary rendered in the coach's voice. */
export function weeklyReviewMode(
  summary: WeeklySummary | null,
  profile: UserProfile
): ModeSection[] {
  if (!summary || summary.avgForgeScore === 0) {
    return [
      {
        label: "This week",
        text: "Not enough logged days yet for a weekly read. Log a few days and this becomes a real review.",
      },
    ];
  }
  return [
    {
      label: "The week in one read",
      text: summarizeWeek(summary, profile),
    },
    {
      label: "The numbers",
      text: `Average score ${summary.avgForgeScore}/100 · ${summary.avgCalories.toLocaleString()} kcal and ${summary.avgProtein}g protein a day · workouts ${summary.workoutCompletionPct}% · ${formatMoney(summary.spendingTotal)} spent this week.`,
    },
    {
      label: "Most-missed habit",
      text: `${summary.mostMissedHabit} — one habit, not a verdict. Pick the smallest version of it and run that this week.`,
    },
  ];
}

/** Tomorrow Plan: tonight's two-minute intention, read back. */
export function tomorrowPlanMode(plan: TomorrowPlan | null): ModeSection[] {
  if (!plan) {
    return [
      {
        label: "No plan yet",
        text: "Tomorrow doesn't have a plan yet. Two minutes tonight — one focus line, intended meals, a spending intention — makes tomorrow start decided instead of improvised. Use the Plan-tomorrow button on Today.",
      },
    ];
  }
  const sections: ModeSection[] = [
    { label: "Tomorrow's focus", text: plan.focus || "No focus line set — one sentence is enough." },
  ];
  if (plan.intendedMeals.length > 0) {
    sections.push({
      label: "Intended meals",
      text: `${plan.intendedMeals.join(" · ")}. Decided food is easy food.`,
    });
  }
  if (plan.spendingIntention !== null) {
    sections.push({
      label: "Spending intention",
      text: `${formatMoney(plan.spendingIntention)} of discretionary room tomorrow — your number, set calmly tonight.`,
    });
  }
  sections.push({
    label: "The point",
    text: "A plan made the night before removes tomorrow morning's first three decisions. Follow it loosely; it's a rail, not a cage.",
  });
  return sections;
}

/** Relationship Debrief: coach-voice support for the latest debrief. */
export function relationshipDebriefMode(latest: ConflictDebrief | null): ModeSection[] {
  if (!latest) {
    return [
      {
        label: "No debrief yet",
        text: "Nothing to debrief right now. When a conflict happens, the Relationships tab walks you through it once you're calm — this mode then reads it back with repair language.",
      },
    ];
  }
  const support = debriefSupport(latest);
  return [
    { label: "As you told it", text: support.summary },
    ...support.patterns.map((p) => ({ label: "Worth noticing", text: p })),
    { label: "Repair language", text: support.repairLanguage },
    { label: "The calm message", text: support.calmMessage },
  ];
}

/** Journal Reflection: consent-gated; without consent it explains, never peeks. */
export function journalReflectionMode(
  consented: boolean,
  summary: JournalSummary | null
): ModeSection[] {
  if (!consented) {
    return [
      {
        label: "Journal privacy",
        text: "Journal sharing with the coach is off — so this mode stays empty, by design. If you want reflections here, turn on coach access in Mind → Journal privacy. Private entries stay private either way.",
      },
    ];
  }
  if (!summary || summary.entryCount === 0) {
    return [
      {
        label: "Nothing to reflect on yet",
        text: "No journal entries in the window. A few lines on ordinary days is what makes the reflection worth reading later.",
      },
    ];
  }
  return [
    ...summary.lines.map((line) => ({ label: "Observation", text: line })),
    { label: "About this", text: JOURNAL_ATTRIBUTION },
  ];
}

/** Pattern Review: LifeGraph findings in the coach frame (E14 data). */
export function patternReviewMode(patterns: DetectedPattern[]): ModeSection[] {
  if (patterns.length === 0) {
    return [
      {
        label: "No patterns yet",
        text: "Nothing crosses the bar yet — patterns only surface after at least five qualifying days, because a false pattern is worse than silence. Keep logging; the graph builds itself.",
      },
    ];
  }
  return patterns.slice(0, 3).map((p) => ({
    label: `Possible pattern · ${p.hits} of ${p.qualifyingDays} days`,
    text: `${p.line} (Co-occurrence over your last ${p.window} days — not causation.)`,
  }));
}
