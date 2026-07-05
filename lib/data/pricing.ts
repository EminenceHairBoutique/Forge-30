/**
 * Pricing surface data (v3.3 Phase 5) — the feature table the paywall sheet
 * renders. Copy only; the server's entitlement checks (lib/engine/
 * entitlements.ts) remain authoritative. Prices mirror TIER_PRICING.
 */

export interface PlanColumn {
  key: "free" | "pro" | "elite";
  name: string;
  monthly: string;
  yearly: string | null;
  /** Env var holding the Stripe monthly price id (client-visible). */
  monthlyPriceEnv?: string;
  yearlyPriceEnv?: string;
}

export const PLAN_COLUMNS: PlanColumn[] = [
  { key: "free", name: "Forge", monthly: "Free", yearly: null },
  {
    key: "pro",
    name: "Pro",
    monthly: "$9.99/mo",
    yearly: "$79.99/yr",
    monthlyPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY",
    yearlyPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY",
  },
  {
    key: "elite",
    name: "Elite",
    monthly: "$19.99/mo",
    yearly: "$149.99/yr",
    monthlyPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_ELITE_MONTHLY",
    yearlyPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_ELITE_YEARLY",
  },
];

export interface FeatureRow {
  label: string;
  /** Cell content per tier — true = check, string = detail, false = dash. */
  free: boolean | string;
  pro: boolean | string;
  elite: boolean | string;
}

/**
 * Every safety/habit row is `true` across all three tiers — the paywall
 * itself makes the "free forever" promise visible, not just the copy.
 */
export const FEATURE_ROWS: FeatureRow[] = [
  { label: "Logging, streaks & sync", free: true, pro: true, elite: true },
  { label: "Notifications & HealthKit", free: true, pro: true, elite: true },
  { label: "Food search & mock coach", free: true, pro: true, elite: true },
  { label: "Crisis & safety resources", free: true, pro: true, elite: true },
  { label: "Doctor report & Hard Day", free: true, pro: true, elite: true },
  { label: "Export & delete your data", free: true, pro: true, elite: true },
  { label: "Photo nutrition / month", free: "3", pro: "150", elite: "Unlimited" },
  { label: "Live AI coach + 30-day memory", free: false, pro: true, elite: true },
  { label: "Adaptive targets & LifeGraph", free: false, pro: true, elite: true },
  { label: "Assessments & Psyche Report", free: false, pro: true, elite: true },
  { label: "AI bloodwork & lab import", free: false, pro: true, elite: true },
  { label: "Weekly deep report", free: false, pro: true, elite: true },
  { label: "Deepest AI reviews & research", free: false, pro: false, elite: true },
];

/** Verbatim trust line (V3_3_PROMPT §5). */
export const DOWNGRADE_TRUST_LINE =
  "Downgrading never deletes your data — features stop generating, nothing is lost.";
