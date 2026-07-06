import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { dayKey, rateLimitKey, windowDecision, type WindowDecision } from "@/lib/engine/rateLimit";

/**
 * Server-side rate-limit store (v3.3 §1.1).
 *
 * Supabase configured → the rate_limits table (0005_rate_limits.sql,
 * service-role only) so limits hold across serverless instances.
 * Not configured → an in-memory map. That's acceptable only because the
 * unmetered hard guard in entitlements.ts means a Supabase-less deployment
 * resolves anonymous callers to the free tier with these limits applied.
 */

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

// In-memory fallback: key → { day, count }. Pruned lazily on day change.
const memory = new Map<string, { day: string; count: number }>();

/** Identity for the window: userId when signed in, else hashed first-hop IP. */
export function callerId(req: Request, userId: string | null): string {
  if (userId) return userId;
  const forwarded = req.headers.get("x-forwarded-for") ?? "unknown";
  const firstHop = forwarded.split(",")[0]?.trim() ?? "unknown";
  return `ip-${createHash("sha256").update(firstHop).digest("hex").slice(0, 16)}`;
}

/**
 * Count one call against the caller's daily window for a route.
 * Returns the decision; on any storage error it allows the call (rate
 * limiting protects spend — it must never take the product down).
 */
export async function consumeRateLimit(
  route: string,
  caller: string,
  limitPerDay: number
): Promise<WindowDecision> {
  const key = rateLimitKey(route, caller);
  const day = dayKey(new Date().toISOString());
  const supabase = serviceClient();

  if (!supabase) {
    const entry = memory.get(key);
    const count = entry && entry.day === day ? entry.count : 0;
    const decision = windowDecision(count, limitPerDay);
    if (decision.allowed) memory.set(key, { day, count: count + 1 });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.day !== day) memory.delete(k);
    }
    return decision;
  }

  try {
    const { data } = await supabase
      .from("rate_limits")
      .select("count")
      .eq("key", key)
      .eq("day", day)
      .maybeSingle();
    const count = data?.count ?? 0;
    const decision = windowDecision(count, limitPerDay);
    if (decision.allowed) {
      await supabase
        .from("rate_limits")
        .upsert({ key, day, count: count + 1 }, { onConflict: "key,day" });
    }
    return decision;
  } catch {
    return windowDecision(0, limitPerDay);
  }
}

/** Test hook: clear the in-memory window store. */
export function resetMemoryRateLimitsForTests(): void {
  memory.clear();
}
