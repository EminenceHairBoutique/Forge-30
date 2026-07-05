import { NextResponse } from "next/server";
import { billingConfigured, resolveEntitlement } from "@/lib/server/entitlements";

/**
 * Current entitlement for the caller (v3 Phase 7) — the client caches this
 * for UX gating; the AI routes re-check server-side on every call.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ent = await resolveEntitlement(req);
  return NextResponse.json({
    tier: ent.tier,
    unmetered: ent.unmetered,
    billingConfigured: billingConfigured() && !!process.env.STRIPE_SECRET_KEY,
  });
}
