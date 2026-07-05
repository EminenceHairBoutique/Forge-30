# FORGE30 — FULL PRODUCT, CODE, UX & MONETIZATION AUDIT

**Date:** July 5, 2026 · **Branch audited:** `claude/forge30-pwa-build-2hb416` (the deployed build, commit `e142800`) · **Verified by execution:** `tsc --noEmit` clean · **367/367 Vitest tests pass** · production `next build` succeeds, 23 routes.

---

## A. EXECUTIVE SUMMARY

The deployed branch is a different product from `main` — it implements essentially the entire V3 spec: Supabase auth + offline-first sync, push notifications with a cron engine, Stripe subscriptions with server-side entitlements, streaks with freezes, adaptive AI coach with guardrails pinned in CI, LifeGraph, assessments with a Psyche Report, Health, Relationships, Social, and a fully rail-compliant Protocols tab. 235 files, ~33,000 lines of strict TypeScript, 33 test files. The engineering discipline is genuinely unusual for a solo-founder app: pure engines with tests, a fail-closed flag registry, signature-verified webhooks, consent-gated journal access, and crisis resources that never sit behind a paywall.

**The honest verdict:** the hard architecture problems are solved. What stands between this build and "state of the art" is now (1) a short list of real bugs and cost exposures, (2) UX polish visible in your own screenshots, (3) flipping the dark-shipped AI features on deliberately, and (4) launch operations — env config, cron, Stripe, and turning off deployment protection so a human can actually use it. Nothing on the critical list takes more than a day each.

**Top 5 actions:** ① add rate limiting to the AI routes before any public URL exists (unmetered mode = anonymous unlimited Anthropic spend today); ② fix the day-1 weekly report ("Rough week at 0 average" on an empty first day violates your own adherence-neutral rule and is the first impression); ③ fix the scrolled-header/status-bar collision on iOS; ④ replace the 1–10 tap-circle rows in Mind with thumb-sized controls; ⑤ run the launch checklist in §H.

---

## B. CRITICAL BUGS & BLOCKERS

**B1 — No rate limiting on any API route (cost + abuse exposure). Severity: critical before public launch.**
`lib/server/entitlements.ts` deliberately resolves to `{tier:"pro", unmetered:true}` when Supabase env vars are absent — correct for personal builds, but it means a deployment with `ANTHROPIC_API_KEY` set and Supabase unset serves **unlimited, anonymous** live-coach and photo calls to anyone with the URL. Even fully configured, a signed-in free user can hammer `/api/coach` with no throttle (`grep` confirms zero rate-limit code). Fix: a small fixed-window limiter keyed on `userId ?? IP` (Supabase table or Upstash) on `/api/coach`, `/api/nutrition/photo`, `/api/research` — e.g., 10 coach calls/day free, 40 pro; and refuse `unmetered` mode entirely when the request origin isn't localhost unless `ALLOW_UNMETERED=true` is explicitly set.

**B2 — Weekly report cold start produces a false verdict. Severity: high (first-run impression + tone rule violation).**
`lib/engine/weeklySummary.ts:82` emits `Rough week at ${avg} average — reset, don't spiral.` whenever the average is low — including Day 1 with zero logged data, exactly what your Progress screenshot shows, alongside "Most-missed habit: calories" derived from one empty day. This is a verdict on a week that hasn't happened, from an engine whose own constitution says missed ≠ shamed. Fix: require ≥3 elapsed days *with any logged activity* before verdict lines or most-missed render; below that, show "Report builds as the week does — N days in." Add a cold-start unit test.

**B3 — Page headers scroll under the iOS status bar. Severity: high (visible on 3 of your 18 screenshots).**
Money, Log, and Progress screenshots show page text colliding with the clock. The shell has `env(safe-area-inset-top)` padding (`globals.css:245`) but scrolled content passes beneath the status bar with no backdrop. Fix: sticky page header with `backdrop-filter: blur` + top gradient mask, or a fixed safe-area scrim in the `(app)` layout. Test in installed-PWA standalone mode where the status bar floats.

**B4 — Deployment protection is still on.** The Vercel preview URL 302s to a Vercel login; no user (or reviewer, or beta tester) can reach the app. Promote the branch to a production deployment or disable protection for this preview.

**B5 — Service-worker version is hand-bumped.** `public/sw.js` `VERSION = "forge30-v21"` — a forgotten bump ships a stale app shell to installed PWAs (users see old UI until a hard refresh they don't know how to do). Fix: inject a build hash into `VERSION` at build time (`scripts/` already exists) and add `self.skipWaiting()` + a "New version — tap to refresh" toast.

**B6 — Voice-journal audio in the backup path will hit quota.** Audio blobs ride `largeStore` (IndexedDB) and "the full backup in Settings → Data" per your journal screenshot. Minutes of audio = megabytes; the JSON export path will balloon and the sync blob ceiling will be hit. Fix: cap recording length (e.g., 3 min), store compressed (Opus via MediaRecorder is fine), exclude audio from cloud sync by default with an explicit toggle, and show storage-used in Settings.

**Non-blockers noted:** migration numbering gap (`0003` absent — protocols ride `sync_blobs` by design; document it in the migrations README so a future you doesn't hunt for a lost file); `/progress` and `/protocols` first-load JS at 325kB/318kB (recharts — see C8).

---

## C. UX/UI IMPROVEMENT LIST (from your live screenshots + code)

1. **Mind check-in scales (screenshot 2):** three rows of ten ~small tap circles is the hardest interaction in the app, used daily. Replace with a full-width segmented slider (drag + tap, haptic on iOS via Capacitor later) or 5-point faces for mood. Keep 1–10 in the data model; only the control changes.
2. **Money page duplication (screenshots 4–5):** the "philosophy" paragraph renders in the empty TODAY'S ENTRIES card *and* as the page footer. Keep the footer, make the empty state one line ("Nothing logged yet — first entry takes 10 seconds.").
3. **Today gauge duplication (screenshot 16):** "SCORE BUILDING / DAY IN PROGRESS" inside the dial plus "day in progress · tap for breakdown" directly beneath says the same thing twice within 60px. Keep the dial label; change the caption to just "tap for breakdown."
4. **Coach tab overflow (screenshot 13):** "Hard d…" truncates with no scroll affordance. Add a right-edge fade mask and let the active tab auto-scroll into view.
5. **Progress information hierarchy (screenshots 8, 11):** the 30-day calendar consumes ~1.5 screens before any insight appears. On mobile, lead with the weekly report + trend, and collapse the calendar to a compact heat-strip (30 small squares, one row per week) that expands on tap. The six-chip legend can live behind the expansion.
6. **Empty-state gold standard exists — apply it everywhere:** "One day logged. A trend line starts at two — tomorrow's log draws it" (Trends) and "Nothing here yet. The page doesn't judge." (Journal) are exactly right. The weekly report (B2) and Health score dial ("log anything below to start" is good; the blank dash reads broken) should match this register.
7. **"Trauma-Response & Coping Profile" naming (screenshot 9):** the safety framing around it is excellent (crisis card, "stopping is a fine choice"), but the name promises a clinical instrument. Rename to "Stress Response Patterns" and keep the same content — same user value, much smaller claim, consistent with "never a verdict."
8. **Performance:** lazy-load recharts (`next/dynamic`, `ssr:false`) on Progress/Protocols to cut ~120kB from first paint; the dial and stat cards render instantly, charts hydrate in.
9. **Onboarding:** `OnboardingGate` exists; ensure the first-run path sets expectations for Day 1 scoring (a "score builds as you log — 0 isn't a grade" line would defuse the B2 class of problem emotionally as well as technically).
10. **Accessibility pass:** the mono microlabels (`JOURNAL PRIVACY`, `SAFE TO SPEND…`) render ~11px letter-spaced — verify 4.5:1 contrast on the champagne-on-brown palette; add `aria-label`s to the icon-only quick actions; respect `prefers-reduced-motion` on the gauge animation.

---

## D. FEATURE ROADMAP (product, non-AI)

Already built and dark (flip when ready — see flags registry): barcode lookup, wearables, light mode. Genuinely missing, in priority order:

1. **Home-screen widgets + Apple Watch quick-log** (Capacitor build): today's score ring, next dose, one-tap water/meal. Widgets are the retention surface every category leader has and you don't.
2. **Data portability:** CSV/JSON export exists for spending; extend to full-account export (also the Elite differentiator you spec'd).
3. **Templates/programs gallery:** the workout builder + seeded plans exist; packaging 3–5 named 30-day programs ("First 30," "Comeback 30" for injured users, "Busy 30" at 20 min/day) makes the app legible to beginners, injured users, and the time-poor at onboarding.
4. **Partner mode for Relationships:** couples comparison exists single-device; a share-code flow (answer separately on two phones, compare via sync) is the viral loop.
5. **Referral loop:** the screenshot-worthy weekly report is the shareable artifact — add a "share card" render (image export, no personal data by default).

## E. AI FEATURE ROADMAP

Most of your AI surface already exists behind fail-closed flags. Recommended flip order (each is a flag + env, not a build):
1. `photoMeal` (Pro) — biggest daily-friction win; quota logic already implemented (3/mo free, 150/mo Pro).
2. `transcription` (Pro) — voice journal → text; makes journals searchable and theme-extraction real.
3. `bloodworkUpload` (Pro) — the "Add report / PDF · photo (soon)" chips in your Health screenshot go live; parser + review-edit flow per spec.
4. `lifeGraphAI` (Pro) — narrative layer over the deterministic patterns (deterministic findings stay free-visible in count, full patterns Pro).
5. `psycheReportLive` (Elite) — the unified narrative report.
6. `researchLive` (Elite) — cited, web-grounded answers; the fail-closed design here is correct, keep it.
Voice-based coaching and "reset my day" mode: the Hard Day flow *is* reset-my-day (keep free forever — it's a safety valve, not a feature); voice coach is a post-Capacitor item, don't build for web audio.

## F. MONETIZATION PLAN

The implemented model matches the V3 spec and is right. Final recommendation: **Free** = all logging, streaks+freezes, sync, push, mock coach, deterministic weekly summary, 3 photo analyses/mo, 1 protocol compound, doctor report (never paywall safety artifacts, crisis resources, or Hard Day mode). **Pro $9.99/mo · $79.99/yr, 7-day trial triggered after the first coach review renders** = live adaptive coach with memory, 150 photo/mo, adaptive targets, LifeGraph, AI weekly deep report, unlimited compounds, lab import. **Elite $19.99/mo · $149.99/yr** = Opus-tier coach + monthly "State of You," unlimited photo, full export, early flags. Lock behind login: sync, push, billing — nothing else (the app must stay fully usable signed-out; it already is). Retention justifying recurrence: coach memory + LifeGraph patterns compound with data — cancelling means losing a brain that knows your last 30 days, and the paywall copy should say downgrade never deletes data (the webhook already guarantees it).

## G. SECURITY / PRIVACY CONCERNS

Good: service-role key server-only; anon key only client secret; RLS on every table incl. `sync_blobs`; Stripe signature verification; journal consent model with private-entry exclusion upstream of the model; protocol rail pinned by red-team tests; no hardcoded secrets found. Fix/verify: **B1 rate limiting**; add a `Permissions-Policy`/security-headers block in `next.config.ts` (CSP at least for script-src self); CORS — API routes currently accept any origin, pin to your domain; `SUPABASE_SERVICE_ROLE_KEY` must never be added with a `NEXT_PUBLIC_` prefix (worth a CI grep guard); confirm Vercel logs don't capture coach request bodies (journal themes transit there — consider a `no-log` note and keeping themes to single words as designed); add account-deletion server path (local delete exists; GDPR/CCPA needs the `sync_blobs` purge — one authenticated endpoint).

## H. DEPLOYMENT CHECKLIST (Vercel)

1. Merge or promote `claude/forge30-pwa-build-2hb416`; **disable Deployment Protection** on the production target.
2. Supabase: run `0001_core.sql`, `0002_push.sql`, `0004_subscriptions.sql` in order; enable email magic-link (+ Apple/Google per `docs/AUTH_SETUP.md`); set Site URL to the prod domain.
3. Env vars (server unless noted): `ANTHROPIC_API_KEY`, `COACH_MODEL` (optional), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`), `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, four `STRIPE_PRICE_*` ids.
4. Vercel Cron: `*/15 * * * *` → `/api/cron/notify` with the secret header (add `vercel.json` if not present).
5. Stripe: create the four prices; webhook endpoint → `/api/stripe/webhook` with events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
6. Build command `next build` (default). Common failure modes: missing env at build (all reads are runtime-guarded — good), cron 401s from a mismatched secret, push failing on non-installed iOS Safari (expected; UI gates it).
7. Post-deploy smoke: sign-in on two devices → data round-trips; airplane-mode log → syncs on reconnect; coach returns live review; webhook test event flips a tier; cron dry-run sends nothing twice.

## I. IPHONE-ONLY TESTING CHECKLIST

Doable entirely from the phone: install to Home Screen → standalone launch, safe areas top/bottom, offline open + log + relaunch; notification permission prompt only appears installed; morning/evening pushes deliver with discreet copy; magic-link sign-in via Mail; Stripe Checkout test card in Safari sheet; photo-meal capture → editable line items; every tab's empty states; streak chip day 2; Hard Day flow; VoiceOver spot-check (Settings → Accessibility) on Today and Mind; Dynamic Type at XL; battery/thermals during a 10-min session (a category competitor ships a heat bug — beat that). Requires a desktop/Mac: Supabase SQL editor is *possible* on mobile but painful — fine on iPad; Stripe dashboard product setup (borderline on phone); **Xcode for the Capacitor iOS build and any HealthKit work — Mac only, no workaround**; Lighthouse/bundle profiling.

## J. PRIORITIZED TASK LIST

**Phase 1 — Critical fixes (this week):** B1 rate limiting + unmetered guard · B2 weekly-report cold-start gate + test · B3 status-bar scrim · B4 open the deployment · B5 SW version automation · security headers + CORS pin.
**Phase 2 — UX polish:** C1 Mind sliders · C2 Money dedupe · C3 gauge caption · C4 tab fade · C5 Progress hierarchy/heat-strip · C7 assessment rename · C10 a11y pass · C8 lazy-load recharts.
**Phase 3 — Core features:** programs gallery (D3) · full-account export (D2) · account-deletion endpoint (G) · audio caps + sync exclusion (B6) · widgets groundwork in Capacitor project.
**Phase 4 — AI/personalization:** flip `photoMeal` → `transcription` → `bloodworkUpload` → `lifeGraphAI` in that order, one week apart, watching cost per user · coach follow-through metrics on the Progress page.
**Phase 5 — Monetization:** Stripe live keys · paywall screens with "downgrade never deletes data" copy · trial trigger after first coach review · App Store IAP decision deferred per `docs/MONETIZATION.md`.
**Phase 6 — Ambitious:** Capacitor App Store build + HealthKit + widgets + Watch · partner mode share codes (D4) · share-card referral loop (D5) · `psycheReportLive` + `researchLive` as Elite anchors · Android/Health Connect.

---

### Competitor positioning (condensed from the July 2026 category research)
Against Fabulous/Habitica (habits): you win on real data engines + AI coach; they win on content libraries and social — programs gallery (D3) closes half that gap. Against MacroFactor (nutrition): photo logging + adaptive targets puts you at "good enough to not leave." Against Strong/Hevy (training): pain-aware engine is your differentiator; widgets are theirs. Against Shotsy/Regimen/PinPoint (protocols): you already exceed the parity set and are the only product where dose events correlate against sleep, mood, money, and training — that sentence is the marketing. Against WHOOP/Oura: passive data needs Phase 6 HealthKit. The moat statement remains: *the only app whose coach knows your whole 30 days.*
