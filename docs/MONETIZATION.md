# MONETIZATION.md — subscription design (V3_SPEC Rev 3.1 Phase 7)

**Pricing philosophy:** the free tier is the funnel *and* the moat — everything that
accumulates data or builds the daily habit stays free (logging, streaks, notifications,
sync, HealthKit, food search), because a user with 60 days of synced life data cannot leave.
The paywall sits on marginal-cost AI and on insight depth.

## Tiers

**Forge (free):** full logging in every domain · streaks + freezes · push notifications ·
cloud sync + multi-device · HealthKit passive data · food search + recents · 3 photo-meal
analyses/mo · mock coach daily review · deterministic weekly summary · Protocols: 1 compound,
manual labs, body map, reminders, **doctor report (free forever — safety features are never
paywalled)**.

**Pro — $9.99/mo or $79.99/yr** (7-day trial): live AI coach with 30-day memory · unlimited
photo nutrition (fair-use 150/mo) · adaptive calorie targets · LifeGraph pattern engine · AI
weekly deep report · Protocols: unlimited compounds, AI lab import, estimated-level curves,
protocol patterns in LifeGraph.

**Elite — $19.99/mo or $149.99/yr:** everything in Pro · coach runs `claude-opus-4-8`
(`COACH_MODEL_ELITE` override) · unlimited photo analyses · full data export · early-access
flags. Deliberately thin at launch — it anchors Pro's price.

## Mechanics

- `subscriptions` table written ONLY by the signature-verified Stripe webhook
  (`app/api/stripe/webhook`); entitlement checks are server-side on every AI route
  (`lib/server/entitlements.ts`) — never client-side flags. Client tier state is UX only.
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
  and the four price ids `STRIPE_PRICE_{PRO,ELITE}_{MONTHLY,YEARLY}` (+ the same PRO/ELITE
  monthly ids as `NEXT_PUBLIC_*` for the Settings buttons).
- PWA distribution uses Stripe Checkout (no App Store cut). **If the Capacitor build is ever
  submitted to the App Store, digital goods must use Apple IAP and external purchase links
  must be hidden in that build** — a distribution-channel constraint; do not solve early.
- **Downgrade is non-destructive:** data is never deleted or locked; features just stop
  generating new AI output. This is stated in the paywall copy because it's true.
- Unconfigured builds (no Stripe/Supabase env): no purchase UI renders anywhere, and the
  keyless self-hosted experience behaves as unmetered Pro — it never regresses.

## v3.3 Phase 5 — surface additions

- **Paywall sheet** (`components/cards/PaywallSheet.tsx`): contextual only — opened from a
  quota hit (AddMealSheet's over-quota 402/429) or a locked-feature tap (`PaywallCard`'s
  "See plans"), never an interstitial. Full Free/Pro/Elite feature table from
  `lib/data/pricing.ts` (safety + habit rows checked across all three tiers so the
  free-forever promise is visible, not just claimed), monthly/annual toggle, verbatim trust
  line. Buy buttons render only when `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set AND the user
  is signed in; otherwise it's an honest comparison with no dead CTA.
- **Customer portal** (`app/api/stripe/portal/route.ts`): POST → hosted Stripe billing portal
  for plan changes / cancel / card update; 404 unconfigured, 409 when the user has no Stripe
  customer yet, never writes subscription state (the webhook stays sole writer).
- **7-day trial**: granted server-side by `subscription_data.trial_period_days: 7` on the
  Checkout session; `status: "trialing"` is in `ACTIVE_STATUSES`, so entitlements resolve to
  the paid tier through the trial. One per customer (Stripe-enforced per customer id).
- **Settings → Subscription**: paid users get "Manage billing" (portal) + "Refresh" (re-pulls
  `/api/entitlements` and caches the tier locally after a checkout returns); free users get
  "See plans". Trust line: "Downgrading never deletes your data — features stop generating,
  nothing is lost."
- Annual price envs added: `NEXT_PUBLIC_STRIPE_PRICE_{PRO,ELITE}_YEARLY`.

**Never paywalled (asserted in `lib/data/pricing.test.ts`):** logging, streaks, sync, push,
food search, mock coach, crisis/safety resources, doctor report, Hard Day flow, and
export/delete-data controls — free on Free, Pro, and Elite alike.

WAIT(operator): create the four Stripe prices + set the eight price envs; register the webhook
endpoint + secret; test-mode round trip (checkout → webhook → tier flip → portal → cancel →
non-destructive downgrade) with the Stripe CLI.

## Webhook hardening (2026-07-06)

The webhook now handles the full lifecycle: `checkout.session.completed`,
`customer.subscription.created/updated/deleted`, `invoice.paid` (keeps `current_period_end`
fresh on renewal), and `invoice.payment_failed` (→ `status = past_due`, tier retained until it
recovers or the period + 24h grace lapses per `resolveTierFromRow`). Deliveries are idempotent
via the `stripe_events` ledger (migration 0007): a duplicate event id short-circuits; a handler
failure un-records the id so Stripe's retry reprocesses. The `subscriptions` row now carries
`billing_interval`, `current_period_start`, `cancel_at_period_end`, and `created_at`
(migration 0006, additive). The Stripe→row mapping is a pure, unit-tested function
(`subscriptionPatch` / `subscriptionIdFromInvoice` in `lib/engine/subscription.ts`).

**Register these 6 events on the webhook endpoint:** checkout.session.completed,
customer.subscription.created, customer.subscription.updated, customer.subscription.deleted,
invoice.paid, invoice.payment_failed.
