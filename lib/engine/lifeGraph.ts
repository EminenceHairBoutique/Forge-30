import type {
  BloodPressureEntry,
  DailyLog,
  ISODate,
  JournalEntry,
  JournalNote,
  SpendingEntry,
  TomorrowPlan,
} from "@/lib/types";
import { round1 } from "@/lib/utils";
import { extractThemes } from "./journalRules";
import { possiblePattern } from "./safetyCopy";

/**
 * LifeGraph (E14) — the cross-domain pattern engine. Deliberately simple and
 * honest about what it is: co-occurrence counting over the user's own logged
 * history. No inference, no ML, no causation claims. Every finding is phrased
 * through the "possible pattern" register and pairs with exactly one
 * suggested experiment. Small samples are worse than silence, so nothing
 * surfaces below MIN_QUALIFYING_DAYS.
 *
 * Journal content enters ONLY as pre-consented notes: callers must filter
 * through notesForConsumer(notes, consent, "lifeGraph") before building days.
 * Patterns that used journal-derived flags carry journalInformed for the
 * attribution line.
 */

export const MIN_QUALIFYING_DAYS = 5;
export const SHARE_THRESHOLD = 0.6;
export type LifeGraphWindow = 7 | 30;

/** Tri-state day flags: true / false / absent (= not logged that day). */
export type LifeFlag =
  | "highStress"
  | "poorSleep"
  | "lowMood"
  | "elevatedSpend"
  | "stressSpend"
  | "skippedWorkout"
  | "highPain"
  | "highBp"
  | "noPlan"
  | "calorieOvershoot"
  | "conflictDay"
  | "lonelyDay"
  // Protocols (v3 Phase 6) — behavioral signals only, prescriber framing on
  // every pattern that uses them.
  | "doseDay"
  | "protocolSymptomDay";

export interface LifeGraphDay {
  date: ISODate;
  flags: Partial<Record<LifeFlag, boolean>>;
}

export interface LifeGraphInputs {
  /** Trailing-window collections; the engine indexes them by date itself. */
  logs: DailyLog[];
  spending: SpendingEntry[];
  bloodPressure: BloodPressureEntry[];
  plans: TomorrowPlan[];
  /** Daily check-ins (relationshipStress flag). */
  journals: JournalEntry[];
  /** MUST already be filtered through notesForConsumer(…, "lifeGraph"). */
  consentedNotes: JournalNote[];
  dailySpendingLimit: number;
  calorieTarget: number;
  /** Protocol dose days (v3 Phase 6) — present only when Protocols is enabled. */
  doseDates?: ISODate[];
}

/** Build tri-state flag days from the collections everything already logs. */
export function buildDays(inputs: LifeGraphInputs): LifeGraphDay[] {
  const spendByDate = new Map<ISODate, SpendingEntry[]>();
  for (const s of inputs.spending) {
    spendByDate.set(s.date, [...(spendByDate.get(s.date) ?? []), s]);
  }
  const bpByDate = new Map<ISODate, BloodPressureEntry[]>();
  for (const b of inputs.bloodPressure) {
    bpByDate.set(b.date, [...(bpByDate.get(b.date) ?? []), b]);
  }
  const planDates = new Set(inputs.plans.map((p) => p.date));
  const journalByDate = new Map(inputs.journals.map((j) => [j.date, j]));
  const notesByDate = new Map<ISODate, JournalNote[]>();
  for (const n of inputs.consentedNotes) {
    notesByDate.set(n.date, [...(notesByDate.get(n.date) ?? []), n]);
  }
  const doseDates = new Set(inputs.doseDates ?? []);

  return [...inputs.logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((log) => {
      const flags: Partial<Record<LifeFlag, boolean>> = {};

      if (log.stress > 0) flags.highStress = log.stress >= 7;
      if (log.sleepHours > 0) flags.poorSleep = log.sleepHours < 6.5;
      if (log.mood > 0) flags.lowMood = log.mood <= 4;
      // painScore 0 is a valid "no pain" reading once anything was logged.
      flags.highPain = log.painScore >= 5;
      if (log.workoutStatus !== "notStarted") {
        flags.skippedWorkout = log.workoutStatus === "skipped";
      }
      // Planning is binary and always knowable for a logged day.
      flags.noPlan = !planDates.has(log.date);
      if (log.calories > 0 && inputs.calorieTarget > 0) {
        flags.calorieOvershoot = log.calories > inputs.calorieTarget + 300;
      }

      const spent = spendByDate.get(log.date);
      if (spent || log.spendingChecked) {
        const unnecessary = (spent ?? [])
          .filter((s) => !s.necessary)
          .reduce((sum, s) => sum + s.amount, 0);
        flags.elevatedSpend =
          inputs.dailySpendingLimit > 0 && unnecessary > inputs.dailySpendingLimit;
        flags.stressSpend = (spent ?? []).some((s) => s.stressPurchase);
      }

      const bp = bpByDate.get(log.date);
      if (bp && bp.length > 0) {
        flags.highBp = bp.some((r) => r.systolic >= 130 || r.diastolic >= 80);
      }

      const journal = journalByDate.get(log.date);
      if (journal) flags.conflictDay = journal.relationshipStress;

      // Protocols: dose-day + symptom flags exist only when the caller
      // supplied dose dates (i.e. the tab is enabled) or symptoms were logged.
      if (doseDates.size > 0) flags.doseDay = doseDates.has(log.date);
      if (log.protocolSymptoms !== undefined) {
        flags.protocolSymptomDay = log.protocolSymptoms.some((x) => x.severity >= 3);
      }

      const notes = notesByDate.get(log.date);
      if (notes && notes.length > 0) {
        flags.lonelyDay = notes.some((n) =>
          extractThemes(
            [n.text, n.situation, n.emotion].filter(Boolean).join(" ")
          ).includes("friends")
        );
      }

      return { date: log.date, flags };
    });
}

// --- Pair definitions -----------------------------------------------------------

export interface PatternDef {
  id: string;
  a: LifeFlag;
  b: LifeFlag;
  /** 0 = same day; 1 = B measured the day after A. */
  lagDays: 0 | 1;
  /** Human phrasing of the A-day and the B-outcome for the finding line. */
  aLabel: string;
  bLabel: string;
  /** Exactly one suggested experiment — an action, never a verdict. */
  experiment: string;
  /** True when the pair reads journal-derived flags (consent attribution). */
  usesJournal?: boolean;
}

/** Seeded pairs from the spec. Deterministic order = deterministic output. */
export const PATTERN_DEFS: PatternDef[] = [
  // Protocol patterns (v3 Phase 6): behavioral observations with prescriber
  // framing — never interpretive, never medical.
  {
    id: "dose-sleep",
    a: "doseDay",
    b: "poorSleep",
    lagDays: 1,
    aLabel: "scheduled dose days",
    bLabel: "the following night's sleep ran short",
    experiment:
      "Worth showing your prescriber alongside the doctor report — bring the sleep numbers too.",
  },
  {
    id: "symptom-mood",
    a: "protocolSymptomDay",
    b: "lowMood",
    lagDays: 0,
    aLabel: "days with a protocol symptom noted",
    bLabel: "mood rated low the same day",
    experiment:
      "A pattern worth showing your prescriber — the symptom log in the doctor report has the details.",
  },
  {
    id: "stress-spend",
    a: "highStress",
    b: "stressSpend",
    lagDays: 0,
    aLabel: "high-stress days",
    bLabel: "a stress purchase got logged",
    experiment:
      "Tomorrow, park anything unplanned in the 24-hour pause on the Money tab before buying.",
  },
  {
    id: "sleep-stress",
    a: "poorSleep",
    b: "highStress",
    lagDays: 1,
    aLabel: "short-sleep nights",
    bLabel: "the next day rated high-stress",
    experiment: "Tonight, run the wind-down routine and protect a 7-hour window.",
  },
  {
    id: "sleep-spend",
    a: "poorSleep",
    b: "elevatedSpend",
    lagDays: 1,
    aLabel: "short-sleep nights",
    bLabel: "next-day spending went past your daily limit",
    experiment:
      "Tomorrow, use the pause check before any purchase over your set limit.",
  },
  {
    id: "conflict-workout",
    a: "conflictDay",
    b: "skippedWorkout",
    lagDays: 0,
    aLabel: "relationship-stress days",
    bLabel: "the workout was skipped",
    experiment:
      "Next rough day, shrink the session to the minimum viable workout instead of deciding yes/no.",
  },
  {
    id: "sleep-bp",
    a: "poorSleep",
    b: "highBp",
    lagDays: 1,
    aLabel: "short-sleep nights",
    bLabel: "the next day's blood-pressure reading came in elevated",
    experiment:
      "Keep logging BP at the same time each day and bring this log to your next check-up.",
  },
  {
    id: "pain-stress",
    a: "highPain",
    b: "highStress",
    lagDays: 0,
    aLabel: "pain-flare days",
    bLabel: "stress rated high",
    experiment:
      "On the next flare day, swap in the reset + mobility work and let that count as the session.",
  },
  {
    id: "plan-nutrition",
    a: "noPlan",
    b: "calorieOvershoot",
    lagDays: 0,
    aLabel: "days without an evening plan",
    bLabel: "calories ran well past target",
    experiment: "Tonight, do the two-minute tomorrow plan before winding down.",
  },
  {
    id: "lonely-mood",
    a: "lonelyDay",
    b: "lowMood",
    lagDays: 0,
    aLabel: "days your journal touched on loneliness",
    bLabel: "mood rated low",
    experiment:
      "This week, try one low-pressure reach-out from your reconnect list on the Social tab.",
    usesJournal: true,
  },
];

// --- Detection ------------------------------------------------------------------

export interface DetectedPattern {
  id: string;
  window: LifeGraphWindow;
  /** Days where A was true and B was measurable (with lag). */
  qualifyingDays: number;
  /** Of those, days where B was also true. */
  hits: number;
  /** hits / qualifyingDays, 0–1. */
  share: number;
  /** Full "Possible pattern: … " line incl. the one suggested experiment. */
  line: string;
  journalInformed: boolean;
}

function evaluate(
  def: PatternDef,
  days: LifeGraphDay[],
  window: LifeGraphWindow,
  today: ISODate
): DetectedPattern | null {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const inWindow = days.filter((d) => daysBefore(today, d.date) < window);

  let qualifying = 0;
  let hits = 0;
  for (const day of inWindow) {
    if (day.flags[def.a] !== true) continue;
    const target = def.lagDays === 0 ? day : byDate.get(nextDate(day.date));
    const b = target?.flags[def.b];
    if (b === undefined) continue;
    qualifying += 1;
    if (b) hits += 1;
  }

  if (qualifying < MIN_QUALIFYING_DAYS) return null;
  const share = hits / qualifying;
  if (share < SHARE_THRESHOLD) return null;

  const finding = `on ${hits} of your ${qualifying} ${def.aLabel} in the last ${window} days, ${def.bLabel}.`;
  return {
    id: def.id,
    window,
    qualifyingDays: qualifying,
    hits,
    share: round1(share * 100) / 100,
    line: possiblePattern(finding, def.experiment),
    journalInformed: def.usesJournal === true,
  };
}

/**
 * Run every pair over the 7- and 30-day windows. If a pair crosses the
 * threshold in both, the 30-day read (more data) wins. Sorted by share, then
 * sample size — strongest signal first. Same input always → same output.
 */
export function detectPatterns(
  days: LifeGraphDay[],
  today: ISODate,
  defs: PatternDef[] = PATTERN_DEFS
): DetectedPattern[] {
  const found: DetectedPattern[] = [];
  for (const def of defs) {
    const p30 = evaluate(def, days, 30, today);
    const p7 = evaluate(def, days, 7, today);
    const winner = p30 ?? p7;
    if (winner) found.push(winner);
  }
  return found.sort(
    (a, b) => b.share - a.share || b.qualifyingDays - a.qualifyingDays || a.id.localeCompare(b.id)
  );
}

// --- Local date helpers (pure string math, no Date.now) ---------------------------

function nextDate(date: ISODate): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Whole days `date` sits before `today` (0 = today). */
function daysBefore(today: ISODate, date: ISODate): number {
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000
  );
}

// ---------------------------------------------------------------------------
// Surfacing discipline (v3 Phase 5): no pattern shows twice in one week.
// The card marks what it showed; the filter hides anything shown in the
// trailing cooldown. Pure — the adapter stores the log.
// ---------------------------------------------------------------------------

export const PATTERN_REPEAT_COOLDOWN_DAYS = 7;

/** patternId → the date it last surfaced on a user-facing card. */
export type PatternSurfaceLog = Record<string, ISODate>;

export function filterRecentlySurfaced(
  patterns: DetectedPattern[],
  log: PatternSurfaceLog,
  today: ISODate
): DetectedPattern[] {
  return patterns.filter((p) => {
    const last = log[p.id];
    // A pattern surfaced *today* is currently on screen — still visible;
    // the cooldown hides it starting tomorrow through day 6.
    if (last === undefined || last === today) return true;
    return daysBefore(today, last) >= PATTERN_REPEAT_COOLDOWN_DAYS;
  });
}

/** The updated log after showing `patterns` today. Idempotent per day. */
export function markSurfaced(
  log: PatternSurfaceLog,
  patterns: DetectedPattern[],
  today: ISODate
): PatternSurfaceLog {
  const next = { ...log };
  for (const p of patterns) next[p.id] = today;
  return next;
}
