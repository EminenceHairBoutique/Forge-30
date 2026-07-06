import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  monthKey,
  photoQuotaRemaining,
  resolveTierFromRow,
  type SubscriptionTier,
} from "@/lib/engine/subscription";

/**
 * Server-side entitlements (v3 Phase 7) — the authoritative check on every
 * AI route; client-side tier state is UX only.
 *
 * Fallback rules (graceful degradation, A2.5 + v3.3 §1.1 hard guard):
 * - Supabase not configured AND ALLOW_UNMETERED="true" (self-hosted /
 *   personal / dev builds, opted in explicitly): behave as Pro with no
 *   quotas — the pre-Phase-7 keyless experience never regresses.
 * - Supabase not configured WITHOUT that opt-in: free tier, IP-keyed rate
 *   limits — an API key on a backend-less deployment must never hand
 *   unlimited AI calls to anonymous traffic.
 * - Configured but the request carries no valid user: free tier.
 */

export function billingConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export interface Entitlement {
  tier: SubscriptionTier;
  userId: string | null;
  /** True when this build has no billing backend — quotas don't apply. */
  unmetered: boolean;
}

export async function resolveEntitlement(req: Request): Promise<Entitlement> {
  const supabase = serviceClient();
  if (!supabase) {
    // Unmetered hard guard (§1.1): backend-less builds get the quota-free
    // Pro experience only when the operator explicitly opted in.
    if (process.env.ALLOW_UNMETERED === "true") {
      return { tier: "pro", userId: null, unmetered: true };
    }
    return { tier: "free", userId: null, unmetered: false };
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { tier: "free", userId: null, unmetered: false };
  const { data, error } = await supabase.auth.getUser(token);
  const userId = error ? null : (data.user?.id ?? null);
  if (!userId) return { tier: "free", userId: null, unmetered: false };

  const { data: row } = await supabase
    .from("subscriptions")
    .select("tier,status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    tier: resolveTierFromRow(row ?? null, new Date().toISOString()),
    userId,
    unmetered: false,
  };
}

/**
 * Meter one photo analysis. Returns remaining quota (null = unlimited) or
 * -1 when over quota (the route replies with the friendly upgrade path).
 */
export async function meterPhotoUse(ent: Entitlement): Promise<number | null> {
  if (ent.unmetered || ent.userId === null) {
    // Unmetered builds pass; metered-but-anonymous gets the free taste
    // without server counting (no identity to meter against).
    return ent.unmetered ? null : photoQuotaRemaining(ent.tier, 0);
  }
  const supabase = serviceClient();
  if (!supabase) return null;
  const month = monthKey(new Date().toISOString());
  const { data: usage } = await supabase
    .from("ai_usage")
    .select("photo_count")
    .eq("user_id", ent.userId)
    .eq("month", month)
    .maybeSingle();
  const used = usage?.photo_count ?? 0;
  const remaining = photoQuotaRemaining(ent.tier, used);
  if (remaining !== null && remaining <= 0) return -1;
  await supabase
    .from("ai_usage")
    .upsert(
      { user_id: ent.userId, month, photo_count: used + 1 },
      { onConflict: "user_id,month" }
    );
  return remaining === null ? null : remaining - 1;
}
