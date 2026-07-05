import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import Anthropic from "@anthropic-ai/sdk";
import {
  dueServerPush,
  missingItems,
  type ServerPush,
  type ServerPushContext,
} from "@/lib/engine/notificationRules";
import type { AIReview, DailyLog, NotificationPrefs, StreakState } from "@/lib/types";

/**
 * Notification cron (v3 Phase 2). Vercel Cron (or any scheduler) hits this
 * every 15 minutes with the CRON_SECRET. Idempotent by construction: a push
 * sends only after its (user, date, type) row inserts into notification_log —
 * a double-fired cron inserts nothing and therefore sends nothing.
 *
 * Data source: the user's own synced blobs (sync_blobs) — profile prefs,
 * today's daily log, streak state, and yesterday's review. Users who don't
 * sync simply have no server data and no server pushes; the in-app reminders
 * still cover them. Copy rules are enforced in the pure engine; the optional
 * haiku personalization can only ever rephrase within the same register, and
 * any failure falls back to the deterministic template body.
 */

export const dynamic = "force-dynamic";

const MICROCOPY_MODEL = "claude-haiku-4-5-20251001";

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

function localParts(tz: string, now: Date): { minutes: number; date: string } {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    return {
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
      date: `${parts.year}-${parts.month}-${parts.day}`,
    };
  } catch {
    return { minutes: now.getUTCHours() * 60 + now.getUTCMinutes(), date: now.toISOString().slice(0, 10) };
  }
}

/** Optional haiku one-liner; identical meaning, same register, hard fallback. */
async function personalize(push: ServerPush): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return push.body;
  try {
    const anthropic = new Anthropic({ apiKey: key });
    const msg = await anthropic.messages.create({
      model: MICROCOPY_MODEL,
      max_tokens: 60,
      system:
        "Rewrite the given notification body in one warm, plain sentence (max 110 characters). Keep every fact. Never shame, never urgency-bait, never mention streak-breaking or failure. If you cannot improve it, return it unchanged.",
      messages: [{ role: "user", content: push.body }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return text.length > 0 && text.length <= 140 ? text : push.body;
  } catch {
    return push.body;
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!supabase || !vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "Push is not configured." }, { status: 404 });
  }
  webpush.setVapidDetails("mailto:support@forge30.app", vapidPublic, vapidPrivate);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("user_id,endpoint,p256dh,auth,tz");
  if (error) return NextResponse.json({ error: "Read failed." }, { status: 500 });

  const byUser = new Map<string, typeof subs>();
  for (const sub of subs ?? []) {
    const list = byUser.get(sub.user_id as string) ?? [];
    list.push(sub);
    byUser.set(sub.user_id as string, list);
  }

  const now = new Date();
  let sent = 0;
  for (const [userId, userSubs] of byUser) {
    const tz = (userSubs?.[0]?.tz as string) ?? "UTC";
    const { minutes, date } = localParts(tz, now);

    const { data: blobs } = await supabase
      .from("sync_blobs")
      .select("collection,data")
      .eq("user_id", userId)
      .in("collection", ["profile", "dailyLogs", "streaks", "aiReviews"]);
    const blob = new Map((blobs ?? []).map((b) => [b.collection as string, b.data]));

    const profile = blob.get("profile") as { notifications?: NotificationPrefs } | undefined;
    const prefs: NotificationPrefs = profile?.notifications ?? {
      morningPlan: true,
      eveningReview: true,
      streakReminder: true,
    };
    const logs = (blob.get("dailyLogs") ?? []) as DailyLog[];
    const todayLog = logs.find((l) => l.date === date) ?? null;
    const streaks = (blob.get("streaks") ?? []) as StreakState[];
    const daily = streaks.find((s) => s.id === "daily") ?? null;
    const reviews = (blob.get("aiReviews") ?? []) as AIReview[];
    const yesterday = reviews
      .filter((r) => r.date < date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    const { data: sentRows } = await supabase
      .from("notification_log")
      .select("type")
      .eq("user_id", userId)
      .eq("date", date);

    const missing = todayLog ? missingItems(todayLog) : ["the 60-second check-in"];
    const ctx: ServerPushContext = {
      minutesLocal: minutes,
      today: date,
      prefs,
      sentToday: (sentRows ?? []).map((r) => r.type as ServerPushContext["sentToday"][number]),
      fullyLogged: todayLog !== null && missing.length === 0,
      yesterdayPriority: yesterday?.tomorrowPriority ?? null,
      quickestMissing: missing,
      streakCurrent: daily?.current ?? 0,
      mvdMet: daily?.metToday ?? false,
    };
    const push = dueServerPush(ctx);
    if (!push) continue;

    // Idempotency gate: send only if this (user, date, type) inserts fresh.
    const { error: logErr } = await supabase
      .from("notification_log")
      .insert({ user_id: userId, date, type: push.type });
    if (logErr) continue; // already sent (unique violation) or transient — skip

    const body = await personalize(push);
    for (const sub of userSubs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
          },
          JSON.stringify({ title: push.title, body, url: push.url, tag: push.type })
        );
        sent += 1;
      } catch (err) {
        // Expired/revoked subscription → prune it; anything else is transient.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", userId)
            .eq("endpoint", sub.endpoint as string);
        }
      }
    }
  }
  return NextResponse.json({ ok: true, sent });
}
