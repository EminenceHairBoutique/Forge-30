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
