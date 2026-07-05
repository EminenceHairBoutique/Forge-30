# FORGE30 v3.3 — INTEGRATED AUDIT REMEDIATION MASTER PROMPT
### (Claude audit · July 5 + ChatGPT audit · reconciled)

**Executor:** Claude Code running Claude Fable 5 (`claude-fable-5`)
**Mode:** Brownfield remediation of branch `claude/forge30-pwa-build-2hb416` (commit `e142800`) — the deployed build. This file **replaces** `V3_2_PROMPT.md`.
**Inherited baseline (verified by execution July 5):** `tsc --noEmit` clean · **367/367** Vitest tests pass · `next build` succeeds (23 routes). The suite only grows.
**Binding context:** `V3_SPEC.md` rules and `DECISIONS.md` remain in force. Commit this file as `V3_3_PROMPT.md` plus both audits (`FORGE30_AUDIT_JUL5.md`, `Forge30_Audit.md`) to the repo root before starting.

---

## AUDIT RECONCILIATION — READ FIRST, DO NOT REDO FINISHED WORK

The second audit (ChatGPT) was performed against `main` — the pre-v3 MVP (36 tests, throwing Supabase scaffold). This branch is ~230 files and 367 tests ahead of what it reviewed. Status of its findings **on this branch**:

| ChatGPT finding | Status here | Action |
|---|---|---|
| No backend/login; SupabaseAdapter is a throwing scaffold | **Already built** — auth, `SyncedAdapter`, RLS, migrations 0001/0002/0004 | None. Do not rebuild. |
| Photos/voice buttons visible but disabled | Partially superseded by the flag registry | §2.9 consistency rule |
| Progress photos as base64 in localStorage | **Still true** (`BodyMetricSheet.tsx:43` → `toDataURL`) | §3.4 |
| `next lint` deprecated, no ESLint config, no CI | **Still true** (verified: no `.eslintrc*`, no `.github/workflows`) | §1.7, §1.8 |
| No request validation on `/api/coach` | **Still true** (verified: no body validation) | §1.9 |
| No error boundaries | **Still true** (verified: zero `error.tsx` in `app/`) | §1.10 |
| Onboarding too shallow (no fitness level, equipment, schedule, goals, diet, coaching style) | Coaching style **done** (assessment). The rest **still true** | §3.5 |
| Rate limiting / usage limits by tier | Open in both audits | §1.1 |
| Pricing: Plus $7.99–9.99 / Pro $14.99–19.99 | Superseded — Free/Pro/Elite already implemented; $9.99/$19.99 sits inside its brackets | Keep §F model (Phase 5) |
| Voice logging, reset-my-day, weekly interpretation | **Already built** (voice journal; Hard Day flow; weekly arc in coach) | None |

Everything else below is the Claude audit's task list (IDs B1–B6, C1–C10, D2–D5, E, F, G) with the surviving ChatGPT items woven into the correct phases.

## HOW TO RUN (operator)
1. `git checkout claude/forge30-pwa-build-2hb416 && git checkout -b v3.3-audit-fixes`.
2. Phase 1 in **Plan Mode** first; approve before code. One phase per session; `/clear` between.
3. Gate per phase: `npm run typecheck` → `npm test` → `npm run lint` (after §1.7 exists) → `npm run build` → subagent diff review against this file.
4. Operator-only (never the model): Vercel Deployment Protection off (audit B4), Supabase migrations, Stripe products, Vercel Cron, env vars — audit §H checklist.

## STANDING RULES
Components never bypass `lib/storage/adapter.ts` · pure logic in `lib/engine/*` with tests · adherence-neutral copy everywhere including errors, 429s, and empty states · coach guardrails, safety copy, and journal-consent gates never weakened (conflicts logged in `DECISIONS.md`, guardrail wins) · `lib/flags.ts` stays fail-closed · strict TS, no `any` escapes, no silent catches.

---

# PHASE 1 — CRITICAL FIXES & PRODUCTION HYGIENE

### 1.1 Rate limiting + unmetered guard (Claude B1 + ChatGPT §3) — security-critical
- Pure engine `lib/engine/rateLimit.ts` (+ tests): fixed-window `allow(key, limitPerDay, now)`.
- Server store `lib/server/rateLimit.ts`: Supabase-configured → new `rate_limits` table (`supabase/migrations/0005_rate_limits.sql`: `key text, day date, count int, primary key (key, day)`, service-role only). No Supabase → in-memory Map (acceptable only because of the guard below).
- Apply to `/api/coach` (10/day free, 40 pro, 80 elite), `/api/nutrition/photo` (20/day burst atop monthly quota), `/api/research` (10/day elite). Key = `userId` else hashed first-hop `x-forwarded-for`. 429 body in the friendly register ("Daily coach limit reached — the mock engine has you covered until tomorrow."); verify `lib/api.ts` treats 429 as fallback-eligible like 503.
- **Unmetered hard guard:** `lib/server/entitlements.ts` grants `{tier:"pro", unmetered:true}` only when `ALLOW_UNMETERED === "true"` is also set; otherwise a Supabase-less deployment resolves to free tier with IP-keyed limits. Tests for all three resolution paths. Update `docs/QA.md`.

### 1.2 Weekly report cold-start gate (Claude B2)
- `lib/engine/weeklySummary.ts`: `activeDays` = elapsed days with any logged activity. `activeDays < 3` → no verdict line (the line-82 class), no `mostMissedHabit`; instead: `Report builds as the week does — ${activeDays} day${s} in.` Make both fields optional in the type; typecheck finds every consumer; the report card renders them conditionally. Tests: day-1 empty, day-2 partial, day-4 active.

### 1.3 Status-bar scrim (Claude B3)
- `(app)` layout: fixed full-width scrim of height `env(safe-area-inset-top)` (backdrop blur + bottom fade, pointer-events none, above content) so scrolled pages never collide with the iOS clock. One-place fix; no double treatment on pages with their own sticky headers; zero layout shift.

### 1.4 Service-worker versioning + update toast (Claude B5)
- `prebuild` script writes `public/sw.js` from `sw.template.js`, injecting `GIT_SHA`/timestamp as `VERSION`. SW handles `{type:'SKIP_WAITING'}` → `self.skipWaiting()`; client `updatefound` listener shows a quiet "New version ready — tap to refresh" toast; never auto-reload mid-session.

### 1.5 Security headers + CORS pin (Claude G)
- `next.config.ts` `headers()`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`, `X-Frame-Options: DENY`, CSP (report-only first if a strict policy breaks hydration; document the final policy).
- API routes reject cross-origin browser requests via `origin`/`sec-fetch-site` vs deployment host; Stripe webhook + cron exempt (they authenticate by signature/secret).
- Guard test: grep-assert `SUPABASE_SERVICE_ROLE_KEY` never appears with `NEXT_PUBLIC_` and is imported only under `lib/server/` or `app/api/`.

### 1.6 Account deletion endpoint (Claude G)
- `app/api/account/delete/route.ts` (authenticated POST, typed confirmation): purge user's `sync_blobs`, `push_subscriptions`, `subscriptions`, `rate_limits`, then delete the auth user via service client. Settings → Data flow, clearly distinct from local-only delete; local data untouched.

### 1.7 ESLint migration (ChatGPT §4) — `next lint` is deprecated and interactive
- Add flat-config ESLint (`eslint.config.mjs`) with `eslint-config-next` (core-web-vitals) + TypeScript support; `"lint": "eslint ."` runs non-interactively and exits non-zero on errors. Fix every violation or disable a rule with an inline justification comment — no blanket rule-offs. Lint joins the phase gate from here on.

### 1.8 CI workflow (ChatGPT Phase 1)
- `.github/workflows/ci.yml`: on PR + push to `main` and `claude/**` — Node 22, `npm ci`, typecheck, lint, test, build, with npm cache. Badge in README optional.

### 1.9 API input validation (ChatGPT §3 + Claude G)
- Hand-rolled validators (no new dependency) in `lib/server/validate.ts` (+ tests): `/api/coach` body must match the `CoachInput` shape — types, enum membership, string length caps, array length caps — and total payload ≤ 64 KB; `/api/nutrition/photo` image base64 ≤ ~4 MB and media type allow-listed; `/api/push/subscribe` endpoint URL https + keys shape. Invalid → 400 with a plain-language error; never echo the payload back. Fuzz-ish tests: wrong types, oversized, extra keys.

### 1.10 Error boundaries (ChatGPT Phase 1) — currently zero exist
- `app/(app)/error.tsx` and `app/global-error.tsx` in the Solaris register: what happened in one calm line, a "Try again" (reset) button, a "Reload app" fallback; `console.error` the digest (no external telemetry yet). Verify the app shell (nav) survives route-level errors. A thrown render in dev proves both boundaries.

**Phase 1 acceptance:** all gates green including the new lint; suite grows ≥18 tests; Supabase-less build with an API key provably refuses unlimited anonymous calls; day-1 Progress shows the building line; malformed coach POST returns 400 without touching Anthropic; a forced render error shows the boundary, not a white screen.

---

# PHASE 2 — UX POLISH (Claude C1–C10)

2.1 **Mind check-in controls (C1):** replace the three 1–10 tap-circle rows with a full-width `components/ui/scale-slider.tsx` (drag + tap-to-set, large thumb, big current-value readout, ticks at 1/5/10, `aria-valuetext`). Data model unchanged. Reuse for the training pain scale and any other 1–10 row.
2.2 **Copy dedupes (C2, C3):** Money empty state becomes one line ("Nothing logged yet — first entry takes 10 seconds."), philosophy stays footer-only; Today gauge caption → "tap for breakdown".
2.3 **Coach tab overflow (C4):** right-edge fade mask; active tab `scrollIntoView` on select and mount.
2.4 **Progress hierarchy (C5):** weekly report first, Trends second, calendar third as a collapsed heat-strip (≤96px tall, day-state colored, today ringed) expanding to the full grid + legend on tap; deep-link/tap-a-day preserved in expanded mode.
2.5 **Assessment rename (C7):** "Trauma-Response & Coping Profile" → **"Stress Response Patterns"** everywhere via a display-key map (previously saved results render the new name); content and safety framing unchanged; rationale logged in `DECISIONS.md`.
2.6 **Accessibility (C10):** token-level contrast fixes to 4.5:1 for mono microlabels and dim body text; `aria-label` on every icon-only control; gauge `role="img"`; `prefers-reduced-motion` disables count-up and gauge sweep (`useCountUp` respects the media query).
2.7 **Chart lazy-load (C8):** recharts behind `next/dynamic({ssr:false})` on Progress/Protocols/Health with dimension-matched skeletons; `/progress` first-load JS < 220 kB (from 325 kB).
2.8 **Onboarding expectation line (C9):** onboarding final step + Day-1 gauge sublabel: "Your score builds as you log — 0 isn't a grade." Auto-removes after the first day with any log.
2.9 **Flag-surface consistency (ChatGPT §6):** one rule, applied everywhere: a flag-off feature is **hidden**, unless it markets an imminent Pro feature, in which case it renders the single standard "soon" chip treatment (the Health bloodwork chips are the pattern). Sweep every `FLAGS.*` consumer; no bespoke disabled buttons anywhere (the Nutrition page's, if still present, conform or disappear).

**Phase 2 acceptance:** gates green; iPhone-width screenshots of Mind, Money, Today, Progress in the PR; `/progress` bundle target met; VoiceOver spot-check list updated in `docs/QA.md`.

---

# PHASE 3 — CORE FEATURES & REAL PERSONALIZATION (Claude D2/D3/B6 + ChatGPT Phase 3)

### 3.1 Onboarding expansion (ChatGPT §2) — the personalization inputs
Add to `OnboardingGate` as one progressive-disclosure step-group (every field skippable with sane defaults; total onboarding stays under ~2 minutes): **fitness level** (new/returning/consistent), **equipment access** (none/bands+dumbbells/full gym), **schedule** (training days per week + minutes per session), **primary goal** (lose/build/maintain/energy), **diet preference** (none/high-protein/vegetarian/halal/kosher), **sleep quality** (rough/ok/good). Persist on the profile through the adapter. These are inputs, not clutter: each field must be consumed by 3.2 or the coach context — any field nothing reads does not ship.

### 3.2 Programs gallery driven by 3.1 (Claude D3 + ChatGPT "generate plans")
`lib/data/programs.ts` + pure assembly logic (+ tests): **First 30** (beginner, MVD-forward), **Comeback 30** (pain-aware: `workoutBuilder` biased by `painFlags`, slower load progression), **Busy 30** (≤20-min sessions, quick-add-heavy nutrition). Program selection defaults from the 3.1 answers (fitness level + schedule + goal → suggested program, changeable); equipment access biases exercise selection in `workoutBuilder`; diet preference biases meal templates and quick-adds; sleep quality feeds coach context. Onboarding picker (skippable, "Custom" = current behavior); Settings switch affects future days only, never rewrites history.

### 3.3 Full-account export (Claude D2)
Settings → Data: "Export everything (JSON)" — versioned envelope `{schema, exportedAt, data}` of every adapter collection, client-side; per-collection CSVs for logs/meals/workouts/spending/metrics. JSON full export is Elite; the existing spending CSV stays free.

### 3.4 Media storage discipline (Claude B6 + ChatGPT §5)
- **Progress photos:** `BodyMetricSheet` stops persisting base64 into the metric record; photos move to `largeStore` (IndexedDB) keyed by metric id, with a one-time migration in `lib/storage/migrations.ts` relocating existing embedded photos (test with a seeded legacy record). Excluded from cloud sync by default; Supabase Storage is a Phase-6 pointer, not now.
- **Voice journal:** cap 3:00 with a visible countdown from 0:30 remaining; store compressed (`audio/webm;codecs=opus` where supported, else what iOS MediaRecorder yields); excluded from sync by default with a Settings toggle ("Sync voice recordings" + size note); `largeStore.estimateUsage()` surfaced in Settings ("Journal media: 84 MB on this device"); export includes media only when "include media" is checked.

**Phase 3 acceptance:** gates green; every 3.1 field provably consumed (test or trace in PR notes); program switch mid-cycle non-destructive by test; legacy photo migration test passes; a 3:00 recording lands ≲3 MB on device.

---

# PHASE 4 — AI FLAG FLIPS (Claude E; ship dark, operator flips via env)

Convert `lib/flags.ts` to env-derived (`NEXT_PUBLIC_FLAG_*`, current values as defaults) so flips are ops, not builds. One feature per session, in order; each gets: live path, review-before-save UX wherever the AI writes data, deterministic fallback, Phase-1 entitlement + rate-limit + validation wiring, parse-failure fixtures, and guardrail tests.
1. **`photoMeal`** — route exists; finish UI stubs (camera/picker in AddMeal, editable line items, low-confidence deflection to search); verify quota + burst cap end-to-end.
2. **`transcription`** — `/api/journal/transcribe`: audio → transcript for user review before save; transcript joins theme extraction only under existing journal-consent gates. Pro.
3. **`bloodworkUpload`** — `/api/health/labs`: photo/PDF → structured markers, review-and-edit every value, lab's own reference ranges preserved. Pro. Health "soon" chips go live behind the flag.
4. **`lifeGraphAI`** — narration over deterministic `lifeGraph.ts` findings only, never invents patterns. Pro; deterministic pattern count stays free-visible.

**Acceptance:** flags off → zero UI change from Phase 3; every AI write path has a human review step; guardrail suite green.

---

# PHASE 5 — MONETIZATION SURFACE (Claude F; supersedes the ChatGPT tier table — Free/Pro/Elite is already implemented in `subscription.ts`)

- Paywall sheet: Free / Pro $9.99·$79.99 yr / Elite $19.99·$149.99 yr, feature table per audit §F, trust line verbatim: **"Downgrading never deletes your data — features stop generating, nothing is lost."** Contextual triggers only (quota hit, locked tap) — never an interstitial.
- 7-day Pro trial granted server-side on first live coach review render; one per user, enforced in `subscriptions`.
- Settings → Subscription: tier, renewal date, Stripe customer-portal route (`app/api/stripe/portal`), refresh-entitlement button.
- Never paywalled (assert in tests where feasible): logging, streaks, sync, push, doctor report, Hard Day flow, crisis/safety resources, mock coach, export/delete-data controls (per both audits).

**Acceptance:** test-mode checkout → webhook → tier flip round-trip; trial grants once; downgrade leaves all data readable; paywall renders correctly for all three tiers via the dev tier switcher.

---

# PHASE 6 — POINTERS ONLY (do not build in this run)
Capacitor App Store build + HealthKit + widgets + Watch (`docs/NATIVE_BUILD.md`, V3_SPEC Phase 3) · Supabase Storage for media · partner-mode share codes · weekly-report share card · `psycheReportLive` / `researchLive` as Elite anchors · Android/Health Connect. Each gets its own prompt when scheduled.

---

## GLOBAL ACCEPTANCE (every phase)
Typecheck clean · lint clean (post-1.7) · suite green and > 367 · build succeeds · CI green · no guardrail, safety copy, or consent gate weakened · adherence-neutral register in every new string (429s, paywalls, error boundaries included) · `DECISIONS.md` updated whenever this prompt was adapted rather than followed.
