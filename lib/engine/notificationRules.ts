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
  | "weeklyReport";

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
