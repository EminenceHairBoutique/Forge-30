"use client";

import { useEffect, useRef } from "react";
import { useStorage } from "@/lib/storage/provider";
import { dueNotifications, type NotificationType } from "@/lib/engine/notificationRules";
import { dueToday } from "@/lib/engine/protocols";
import { resolveScoreState } from "@/lib/engine/forgeScore";
import { notificationPermission } from "@/lib/push/client";
import { DEFAULT_NOTIFICATIONS } from "@/lib/data/defaults";
import { mondayWeekday, toISODate } from "@/lib/utils";

const CHECK_INTERVAL_MS = 60_000;

/** Show through the SW registration when available (survives tab focus loss). */
async function show(title: string, body: string, url: string, tag: string): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url },
      });
      return;
    }
  } catch {
    // Fall through to the plain Notification path.
  }
  try {
    new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
  } catch {
    // Notification constructor unavailable (some Android WebViews) — skip.
  }
}

/**
 * In-app notification scheduler (E9) — the NOW half of notifications. While
 * Forge30 is open (foreground PWA counts), it checks once a minute whether a
 * reminder is due per the pure rules engine and shows it locally through the
 * service worker. True background delivery arrives with the push backend
 * (FLAG pushServer); this component is what makes the toggles do something
 * today. Renders nothing.
 */
export function NotificationScheduler() {
  const { adapter, profile, revision } = useStorage();
  const running = useRef(false);

  useEffect(() => {
    if (!profile?.onboardingComplete) return;

    const check = async () => {
      if (running.current) return;
      if (notificationPermission() !== "granted") return;
      running.current = true;
      try {
        const now = new Date();
        const today = toISODate(now);
        const [log, review, streak, lastFired, protocolSettings] = await Promise.all([
          adapter.getDailyLog(today),
          adapter.getAIReview(today),
          adapter.getStreak("daily"),
          adapter.getNotificationLog(),
          adapter.getProtocolSettings(),
        ]);

        // Protocols due-state (only loaded when the tab is enabled — §6.0.6).
        let protocolDueCount = 0;
        let protocolEarliestMinutes: number | null = null;
        if (protocolSettings.enabled) {
          const [schedules, compounds, doses] = await Promise.all([
            adapter.listProtocolSchedules(),
            adapter.listCompounds(),
            adapter.listDoseEvents(today, today),
          ]);
          const due = dueToday(schedules, compounds, doses, today).filter((d) => !d.logged);
          protocolDueCount = due.length;
          protocolEarliestMinutes = due.reduce<number | null>((min, d) => {
            const [h, m] = d.schedule.timeOfDay.split(":").map(Number);
            const mins = (h ?? 0) * 60 + (m ?? 0);
            return min === null || mins < min ? mins : min;
          }, null);
        }

        const due = dueNotifications({
          hour: now.getHours(),
          weekday: mondayWeekday(today),
          today,
          prefs: profile.notifications ?? DEFAULT_NOTIFICATIONS,
          lastFired: lastFired as Partial<Record<NotificationType, string>>,
          morningPlanSeen: log?.morningPlanSeen ?? false,
          hasReview: review !== null,
          scoreState: resolveScoreState(now.getHours(), profile.dayBoundaryHour),
          streakCurrent: streak?.current ?? 0,
          streakAtRisk: streak?.atRisk ?? false,
          freezes: streak?.freezes ?? 0,
          protocolsEnabled: protocolSettings.enabled,
          protocolDueCount,
          protocolEarliestMinutes,
        });

        if (due.length > 0) {
          const nextLog = { ...lastFired };
          for (const n of due) {
            await show(n.title, n.body, n.url, `forge30-${n.type}`);
            nextLog[n.type] = today;
          }
          await adapter.saveNotificationLog(nextLog);
        }
      } finally {
        running.current = false;
      }
    };

    void check();
    const timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [adapter, profile, revision]);

  return null;
}
