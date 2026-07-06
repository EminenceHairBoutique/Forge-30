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
export type PriceEnv = {
  proMonthly?: string;
  proYearly?: string;
  eliteMonthly?: string;
  eliteYearly?: string;
};

export function tierForPrice(priceId: string, env: PriceEnv): SubscriptionTier | null {
  if (priceId === env.proMonthly || priceId === env.proYearly) return "pro";
  if (priceId === env.eliteMonthly || priceId === env.eliteYearly) return "elite";
  return null;
}

// ---------------------------------------------------------------------------
// Stripe webhook mapping (pure). Structural shapes — no SDK import — so the
// webhook route stays thin I/O and this mapping is unit-tested. Stripe's own
// Subscription/Invoice objects are structurally assignable to these.
// ---------------------------------------------------------------------------

export interface StripeSubShape {
  id: string;
  status: string;
  cancel_at_period_end?: boolean | null;
  items: {
    data: Array<{
      price: { id: string; recurring?: { interval?: string | null } | null };
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  };
}

export interface SubscriptionPatch {
  tier: SubscriptionTier;
  status: string;
  stripe_subscription_id: string;
  current_period_end: string | null;
  current_period_start: string | null;
  cancel_at_period_end: boolean;
  billing_interval: string | null;
}

const isoFromUnix = (s: number | null | undefined): string | null =>
  typeof s === "number" ? new Date(s * 1000).toISOString() : null;

/**
 * Build the subscriptions-row patch from a Stripe subscription. `tierOverride`
 * forces the tier (e.g. "free" on delete); `statusOverride` forces status
 * (e.g. "past_due" on invoice.payment_failed).
 */
export function subscriptionPatch(
  sub: StripeSubShape,
  env: PriceEnv,
  overrides?: { tier?: SubscriptionTier; status?: string }
): SubscriptionPatch {
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? "";
  return {
    tier: overrides?.tier ?? tierForPrice(priceId, env) ?? "pro",
    status: overrides?.status ?? sub.status,
    stripe_subscription_id: sub.id,
    current_period_end: isoFromUnix(item?.current_period_end),
    current_period_start: isoFromUnix(item?.current_period_start),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    billing_interval: item?.price.recurring?.interval ?? null,
  };
}

export interface StripeInvoiceShape {
  subscription?: string | { id: string } | null;
  lines?: { data?: Array<{ subscription?: string | { id: string } | null }> };
}

/** Extract the subscription id from an invoice across Stripe API versions. */
export function subscriptionIdFromInvoice(invoice: StripeInvoiceShape): string | null {
  const read = (v: unknown): string | null =>
    typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? String((v as { id: string }).id) : null;
  const direct = read(invoice.subscription);
  if (direct) return direct;
  return read(invoice.lines?.data?.[0]?.subscription);
}
