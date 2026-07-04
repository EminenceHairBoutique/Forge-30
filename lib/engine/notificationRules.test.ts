import { describe, expect, it } from "vitest";
import { dueNotifications, type NotificationContext } from "./notificationRules";
import { checkSafetyCopy } from "./safetyCopy";

const base: NotificationContext = {
  hour: 9,
  weekday: 2,
  today: "2026-07-01",
  prefs: { morningPlan: true, eveningReview: true, streakReminder: true, weeklyReport: true },
  lastFired: {},
  morningPlanSeen: false,
  hasReview: false,
  scoreState: "inProgress",
  streakCurrent: 5,
  streakAtRisk: true,
  freezes: 1,
};

describe("dueNotifications", () => {
  it("morning plan fires in the morning window, once, only until seen", () => {
    expect(dueNotifications(base).map((n) => n.type)).toContain("morningPlan");
    expect(dueNotifications({ ...base, hour: 13 }).map((n) => n.type)).not.toContain("morningPlan");
    expect(dueNotifications({ ...base, morningPlanSeen: true }).map((n) => n.type)).not.toContain("morningPlan");
    expect(
      dueNotifications({ ...base, lastFired: { morningPlan: "2026-07-01" } }).map((n) => n.type)
    ).not.toContain("morningPlan");
    // Yesterday's firing doesn't block today.
    expect(
      dueNotifications({ ...base, lastFired: { morningPlan: "2026-06-30" } }).map((n) => n.type)
    ).toContain("morningPlan");
  });

  it("evening review fires only after the boundary and only without a review", () => {
    const evening = { ...base, hour: 20, scoreState: "final" as const };
    expect(dueNotifications(evening).map((n) => n.type)).toContain("eveningReview");
    expect(dueNotifications({ ...evening, hasReview: true }).map((n) => n.type)).not.toContain("eveningReview");
    expect(dueNotifications(base).map((n) => n.type)).not.toContain("eveningReview");
  });

  it("streak reminder: evening, at-risk runs only, freeze safety net named first", () => {
    const evening = { ...base, hour: 20 };
    const withFreeze = dueNotifications(evening).find((n) => n.type === "streakReminder")!;
    expect(withFreeze.title).toContain("5-day streak");
    expect(withFreeze.body).toMatch(/freeze covers today/);
    const without = dueNotifications({ ...evening, freezes: 0 }).find((n) => n.type === "streakReminder")!;
    expect(without.body).toMatch(/Two easy minutes/);
    // Not at risk / no streak / too early → quiet.
    expect(dueNotifications({ ...evening, streakAtRisk: false }).map((n) => n.type)).not.toContain("streakReminder");
    expect(dueNotifications({ ...evening, streakCurrent: 0 }).map((n) => n.type)).not.toContain("streakReminder");
    expect(dueNotifications({ ...base, hour: 15 }).map((n) => n.type)).not.toContain("streakReminder");
  });

  it("weekly report fires Sunday evening; absent pref defaults on, false turns it off", () => {
    const sunday = { ...base, weekday: 6, hour: 18 };
    expect(dueNotifications(sunday).map((n) => n.type)).toContain("weeklyReport");
    expect(dueNotifications({ ...sunday, weekday: 5 }).map((n) => n.type)).not.toContain("weeklyReport");
    const noPref = { ...sunday, prefs: { ...sunday.prefs } };
    delete noPref.prefs.weeklyReport;
    expect(dueNotifications(noPref).map((n) => n.type)).toContain("weeklyReport");
    expect(
      dueNotifications({ ...sunday, prefs: { ...sunday.prefs, weeklyReport: false } }).map((n) => n.type)
    ).not.toContain("weeklyReport");
  });

  it("preferences gate every type", () => {
    const allOff = dueNotifications({
      ...base,
      hour: 20,
      weekday: 6,
      scoreState: "final",
      prefs: { morningPlan: false, eveningReview: false, streakReminder: false, weeklyReport: false },
    });
    expect(allOff).toEqual([]);
  });

  it("no shame copy anywhere — every title and body is safety-clean and fear-free", () => {
    const everything = [
      ...dueNotifications(base),
      ...dueNotifications({ ...base, hour: 20, scoreState: "final" as const }),
      ...dueNotifications({ ...base, hour: 20, freezes: 0 }),
      ...dueNotifications({ ...base, weekday: 6, hour: 18 }),
    ];
    expect(everything.length).toBeGreaterThanOrEqual(4);
    for (const n of everything) {
      const text = `${n.title} ${n.body}`;
      expect(checkSafetyCopy(text).violations).toEqual([]);
      expect(text.toLowerCase()).not.toMatch(/don't break|about to lose|missed|failed|last chance|hurry/);
    }
  });
});
