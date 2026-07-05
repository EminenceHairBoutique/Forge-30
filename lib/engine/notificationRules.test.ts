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

// ---------------------------------------------------------------------------
// Server push (v3 Phase 2)
// ---------------------------------------------------------------------------

import {
  DAILY_PUSH_CAP,
  dueServerPush,
  inQuietHours,
  type ServerPushContext,
} from "./notificationRules";

const min = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const serverCtx = (over: Partial<ServerPushContext>): ServerPushContext => ({
  minutesLocal: min("08:30"),
  today: "2026-07-05",
  prefs: { morningPlan: true, eveningReview: true, streakReminder: true },
  sentToday: [],
  fullyLogged: false,
  yesterdayPriority: "One honest conversation about the budget",
  quickestMissing: ["the 60-second check-in", "one meal log"],
  streakCurrent: 8,
  mvdMet: false,
  ...over,
});

describe("dueServerPush", () => {
  it("morning brief carries yesterday's #1 in its window", () => {
    const push = dueServerPush(serverCtx({}));
    expect(push?.type).toBe("morningBrief");
    expect(push?.body).toContain("One honest conversation");
    expect(dueServerPush(serverCtx({ minutesLocal: min("11:00") }))).toBeNull();
  });

  it("sends ZERO on fully-logged days regardless of anything else", () => {
    expect(dueServerPush(serverCtx({ fullyLogged: true }))).toBeNull();
    expect(
      dueServerPush(serverCtx({ fullyLogged: true, minutesLocal: min("20:45") }))
    ).toBeNull();
  });

  it("hard-caps at 2 per day", () => {
    expect(DAILY_PUSH_CAP).toBe(2);
    const capped = serverCtx({
      minutesLocal: min("20:45"),
      sentToday: ["morningBrief", "streakAtRisk"],
    });
    expect(dueServerPush(capped)).toBeNull();
  });

  it("respects quiet hours across midnight, defaults 21:30–08:00", () => {
    expect(inQuietHours(min("21:30"), serverCtx({}).prefs)).toBe(true);
    expect(inQuietHours(min("23:59"), serverCtx({}).prefs)).toBe(true);
    expect(inQuietHours(min("06:00"), serverCtx({}).prefs)).toBe(true);
    expect(inQuietHours(min("08:00"), serverCtx({}).prefs)).toBe(false);
    expect(dueServerPush(serverCtx({ minutesLocal: min("22:00") }))).toBeNull();
    // Custom window moves the boundary.
    const custom = serverCtx({
      minutesLocal: min("22:00"),
      prefs: { morningPlan: true, eveningReview: true, streakReminder: true, quietStart: "23:00", quietEnd: "07:00" },
      quickestMissing: ["one meal log"],
    });
    expect(dueServerPush(custom)?.type).toBe("eveningClose");
  });

  it("streak-at-risk fires only for ≥5-day streaks with the MVD open, in its window", () => {
    const at = (over: Partial<ServerPushContext>) =>
      dueServerPush(serverCtx({ minutesLocal: min("19:15"), ...over }));
    expect(at({})?.type).toBe("streakAtRisk");
    expect(at({ streakCurrent: 4 })).toBeNull();
    expect(at({ mvdMet: true })).toBeNull();
    expect(at({ prefs: { morningPlan: true, eveningReview: true, streakReminder: false } })).toBeNull();
  });

  it("evening close lists at most the 2 quickest missing items, only when incomplete", () => {
    const push = dueServerPush(serverCtx({ minutesLocal: min("20:45") }));
    expect(push?.type).toBe("eveningClose");
    expect(push?.body).toBe("Still open: the 60-second check-in and one meal log.");
    expect(
      dueServerPush(serverCtx({ minutesLocal: min("20:45"), quickestMissing: [] }))
    ).toBeNull();
  });

  it("every type is individually off-able", () => {
    const offAll = { morningPlan: false, eveningReview: false, streakReminder: false };
    for (const t of ["08:30", "19:15", "20:45"]) {
      expect(dueServerPush(serverCtx({ minutesLocal: min(t), prefs: offAll }))).toBeNull();
    }
  });

  it("copy stays adherence-neutral (safetyCopy register)", () => {
    for (const t of ["08:30", "19:15", "20:45"]) {
      const push = dueServerPush(serverCtx({ minutesLocal: min(t), sentToday: [] }));
      if (!push) continue;
      expect(checkSafetyCopy(`${push.title} ${push.body}`).violations).toEqual([]);
      expect(`${push.title} ${push.body}`.toLowerCase()).not.toMatch(/don't ruin|failed|broke/);
    }
  });
});
