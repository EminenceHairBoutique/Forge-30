/**
 * Entitlement engine — pure tier/feature logic for the subscription layer.
 *
 * Payments don't exist yet (see V2_FABLE_EXPANSION_PLAN.md E16: Supabase auth
 * → SupabaseAdapter → Stripe). This module ships now so every later chunk can
 * gate surfaces with `hasFeature()` from day one; until payments land, the
 * stored tier defaults to "max" so nothing regresses for current users, and a
 * dev-only switcher in Settings exercises the gates.
 *
 * Hard rule (tested, never weakened): crisis and safety surfaces are free at
 * every tier, permanently — BP crisis flow, injury red-flag escalation,
 * relationship safety escalation + resources, and all four disclaimers.
 */

export const TIERS = ["free", "plus", "pro", "max", "household"] as const;
export type Tier = (typeof TIERS)[number];

/** Rank for "this tier or higher" checks. Household includes everything. */
const TIER_RANK: Record<Tier, number> = { free: 0, plus: 1, pro: 2, max: 3, household: 4 };

/**
 * Safety features: always available, at every tier, forever. Listed
 * explicitly so a test can prove no tier map edit ever gates them.
 */
export const SAFETY_FEATURES = [
  "bpCrisisFlow",
  "injuryRedFlagEscalation",
  "relationshipSafetyEscalation",
  "disclaimers",
] as const;
export type SafetyFeature = (typeof SAFETY_FEATURES)[number];

/** Gated features and the minimum tier that unlocks each. */
export const FEATURE_TIERS = {
  // Plus
  unlimitedHistory: "plus",
  advancedCharts: "plus",
  savedTemplates: "plus",
  weeklyAIReviews: "plus",
  customPlans: "plus",
  exportImport: "plus",
  // Pro
  adaptiveNutrition: "pro",
  protocolsUnlimitedCompounds: "pro",
  protocolLevelCurves: "pro",
  protocolLabImport: "pro",
  injuryAwareTraining: "pro",
  assessments: "pro",
  psycheReport: "pro",
  relationshipTools: "pro",
  bloodworkReview: "pro",
  doctorExports: "pro",
  lifeGraph: "pro",
  // Max
  deepAIReviews: "max",
  researchMode: "max",
  documentParsing: "max",
  voicePhotoLogging: "max",
  wearableIntegrations: "max",
  advancedLifeGraph: "max",
  // Household
  householdMode: "household",
  sharedGoals: "household",
  householdBudget: "household",
  familyRoutines: "household",
} as const satisfies Record<string, Tier>;

export type GatedFeature = keyof typeof FEATURE_TIERS;
export type Feature = GatedFeature | SafetyFeature;

export function isSafetyFeature(feature: Feature): feature is SafetyFeature {
  return (SAFETY_FEATURES as readonly string[]).includes(feature);
}

/** The single gate every surface calls. Safety features pass unconditionally. */
export function hasFeature(tier: Tier, feature: Feature): boolean {
  if (isSafetyFeature(feature)) return true;
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_TIERS[feature]];
}

/** Lowest tier that unlocks a gated feature (for paywall copy). */
export function requiredTier(feature: GatedFeature): Tier {
  return FEATURE_TIERS[feature];
}

/**
 * Pre-payments default: existing users keep everything they have today.
 * Flips to "free" in E16 when real subscription state exists.
 */
export const DEFAULT_TIER: Tier = "max";

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}

/**
 * Server subscription tier → client tier (v3 Phase 7). The sellable ladder
 * is Free / Pro / Elite (V3_SPEC Phase 7); the client's finer-grained rank
 * system maps Elite onto "max". Client tiers are UX only — every AI route
 * re-checks server-side.
 */
export function tierFromSubscription(sub: "free" | "pro" | "elite"): Tier {
  if (sub === "elite") return "max";
  return sub;
}

/** Paywall display names for the sellable tiers. */
export const TIER_PRICING: Record<"pro" | "elite", { label: string; monthly: string; yearly: string }> = {
  pro: { label: "Pro", monthly: "$9.99/mo", yearly: "$79.99/yr" },
  elite: { label: "Elite", monthly: "$19.99/mo", yearly: "$149.99/yr" },
};
