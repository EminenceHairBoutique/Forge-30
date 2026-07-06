# AUDIT.md — Forge30 senior audit (2026-07-06)

Scope: full product / code / UX / market / AI / monetization / deployment audit, plus the
prioritized task list. Audited against the **working branch** `claude/forge30-pwa-build-2hb416`
(66 commits / ~438 tests ahead of the `main` a public GitHub link resolves to), not the v1
snapshot the request assumed.

> **Headline:** Forge30 is **over-built, not under-built.** The code is green and deep; the
> real risks are *provisioning*, *zero real-device QA*, *scope sprawl*, and the structural
> tension that the app's best feature (works fully offline, no login) is also its monetization
> weakness (no account ⇒ no subscription ⇒ no revenue, and the UI never asks users to sign in).

---

## A. Executive summary

235 TS/TSX files, ~438 passing tests, pure-engine architecture (`lib/engine/*`), a
`StorageAdapter` seam with offline-first Supabase sync, server-authoritative entitlements, a
hand-rolled service worker, and a "Starship OS" dual-theme design system. Nearly every feature
on the wishlist — personalized 30-day programs, injury-aware training, AI daily reviews,
adaptive targets, photo nutrition, reflection/LifeGraph analysis, progress summaries, a
"reset my day" Hard Day mode, tiered AI — **already exists**. "Add Stripe" is ~85% done.

The bottleneck is not engineering. It is:

1. **Nothing is provisioned.** With no `ANTHROPIC_API_KEY`, Supabase project, VAPID keys,
   cron, or Stripe products, the deployed app silently runs keyless/local-only: mock coach, no
   sync, no push, no purchases. It works, but none of the premium engine is switched on.
2. **Zero real-device QA.** Every verification so far is headless Playwright. iOS Safari
   standalone (safe-area, the floating dock over the home indicator, `MediaRecorder` audio,
   WebAuthn Face ID, print-to-PDF) has never met a physical iPhone.
3. **Scope sprawl.** Eight domains at once (nutrition, training, mind, money, skills, health,
   relationships, protocols). A positioning/retention hazard — what is the one-sentence pitch?
4. **No-login = no-revenue.** The offline-first, account-optional design is great for
   onboarding and terrible for monetization: subscriptions require an account the app never
   insists on.

## B. Critical bugs & blockers

Few *code* blockers (CI green). Sharp edges:

- **`ALLOW_UNMETERED` footgun** — `lib/server/entitlements.ts`. Setting it `true` without
  Supabase exposes unmetered Anthropic calls to the open internet. Guarded + documented, but
  it is the one config that can cost real money. Keep off in production.
- **`next/font/google` at build time** — `app/layout.tsx` fetches Space Grotesk / JetBrains
  Mono / Inter from Google at build. Vercel is fine; a network-locked CI would fail the build.
- **Webhook gaps** — `app/api/stripe/webhook/route.ts` lacks `invoice.paid` /
  `invoice.payment_failed` / `customer.subscription.created` and an explicit idempotency guard.
  (Addressed by the Stripe-hardening pass; see DECISIONS §18.)
- **Subscriptions RLS has no SELECT policy** (`0004`). By design — clients read
  `/api/entitlements`; the table is service-role-only. Confirmed as the intended model.
- **Transcription ships as 501** — `app/api/journal/transcribe`. The Anthropic Messages API
  takes no audio; voice-note transcription stays dark until a speech-to-text provider is wired
  (DECISIONS §14). The note always saves and plays back regardless.

## C. UX / UI improvement list

Design is strong (violet/cyan Starship HUD, plasma gauge, hex dock, boot splash, both themes
AA-tuned). Remaining:

- **"Today's one thing."** The dashboard shows everything at once; a first-timer can't tell
  what to do first. Add a focal card above the gauge.
- **Sign-in nudge** at the natural "I'd hate to lose this" moments (first streak milestone,
  first weekly report). Highest-leverage revenue UX; today only a quiet `BackupCard` exists.
- **Onboarding depth vs friction** — `OnboardingGate` now collects fitness level, equipment,
  schedule, sleep, diet, and a program. Every field is skippable; verify on-device it still
  feels < 2 minutes.
- **Simultaneous empty tabs** — eight domains mean a new user hits many "nothing logged yet"
  states at once. Sequence tabs by the chosen program.
- **Crisis-card color register** — `SupportResourcesCard` now renders red-family per the §2
  safety rule; red on a suicide-support card is a debatable emotional register. Worth a
  deliberate design call (a calmer neutral treatment, still brand-free, is defensible).

## D. Feature roadmap (connective, not additive)

The engine is deep; the gaps are the connective tissue.

- **Account-first moments** — surface sign-in where loss aversion peaks.
- **Program adherence loop** — `lib/engine/programs.ts` picks a plan but doesn't drive daily
  card ordering or nudge when a user drifts off it.
- **One-pattern hero** — LifeGraph exists; promote its single best weekly insight from a
  buried card to a moment.
- **Shareable weekly card** — a rendered image of the week's arc is the cheapest viral loop
  for a self-improvement app; none exists.

## E. AI feature roadmap (with tiering — mostly already shipped)

- **Free:** mock coach daily review, deterministic weekly summary, 3 photo analyses/mo,
  LifeGraph pattern *count*.
- **Pro:** live AI coach + 30-day memory (`app/api/coach`), photo nutrition (150/mo), adaptive
  targets, LifeGraph narration (`app/api/lifegraph/narrate`, flag-dark), AI bloodwork import
  (`app/api/health/labs`, flag-dark), weekly deep report.
- **Elite:** deepest reviews (opus model override), research mode (`app/api/research`, Elite +
  rate-limited).
- **Genuine gaps:** voice-note *transcription* (501 until an STT provider) and any *voice-out*
  coaching. Both Pro-tier when wired.

## F. Monetization plan (keep what's built)

Implemented: Free / **Pro $9.99·$79.99/yr** / **Elite $19.99·$149.99/yr**, 7-day trial,
non-destructive downgrade, never-paywalled safety/logging/export (asserted in
`lib/data/pricing.test.ts`). This is a *better* model than a generic Free/Plus/Pro — keep it
(DECISIONS §18). Retention levers that justify recurring pay: 30-day AI memory, adaptive
targets, the weekly deep report, cross-device sync. **The fix is the funnel, not the tiers:**
users can subscribe only after signing in, and the app doesn't ask.

## G. Security / privacy

Strong: server-only secrets pinned (`lib/server/envGuard.test.ts`), CSP + security headers,
cross-origin API pin, per-route rate limits, hand-rolled request validation, account-deletion
endpoint, webhook signature verification, service-role-only subscription writes. Residual: the
`ALLOW_UNMETERED` footgun (B), and a real pen-test once Supabase is live.

## H. Deployment checklist

- **Platform:** Vercel (Next.js 15 App Router). **Build:** `npm run build` (runs `prebuild` →
  SW version stamp).
- **Env:** `ANTHROPIC_API_KEY`, `COACH_MODEL`; Supabase (`NEXT_PUBLIC_SUPABASE_URL`, anon,
  `SUPABASE_SERVICE_ROLE_KEY`); VAPID pair + `CRON_SECRET`; Stripe (secret, webhook secret,
  publishable, 8 price IDs); optional `ALLOW_UNMETERED` / `COACH_MODEL_ELITE`.
- **DB:** run migrations `0001`–`0007`.
- **Wire:** register the Stripe webhook endpoint + a Vercel Cron for notifications.
- **Common failure:** forgetting the webhook signing secret ⇒ subscriptions never flip tier.

## I. iPhone-only testing checklist

Doable on an iPhone: install the PWA; both themes + toggle persistence across relaunch; boot
splash + reduced-motion skip; dock clears the home indicator; every log flow < 30s; magic-link
sign-in; photo nutrition; dose-log < 5s; print-to-PDF doctor report. **Needs a Mac:** the
Capacitor native build, HealthKit, and Stripe CLI webhook forwarding.

## J. Prioritized task list

- **Phase 1 — Critical fixes:** provision Supabase + env + run migrations; provision Stripe
  test-mode; the Stripe webhook hardening (DECISIONS §18); one real iPhone smoke pass.
- **Phase 2 — UX polish:** sign-in nudge at streak/weekly moments; "today's one thing" focal
  card; program-driven tab ordering.
- **Phase 3 — Core features:** program adherence loop; shareable weekly card.
- **Phase 4 — AI / personalization:** wire an STT provider → flip `transcription`; promote the
  single best LifeGraph insight to a hero moment.
- **Phase 5 — Monetization:** the Stripe delta (DECISIONS §18) + the account-first funnel.
- **Phase 6 — Ambitious:** Capacitor App Store build + HealthKit + widgets; partner/share codes.

---

*Method note: this audit is intentionally repo-specific and reflects the state of the working
branch, not the public v1. Where a request assumed missing functionality that already exists,
that is called out rather than re-implemented.*
