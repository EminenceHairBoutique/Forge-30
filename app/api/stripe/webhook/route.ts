import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { tierForPrice } from "@/lib/engine/subscription";

/**
 * Stripe webhook (v3 Phase 7): signature-verified events → subscriptions
 * rows. The webhook is the ONLY writer of subscription state; entitlement
 * checks read it server-side on every AI route. Downgrade/cancel is
 * non-destructive by construction — this route only ever updates a tier
 * row, never touches user data.
 */

export const dynamic = "force-dynamic";

const PRICE_ENV = {
  proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  proYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  eliteMonthly: process.env.STRIPE_PRICE_ELITE_MONTHLY,
  eliteYearly: process.env.STRIPE_PRICE_ELITE_YEARLY,
};

function configured() {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(req: Request) {
  if (!configured()) return NextResponse.json({ error: "Billing not configured." }, { status: 404 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const upsert = async (
    userId: string,
    patch: {
      tier: string;
      status: string;
      stripe_customer_id?: string | null;
      stripe_subscription_id?: string | null;
      current_period_end?: string | null;
    }
  ) => {
    await supabase
      .from("subscriptions")
      .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id;
      if (userId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(String(session.subscription));
        const priceId = sub.items.data[0]?.price.id ?? "";
        const tier = tierForPrice(priceId, PRICE_ENV) ?? "pro";
        const periodEnd = sub.items.data[0]?.current_period_end;
        await upsert(userId, {
          tier,
          status: sub.status,
          stripe_customer_id: String(session.customer ?? ""),
          stripe_subscription_id: sub.id,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      // Find the user by stored subscription id (client_reference_id only
      // exists on checkout events).
      const { data: row } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();
      if (row?.user_id) {
        const priceId = sub.items.data[0]?.price.id ?? "";
        const tier = tierForPrice(priceId, PRICE_ENV) ?? "pro";
        const periodEnd = sub.items.data[0]?.current_period_end;
        await upsert(row.user_id as string, {
          tier: event.type === "customer.subscription.deleted" ? "free" : tier,
          status: sub.status,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        });
      }
      break;
    }
    default:
      break; // Unhandled events acknowledge cleanly.
  }
  return NextResponse.json({ received: true });
}
