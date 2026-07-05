# MONETIZATION.md — constraints (V3_SPEC Phase 6, recorded early)

- Supabase auth (v3 Phase 1) precedes any Stripe work.
- Primary distribution is the PWA: Stripe Checkout keeps the no-App-Store-cut advantage.
- **If the Capacitor build is ever submitted to the App Store, digital-goods purchases inside
  that build must use Apple In-App Purchase** — Stripe Checkout cannot be the purchase path in
  the iOS-native distribution. This is a distribution-channel constraint, not a product one;
  do not solve it before Phase 6 is actually scheduled.
- Tier shape (from V3_SPEC): Free = full logging + mock coach + streaks. Pro = live AI coach,
  photo nutrition, LifeGraph, weekly report. Entitlement checks happen server-side on the AI
  routes (the client-side tier system from E1 is UX, not enforcement).
- Safety features are free at every tier, permanently (standing rule; not negotiable in
  pricing design).
