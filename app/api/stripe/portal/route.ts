import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { crossOriginBlocked } from "@/lib/server/origin";

/**
 * Stripe customer-portal session (v3.3 Phase 5). Signed-in subscribers open
 * the hosted portal to change plan, update card, or cancel. 404 when billing
 * isn't configured; 409 when the user has no Stripe customer yet (they've
 * never checked out). Never writes subscription state — the webhook remains
 * the sole writer.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (crossOriginBlocked(req)) {
    return NextResponse.json({ error: "Cross-origin requests aren't accepted." }, { status: 403 });
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !url || !serviceKey) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 404 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  const user = error ? null : data.user;
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { data: row } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const customerId = row?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "No subscription to manage yet." }, { status: 409 });
  }

  let origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";
  try {
    const body = (await req.json()) as { origin?: string };
    if (typeof body.origin === "string" && body.origin.startsWith("https")) origin = body.origin;
  } catch {
    // origin falls back to the configured API origin.
  }

  const stripe = new Stripe(secretKey);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/settings`,
  });
  return NextResponse.json({ url: session.url });
}
