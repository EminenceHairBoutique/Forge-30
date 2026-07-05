import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * Stripe Checkout session (v3 Phase 7). PWA distribution → Stripe Checkout
 * (no App Store cut). Signed-in users only (the subscription follows the
 * account); 7-day trial on the subscription. 404 when billing isn't
 * configured, so unconfigured builds show no purchase UI anywhere.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

  let body: { priceId?: string; origin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const allowedPrices = [
    process.env.STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_PRO_YEARLY,
    process.env.STRIPE_PRICE_ELITE_MONTHLY,
    process.env.STRIPE_PRICE_ELITE_YEARLY,
  ].filter(Boolean);
  if (!body.priceId || !allowedPrices.includes(body.priceId)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  const origin =
    typeof body.origin === "string" && body.origin.startsWith("https")
      ? body.origin
      : (process.env.NEXT_PUBLIC_API_ORIGIN ?? "");

  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    line_items: [{ price: body.priceId, quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
    success_url: `${origin}/settings?upgraded=1`,
    cancel_url: `${origin}/settings`,
    allow_promotion_codes: true,
  });
  return NextResponse.json({ url: session.url });
}
