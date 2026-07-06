import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { subscriptionIdFromInvoice, subscriptionPatch } from "@/lib/engine/subscription";

/**
 * Stripe webhook (v3 Phase 7 + hardening): signature-verified events →
 * subscriptions rows. The webhook is the ONLY writer of subscription state;
 * entitlement checks read it server-side on every AI route. Downgrade/cancel
 * is non-destructive by construction — this route only ever updates a tier
 * row, never touches user data.
 *
 * Idempotent: each event id is recorded in stripe_events before processing
 * (Stripe retries deliveries). A confirmed duplicate short-circuits; a
 * handler failure removes the ledger row so Stripe's retry reprocesses.
 * The state handlers are absolute-state upserts, so reprocessing is safe.
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

async function userIdForSubscription(supabase: SupabaseClient, subscriptionId: string): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
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

  // Idempotency: record the event id first. A unique-violation (23505) means
  // we've already processed this delivery → acknowledge and skip.
  const { error: ledgerError } = await supabase
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (ledgerError) {
    if (ledgerError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // A ledger write failure shouldn't block a legitimate event; fall through.
  }

  const upsert = (userId: string, patch: object) =>
    supabase
      .from("subscriptions")
      .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (userId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(session.subscription));
          await upsert(userId, {
            ...subscriptionPatch(sub, PRICE_ENV),
            stripe_customer_id: String(session.customer ?? ""),
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = await userIdForSubscription(supabase, sub.id);
        // No row yet (created may precede checkout.session.completed) → the
        // checkout event, which carries client_reference_id, creates it.
        if (userId) {
          const deleted = event.type === "customer.subscription.deleted";
          await upsert(
            userId,
            subscriptionPatch(sub, PRICE_ENV, deleted ? { tier: "free", status: "canceled" } : undefined)
          );
        }
        break;
      }

      case "invoice.paid": {
        const subId = subscriptionIdFromInvoice(event.data.object);
        if (subId) {
          const userId = await userIdForSubscription(supabase, subId);
          if (userId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            await upsert(userId, subscriptionPatch(sub, PRICE_ENV));
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const subId = subscriptionIdFromInvoice(event.data.object);
        if (subId) {
          const userId = await userIdForSubscription(supabase, subId);
          if (userId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            // Keep the tier; flag the account as past_due until it recovers.
            await upsert(userId, subscriptionPatch(sub, PRICE_ENV, { status: "past_due" }));
          }
        }
        break;
      }

      default:
        break; // Unhandled events acknowledge cleanly.
    }
  } catch (err) {
    // Un-record so Stripe's retry reprocesses this event.
    await supabase.from("stripe_events").delete().eq("id", event.id);
    const message = err instanceof Error ? err.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
