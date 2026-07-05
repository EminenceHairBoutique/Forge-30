/**
 * Subscription rules (v3 Phase 7, pure). Row → tier resolution with a
 * period-end grace window, month keys for quota metering, and the quota
 * table. The pricing philosophy is encoded here once: everything that
 * accumulates data or builds the habit is free; the paywall sits on
 * marginal-cost AI and insight depth. Downgrade is non-destructive by
 * construction — nothing in this module (or anywhere) deletes data.
 */

export type SubscriptionTier = "free" | "pro" | "elite";

export interface SubscriptionRow {
  tier: string;
  status: string;
  current_period_end: string | null;
}

/** Statuses that grant the paid tier (trialing counts — 7-day trial). */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
/** Grace after period end, for webhook lag. */
export const PERIOD_GRACE_MS = 24 * 60 * 60 * 1000;

export function resolveTierFromRow(
  row: SubscriptionRow | null,
  nowIso: string
): SubscriptionTier {
  if (!row) return "free";
  if (row.tier !== "pro" && row.tier !== "elite") return "free";
  if (!ACTIVE_STATUSES.has(row.status)) return "free";
  if (row.current_period_end) {
    const end = new Date(row.current_period_end).getTime() + PERIOD_GRACE_MS;
    if (new Date(nowIso).getTime() > end) return "free";
  }
  return row.tier;
}

/** "YYYY-MM" quota bucket. */
export function monthKey(nowIso: string): string {
  return nowIso.slice(0, 7);
}

/** Photo-analysis quotas: Free tastes Pro; Pro is fair-use; Elite unlimited. */
export const PHOTO_QUOTA: Record<SubscriptionTier, number | null> = {
  free: 3,
  pro: 150,
  elite: null,
};

export function photoQuotaRemaining(tier: SubscriptionTier, usedThisMonth: number): number | null {
  const quota = PHOTO_QUOTA[tier];
  if (quota === null) return null; // unlimited
  return Math.max(0, quota - usedThisMonth);
}

/** Live-AI features gate at Pro; Elite adds the opus coach + long memory. */
export function canUseLiveCoach(tier: SubscriptionTier): boolean {
  return tier === "pro" || tier === "elite";
}

/** Stripe price id → tier, from env (documented in docs/MONETIZATION.md). */
export function tierForPrice(
  priceId: string,
  env: { proMonthly?: string; proYearly?: string; eliteMonthly?: string; eliteYearly?: string }
): SubscriptionTier | null {
  if (priceId === env.proMonthly || priceId === env.proYearly) return "pro";
  if (priceId === env.eliteMonthly || priceId === env.eliteYearly) return "elite";
  return null;
}
