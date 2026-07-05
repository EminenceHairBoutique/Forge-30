import type { SubscriptionTier } from "./subscription";

/**
 * Fixed-window daily rate limiting (v3.3 §1.1) — the pure math only.
 * Storage (Supabase table or in-memory map) lives in lib/server/rateLimit.ts;
 * this file decides, given a current count and a limit, whether one more
 * call fits in today's window.
 */

/** UTC day key for a fixed daily window ("2026-07-05"). */
export function dayKey(nowISO: string): string {
  return nowISO.slice(0, 10);
}

export interface WindowDecision {
  allowed: boolean;
  /** Calls left AFTER this one (0 = this was the last allowed call). */
  remaining: number;
}

/** Decide whether call number (currentCount + 1) fits under the limit. */
export function windowDecision(currentCount: number, limitPerDay: number): WindowDecision {
  const used = Math.max(0, Math.floor(currentCount));
  const limit = Math.max(0, Math.floor(limitPerDay));
  if (used >= limit) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: limit - used - 1 };
}

/** Daily live-coach calls per tier (§1.1). */
export const COACH_DAILY_LIMIT: Record<SubscriptionTier, number> = {
  free: 10,
  pro: 40,
  elite: 80,
};

/** Daily photo-analysis burst cap, on top of the monthly quota (§1.1). */
export const PHOTO_DAILY_BURST = 20;

/** Daily research-mode calls (Elite feature). */
export const RESEARCH_DAILY_LIMIT = 10;

/**
 * Compose the storage key for a caller+route window. The caller id is a
 * userId when signed in, else a hash of the first-hop IP — never a raw IP.
 */
export function rateLimitKey(route: string, callerId: string): string {
  return `${route}:${callerId}`;
}
