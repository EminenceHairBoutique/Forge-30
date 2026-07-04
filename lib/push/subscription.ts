import { flagEnabled } from "@/lib/flags";

/**
 * Web Push subscription plumbing (E9) — scaffolded NOW, live WAIT(backend).
 * Real push sending needs a server holding VAPID keys; until FLAGS.pushServer
 * flips, subscribe() refuses politely and the app relies on the in-app
 * scheduler (NotificationScheduler) which shows local notifications through
 * the service worker while Forge30 is open.
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

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** VAPID key base64url → Uint8Array (the format pushManager.subscribe wants). */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  if (!flagEnabled("pushServer")) {
    throw new Error(
      "Device push needs the push backend (FLAG pushServer). In-app reminders work today."
    );
  }
  if (!pushSupported()) throw new Error("Push isn't supported in this browser.");
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
}

export async function unsubscribePush(): Promise<void> {
  const sub = await getPushSubscription();
  if (sub) await sub.unsubscribe();
}
