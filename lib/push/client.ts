import { apiUrl } from "@/lib/api";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Client web-push helpers (v3 Phase 2). Push is available only when: this
 * build's server has VAPID configured (feature-detected via GET), the user
 * is signed in (subscriptions are per-account), the browser supports it,
 * and — on iOS — the app is installed (16.4+ standalone requirement; the
 * Settings card shows the add-to-home-screen path instead of ever prompting
 * in a browser tab).
 */

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** The browser's current permission, SSR-safe. */
export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** iOS browser-tab: never prompt; show the install card first. */
export function needsInstallFirst(): boolean {
  return isIOS() && !isStandalone();
}

export async function pushServerConfigured(): Promise<string | null> {
  try {
    const res = await fetch(apiUrl("/api/push/subscribe"));
    if (!res.ok) return null;
    const { publicKey } = (await res.json()) as { publicKey?: string };
    return publicKey ?? null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function authHeader(): Promise<Record<string, string> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/** Subscribe this device; resolves to an error message or null on success. */
export async function subscribeToPush(publicKey: string): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "This browser doesn't support background push.";
  }
  const auth = await authHeader();
  if (!auth) return "Sign in first — push follows your account.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "Notifications are blocked in browser settings.";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  const json = sub.toJSON();
  const res = await fetch(apiUrl("/api/push/subscribe"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  return res.ok ? null : "Couldn't save the subscription — try again.";
}

/** Unsubscribe this device (local + server). */
export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const auth = await authHeader();
  if (auth) {
    await fetch(apiUrl("/api/push/subscribe"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);
  }
  await sub.unsubscribe();
}

export async function currentPushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) !== null;
  } catch {
    return false;
  }
}
