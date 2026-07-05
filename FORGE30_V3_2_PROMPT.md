# FORGE30 v3.2 — AUDIT REMEDIATION & POLISH MASTER PROMPT

**Executor:** Claude Code running Claude Fable 5 (`claude-fable-5`)
**Mode:** Brownfield remediation of branch `claude/forge30-pwa-build-2hb416` (commit `e142800`) — the deployed build. NOT a rebuild.
**Source of truth:** the July 5, 2026 audit (`FORGE30_AUDIT_JUL5.md`, commit it to the repo root alongside this file). Every task below traces to an audit ID (B1–B6, C1–C10, D2–D5, G, E, F). This prompt supersedes nothing: `V3_SPEC.md` rules and `DECISIONS.md` remain binding.
**Verified baseline you inherit:** `tsc --noEmit` clean · 367/367 tests pass · `next build` succeeds. **Your job is to keep it that way after every phase.**

---

## HOW TO RUN (operator instructions)

1. `git checkout claude/forge30-pwa-build-2hb416 && git checkout -b v3.2-audit-fixes`. Commit this file as `V3_2_PROMPT.md` and the audit as `FORGE30_AUDIT_JUL5.md` first.
2. Run **Phase 1 in Plan Mode** first; approve the plan before code.
3. One phase per session where practical; `/clear` between phases.
4. Gate per phase: `npm run typecheck` → `npm test` → `npm run build` → subagent diff review against this prompt. New behavior requires new tests; the suite only grows.
5. Phases are ordered by risk, not convenience. Do not start Phase 2 with Phase 1 unmerged.
6. **Operator-only items (no code):** disabling Vercel Deployment Protection (audit B4), Supabase migrations, Stripe products, Vercel Cron, env vars — checklist in audit §H. The model must not attempt these; it may update docs referencing them.

## STANDING RULES (unchanged, restated because they bind every task)

- Components never bypass `lib/storage/adapter.ts`. Pure logic lives in `lib/engine/*` with Vitest coverage.
- Adherence-neutral copy everywhere: state, never shame. This now explicitly includes empty/cold-start states.
- Coach guardrails (`lib/engine/coachGuardrails.ts`) and safety copy are never weakened; if any task appears to conflict, the guardrail wins and the conflict is logged in `DECISIONS.md`.
- `lib/flags.ts` stays fail-closed. Nothing dark leaks into the UI.
- Strict TS, no `any` escapes, no silent catch blocks.

---

# PHASE 1 — CRITICAL FIXES (audit B1, B2, B3, B5, G)

### 1.1 Rate limiting + unmetered guard (B1) — the one task in this file that is security-critical
- New pure engine `lib/engine/rateLimit.ts` (+ tests): fixed-window counter logic — `allow(key, limitPerDay, now)` semantics, window keyed on the caller's local date where available, UTC otherwise.
- Server store `lib/server/rateLimit.ts`: when Supabase is configured, persist counters in a new `rate_limits` table (`supabase/migrations/0005_rate_limits.sql`: `key text, day date, count int, primary key (key, day)`, service-role writes only, no RLS-exposed client access). When Supabase is NOT configured, an in-memory Map (single-instance best effort) — acceptable only because of 1.1c.
- Apply to `/api/coach`, `/api/nutrition/photo`, `/api/research`: key = `userId` when present else hashed IP (`x-forwarded-for` first hop). Limits: coach 10/day free, 40/day pro, 80/day elite; photo already quota-metered monthly — add a 20/day burst cap on top; research 10/day elite. 429 responses carry the same friendly register as the photo-quota copy ("Daily coach limit reached — the mock engine has you covered until tomorrow.") and the client must fall back exactly as it does for 503 (verify `lib/api.ts` treats 429 as fallback-eligible; make it so if not).
- **1.1c Unmetered hard guard:** in `lib/server/entitlements.ts`, unmetered mode (`no Supabase`) now additionally requires `process.env.ALLOW_UNMETERED === "true"`. Without it, a Supabase-less deployment with an Anthropic key resolves to **free tier with IP-keyed limits**, never unlimited. Update the docstring and `docs/QA.md`. Add tests for all three resolution paths.

### 1.2 Weekly report cold-start gate (B2)
- `lib/engine/weeklySummary.ts`: compute `activeDays` = elapsed days with any logged activity (any meal, workout status set, check-in, spend entry, or journal). When `activeDays < 3`: no verdict line (line 82 class), no `mostMissedHabit`; instead a building line: `Report builds as the week does — ${activeDays} day${s} in.` Verdict tiers otherwise unchanged.
- The "Most-missed habit" chip and the verdict line in the report card render only when the summary carries them (make the fields optional in the type; typecheck will find every consumer).
- Tests: day-1 empty, day-2 partial, day-4 active → verdict present; pin the exact building-line copy.

### 1.3 Status-bar scrim (B3)
- In the `(app)` layout: a fixed, full-width, `env(safe-area-inset-top)`-height scrim (backdrop blur + bottom fade, z-above content, pointer-events none) so scrolled content never collides with the iOS clock. Prefer this one-place fix over per-page sticky headers; if any page already sticks its header, ensure no double treatment. Verify against the Money/Log/Progress scroll positions from the audit screenshots. No layout shift on pages that don't scroll.

### 1.4 Service-worker versioning + update toast (B5)
- `scripts/`: build step injects a content hash (or `GIT_SHA`/timestamp) replacing the hand-bumped `VERSION` in `public/sw.js` at build time (`prebuild` npm hook writing `public/sw.js` from `sw.template.js` is the clean shape).
- SW: `self.skipWaiting()` on install message; client registers an `updatefound` listener and shows a quiet toast "New version ready — tap to refresh" that calls `postMessage({type:'SKIP_WAITING'})` then reloads. No auto-reload mid-session.

### 1.5 Security headers + CORS pin (G)
- `next.config.ts` `headers()`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`, `X-Frame-Options: DENY`, and a CSP compatible with Next inline runtime + Stripe checkout redirect (start report-only if a strict CSP breaks hydration; document the chosen policy).
- API routes: reject cross-origin browser requests — check `origin`/`sec-fetch-site` against the deployment host (allow same-origin + server-to-server absent-origin for cron/webhook). Stripe webhook and cron are exempt from origin checks (they authenticate by signature/secret).
- CI-style guard: a unit test that greps the repo to assert `SUPABASE_SERVICE_ROLE_KEY` never appears with a `NEXT_PUBLIC_` prefix and is only imported by files under `lib/server/` or `app/api/`.

### 1.6 Account deletion endpoint (G)
- `app/api/account/delete/route.ts` (authenticated, POST, confirm token in body): purges the user's `sync_blobs`, `push_subscriptions`, `subscriptions`, `rate_limits` rows, then deletes the auth user via service client. Settings → Data gets a "Delete cloud data & account" flow with a typed-confirmation dialog, clearly distinct from the existing local-only delete. Local data untouched (their device, their call).

**Phase 1 acceptance:** all gates green; suite grows by ≥12 tests; a Supabase-less build with an API key refuses unlimited anonymous coach calls (test proves it); day-1 Progress shows the building line, no verdict, no most-missed chip.

---

# PHASE 2 — UX POLISH (audit C1–C10)

### 2.1 Mind check-in controls (C1)
- Replace the three 1–10 tap-circle rows in the Mind daily check-in with a full-width slider component (`components/ui/scale-slider.tsx`): drag + tap-to-set, large thumb, current value rendered big at the row's right, tick marks at 1/5/10, `aria-valuetext` announcing the value. Data model unchanged (1–10 integers). Reuse anywhere else a 1–10 row exists (pain scale in training, relationship check-in if present).

### 2.2 Copy dedupes (C2, C3)
- Money page: empty TODAY'S ENTRIES card becomes one line ("Nothing logged yet — first entry takes 10 seconds."); the philosophy paragraph remains only as the page footer.
- Today gauge caption: "day in progress · tap for breakdown" → "tap for breakdown" (the dial already says the day is in progress).

### 2.3 Coach tab overflow affordance (C4)
- Right-edge fade mask on the coach mode tab strip; active tab `scrollIntoView({inline:'nearest'})` on selection and on mount.

### 2.4 Progress hierarchy (C5)
- Reorder the Progress page: weekly report card first, Trends second, calendar third. Calendar collapses by default to a heat-strip (5 rows × 6 compact squares or 30 in wrapped rows ≤ 96px tall total, day-state colored, no numerals) with the current day ringed; tapping expands to the existing full grid + legend. Preserve deep-link/tap-a-day behavior in expanded mode. The legend renders only when expanded.

### 2.5 Assessment rename (C7)
- "Trauma-Response & Coping Profile" → **"Stress Response Patterns"** everywhere (bank definition in `lib/engine/assessments/`, list card copy, report labels, stored-result display name via a display-key map so previously saved results render the new name). Content and safety framing unchanged. Log the rename rationale in `DECISIONS.md` (clinical-instrument claim reduction).

### 2.6 Accessibility pass (C10)
- Contrast-check the mono microlabels and dim body text against the brown surfaces; lift any token failing 4.5:1 (adjust the token, not per-page overrides).
- `aria-label` every icon-only control (quick actions, sheet close, FAB); gauge gets `role="img"` with a label; `prefers-reduced-motion` disables the count-up and gauge sweep animations (`useCountUp` respects the media query).

### 2.7 Chart lazy-load (C8)
- All recharts imports on Progress/Protocols/Health move behind `next/dynamic({ssr:false})` with skeleton placeholders matching final chart dimensions (no layout shift). Target: `/progress` first-load JS under 220kB (from 325kB).

### 2.8 Onboarding expectation line (C9)
- Onboarding final step and the Day-1 Today gauge sublabel carry one line: "Your score builds as you log — 0 isn't a grade." Remove it from the gauge automatically after the first day with any log.

**Phase 2 acceptance:** gates green; screenshots of Mind, Money, Today, Progress at iPhone width attached to the PR description; `/progress` bundle target met; VoiceOver labels present on every icon-only control (spot-check list in `docs/QA.md` updated).

---

# PHASE 3 — CORE FEATURES (audit D2, D3, B6)

### 3.1 Programs gallery (D3)
- `lib/data/programs.ts`: 3 named 30-day programs assembled from existing plan/workout-builder primitives — **First 30** (beginner defaults, MVD-forward), **Comeback 30** (pain-aware: builder biased by `painFlags`, lower load progression), **Busy 30** (≤20 min/day sessions, quick-add-heavy nutrition). Each: name, one-line promise, per-domain defaults, seeded week structure.
- Onboarding gains a program picker (skippable, "Custom" = current behavior); Settings allows switching (switch affects future days only; never rewrites history). Program choice is a profile field through the adapter.
- Pure selection/assembly logic tested.

### 3.2 Full-account export (D2)
- Settings → Data: "Export everything (JSON)" — one file, every adapter collection, versioned envelope `{schema, exportedAt, data}`; and "Export CSVs (zip optional later — ship per-collection CSV downloads now)" for logs, meals, workouts, spending, metrics. Runs entirely client-side from the adapter. Elite gate per audit §F: JSON full export is Elite; the existing spending CSV stays free.

### 3.3 Voice-journal storage discipline (B6)
- Recording cap 3:00 with a visible countdown from 0:30 remaining; store compressed (prefer `audio/webm;codecs=opus`, fall back to what MediaRecorder yields on iOS).
- Audio excluded from cloud sync by default; Settings → Data toggle "Sync voice recordings" with a size note. `largeStore` gains `estimateUsage()` surfaced in Settings ("Journal audio: 84 MB on this device").
- Full-account export includes audio only when the user checks "include audio."

**Phase 3 acceptance:** gates green; program switch mid-cycle proven non-destructive by test; export round-trips (export → wipe dev profile → manual import path documented, import UI optional this phase); a 3:00 recording lands under ~3 MB on the test device.

---

# PHASE 4 — AI FLAG FLIPS (audit E; each item = live path + flag, shipped dark until env is present)

Order is deliberate; one per session. For each: the live route/parser, review-before-save UX where the AI writes data, deterministic fallback, entitlement + rate-limit wiring from Phase 1, and red-team/parse-failure tests. **The flag itself flips only when the operator sets the env — never hardcode a flip.** Convert flags needing runtime control from build-time constants to env-derived (`flagEnabled` reads `process.env.NEXT_PUBLIC_FLAG_*` with the current defaults), documented in `lib/flags.ts`.

1. **`photoMeal`** — route exists; verify end-to-end against the quota + new burst cap, finish any UI stubs (camera/picker in AddMeal, editable line items, low-confidence deflection to search).
2. **`transcription`** — `/api/journal/transcribe`: audio → text via the Messages API (audio input), returns transcript for user review before save; transcript joins theme extraction only under the existing journal-consent gates. Pro.
3. **`bloodworkUpload`** — `/api/health/labs`: photo/PDF → structured markers (reuse the photo pipeline shape), review-and-edit every value before save, lab's own reference ranges preserved. Pro. The Health page "soon" chips go live behind the flag.
4. **`lifeGraphAI`** — narration layer over deterministic `lifeGraph.ts` findings only (never invents patterns); Pro. Deterministic pattern count stays visible free with an upgrade line.

**Phase 4 acceptance:** every AI write path has a human review step before persistence; parse-failure fixtures per route; guardrail suite still green; flags off → zero UI change from Phase 3.

---

# PHASE 5 — MONETIZATION SURFACE (audit F)

- Paywall sheet component: tier cards (Free/Pro $9.99·$79.99/yr, Elite $19.99·$149.99/yr), feature table matching audit §F exactly, and the trust line verbatim: **"Downgrading never deletes your data — features stop generating, nothing is lost."** Triggered contextually (quota hit, locked feature tap), never as an interstitial.
- 7-day Pro trial: granted server-side on first *live* coach review render (webhook/entitlement path per existing `subscription.ts` primitives); one trial per user, enforced in the subscriptions table.
- Settings → Subscription: current tier, renewal date, manage link (Stripe customer portal route `app/api/stripe/portal`), restore/refresh entitlement button.
- Never paywalled (assert with a test where feasible): logging, streaks, sync, push, doctor report, Hard Day flow, crisis/safety resources, mock coach.

**Phase 5 acceptance:** checkout → webhook → tier flip round-trip in Stripe test mode; trial grants once; downgrade leaves all data readable; paywall renders correct state for all three tiers via the dev tier switcher.

---

# PHASE 6 — POINTERS ONLY (do not build in this run)
Native build + HealthKit + widgets + Watch per `docs/NATIVE_BUILD.md` and V3_SPEC Phase 3; partner-mode share codes; share-card export of the weekly report; `psycheReportLive` / `researchLive` as Elite anchors. Each gets its own prompt when scheduled.

---

## GLOBAL ACCEPTANCE (every phase)
Typecheck clean · full suite green and larger than 367 · `next build` succeeds · no guardrail, safety copy, or consent gate weakened · adherence-neutral register in every new string (including 429s and paywalls) · `DECISIONS.md` updated when anything here was adapted rather than followed.
