import type { ISODate, NotificationPrefs } from "@/lib/types";
import type { ScoreState } from "./forgeScore";

/**
 * Notification rules (E9) — pure decisions about which reminders are due.
 * The scheduler component supplies the clock and state; this module decides.
 *
 * Register rules: an unfired reminder is an invitation, never an accusation.
 * No shame copy, no "you missed", no "don't break" fear framing — the streak
 * reminder in particular leans on the freeze safety net (safetyCopy-tested).
 * Each type fires at most once per day (lastFired gate).
 */

export type NotificationType =
  | "morningPlan"
  | "eveningReview"
  | "streakReminder"
  | "weeklyReport"
  | "protocolDose";

export interface AppNotification {
  type: NotificationType;
  title: string;
  body: string;
  /** In-app destination opened on tap. */
  url: string;
}

export interface NotificationContext {
  /** Local hour 0–23. */
  hour: number;
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  today: ISODate;
  prefs: NotificationPrefs;
  /** Last date each type fired — the once-per-day gate. */
  lastFired: Partial<Record<NotificationType, ISODate>>;
  morningPlanSeen: boolean;
  hasReview: boolean;
  scoreState: ScoreState;
  /** Daily streak state (0/false when none). */
  streakCurrent: number;
  streakAtRisk: boolean;
  freezes: number;
  /**
   * Protocols (v3 Phase 6): count of scheduled items due today and still
   * unlogged, plus the earliest scheduled minute. Copy stays DISCREET —
   * never a compound name on a lock screen (§6.0.5).
   */
  protocolDueCount?: number;
  protocolEarliestMinutes?: number | null;
  protocolsEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Server push (v3 Phase 2) — the cron route's decision engine. Same register
// as everything above: state, never shame. Hard rules from V3_SPEC §2.2:
// at most 2 pushes/day, zero on fully-logged days, quiet hours respected
// (default 21:30–08:00), every type individually off-able via the same
// NotificationPrefs the in-app reminders use.
// ---------------------------------------------------------------------------

export type ServerPushType = "morningBrief" | "eveningClose" | "streakAtRisk";

export interface ServerPush {
  type: ServerPushType;
  title: string;
  body: string;
  url: string;
}

export interface ServerPushContext {
  /** Local time at the user's device, minutes since midnight. */
  minutesLocal: number;
  today: ISODate;
  prefs: NotificationPrefs;
  /** Types already sent today (the idempotency log) — enforces the 2/day cap. */
  sentToday: ServerPushType[];
  /** Every domain the user tracks is logged — the "leave them alone" state. */
  fullyLogged: boolean;
  /** Yesterday's #1 priority from the coach review, if any. */
  yesterdayPriority: string | null;
  /** The 1–2 quickest still-open items, shortest first (e.g. "the 60-second check-in"). */
  quickestMissing: string[];
  streakCurrent: number;
  /** Minimum Viable Day already met today. */
  mvdMet: boolean;
}

export const QUIET_START_DEFAULT = "21:30";
export const QUIET_END_DEFAULT = "08:00";
export const DAILY_PUSH_CAP = 2;
/** Streak-at-risk only defends streaks worth defending. */
export const STREAK_AT_RISK_MIN = 5;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** True when the local time falls inside the (possibly midnight-crossing) quiet window. */
export function inQuietHours(minutesLocal: number, prefs: NotificationPrefs): boolean {
  const start = toMinutes(prefs.quietStart ?? QUIET_START_DEFAULT);
  const end = toMinutes(prefs.quietEnd ?? QUIET_END_DEFAULT);
  if (start === end) return false;
  return start < end
    ? minutesLocal >= start && minutesLocal < end
    : minutesLocal >= start || minutesLocal < end;
}

/**
 * The at-most-one push due right now (the cron runs every few minutes; the
 * sent-log makes re-runs no-ops). Returning a single push per tick — combined
 * with the per-day sent log — is what makes double-fires impossible.
 */
export function dueServerPush(ctx: ServerPushContext): ServerPush | null {
  if (ctx.fullyLogged) return null;
  if (ctx.sentToday.length >= DAILY_PUSH_CAP) return null;
  if (inQuietHours(ctx.minutesLocal, ctx.prefs)) return null;
  const sent = new Set(ctx.sentToday);

  // Morning brief — 08:00–09:59, carries yesterday's #1 forward.
  if (
    ctx.prefs.morningPlan &&
    !sent.has("morningBrief") &&
    ctx.minutesLocal >= toMinutes("08:00") &&
    ctx.minutesLocal < toMinutes("10:00")
  ) {
    return {
      type: "morningBrief",
      title: "Today's #1",
      body: ctx.yesterdayPriority
        ? `From last night's review: ${ctx.yesterdayPriority}`
        : "Fifteen seconds sets the day: today's plan is ready.",
      url: "/today",
    };
  }

  // Streak-at-risk — 19:00–20:29, only for streaks ≥5 with the MVD still open.
  if (
    ctx.prefs.streakReminder &&
    !sent.has("streakAtRisk") &&
    ctx.streakCurrent >= STREAK_AT_RISK_MIN &&
    !ctx.mvdMet &&
    ctx.minutesLocal >= toMinutes("19:00") &&
    ctx.minutesLocal < toMinutes("20:30")
  ) {
    return {
      type: "streakAtRisk",
      title: `Day ${ctx.streakCurrent + 1} is still open`,
      body: "The minimum day takes about two minutes. That's all the streak asks.",
      url: "/today",
    };
  }

  // Evening close — 20:30 until quiet hours, only when the day is incomplete.
  if (
    ctx.prefs.eveningReview &&
    !sent.has("eveningClose") &&
    ctx.quickestMissing.length > 0 &&
    ctx.minutesLocal >= toMinutes("20:30")
  ) {
    const items = ctx.quickestMissing.slice(0, 2).join(" and ");
    return {
      type: "eveningClose",
      title: "20 minutes to close out today",
      body: `Still open: ${items}.`,
      url: "/today",
    };
  }

  return null;
}

/**
 * Derive the evening-close inputs from a day's log: the quickest still-open
 * items (shortest-effort first, neutral names) and whether everything the
 * log tracks is in. Pure; the cron route maps a synced DailyLog through it.
 */
export function missingItems(log: {
  calories: number;
  mood: number;
  journalDone: boolean;
  spendingChecked: boolean;
  workoutStatus: string;
}): string[] {
  const out: string[] = [];
  if (log.mood === 0) out.push("the 60-second check-in");
  if (!log.spendingChecked) out.push("the spending check");
  if (log.calories === 0) out.push("one meal log");
  if (!log.journalDone) out.push("a two-line journal note");
  if (log.workoutStatus === "none") out.push("today's movement (the 10-minute minimum counts)");
  return out;
}

export function dueNotifications(ctx: NotificationContext): AppNotification[] {
  const out: AppNotification[] = [];
  const firedToday = (t: NotificationType) => ctx.lastFired[t] === ctx.today;

  if (
    ctx.prefs.morningPlan &&
    !firedToday("morningPlan") &&
    ctx.hour >= 8 &&
    ctx.hour < 12 &&
    !ctx.morningPlanSeen &&
    ctx.scoreState === "inProgress"
  ) {
    out.push({
      type: "morningPlan",
      title: "Your morning plan is ready",
      body: "Fifteen seconds: today's training, meals, and the floor that keeps the streak.",
      url: "/today",
    });
  }

  if (
    ctx.prefs.eveningReview &&
    !firedToday("eveningReview") &&
    ctx.scoreState === "final" &&
    !ctx.hasReview
  ) {
    out.push({
      type: "eveningReview",
      title: "The day is wrapped",
      body: "Two minutes closes the loop — run tonight's review and set tomorrow's #1.",
      url: "/coach?auto=1",
    });
  }

  if (
    ctx.prefs.streakReminder &&
    !firedToday("streakReminder") &&
    ctx.hour >= 19 &&
    ctx.streakCurrent > 0 &&
    ctx.streakAtRisk
  ) {
    out.push({
      type: "streakReminder",
      title: `${ctx.streakCurrent}-day streak — today's still open`,
      body:
        ctx.freezes > 0
          ? "No pressure: your banked freeze covers today if it comes to that. Two easy minutes keeps the streak alive on its own."
          : "Two easy minutes keeps it alive: one meal logged and the quick check-in.",
      url: "/today",
    });
  }

  // Protocol dose reminder — discreet by construction: no compound names,
  // no doses, just "scheduled item". Once per day, after the earliest
  // scheduled time, only while something is still unlogged.
  if (
    ctx.prefs.protocolReminders !== false &&
    ctx.protocolsEnabled === true &&
    !firedToday("protocolDose") &&
    (ctx.protocolDueCount ?? 0) > 0 &&
    ctx.protocolEarliestMinutes !== null &&
    ctx.protocolEarliestMinutes !== undefined &&
    ctx.hour * 60 >= ctx.protocolEarliestMinutes
  ) {
    out.push({
      type: "protocolDose",
      title: "Scheduled item due",
      body: "Ten seconds to log it — your record stays complete.",
      url: "/protocols",
    });
  }

  if (
    (ctx.prefs.weeklyReport ?? true) &&
    !firedToday("weeklyReport") &&
    ctx.weekday === 6 &&
    ctx.hour >= 17
  ) {
    out.push({
      type: "weeklyReport",
      title: "Your week, in one card",
      body: "The Sunday review is ready when you are — trends, wins, and next week's plan.",
      url: "/progress",
    });
  }

  return out;
}
