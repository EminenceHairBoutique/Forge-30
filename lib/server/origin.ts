/**
 * Cross-origin pin for API routes (v3.3 §1.5).
 *
 * Browser-initiated writes carry an Origin header; we accept only our own
 * deployment host plus the native-shell webview origins (the Capacitor build
 * calls the deployed API from capacitor://localhost — docs/NATIVE_BUILD.md).
 * Requests with no Origin (server-to-server, curl, Stripe, cron) pass —
 * those callers authenticate by signature/secret/bearer, not by origin.
 */

const NATIVE_SHELL_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
]);

export function crossOriginBlocked(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return false;
  if (NATIVE_SHELL_ORIGINS.has(origin)) return false;

  const extra = process.env.CORS_ALLOWED_ORIGINS;
  if (extra && extra.split(",").map((s) => s.trim()).includes(origin)) return false;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
