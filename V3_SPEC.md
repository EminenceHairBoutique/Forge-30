# FORGE30 v3 — STATE-OF-THE-ART UPGRADE MASTER PROMPT

**Executor:** Claude Code running Claude Fable 5 (`claude-fable-5`)
**Mode:** Brownfield upgrade of the existing Forge-30 repo (`github.com/EminenceHairBoutique/Forge-30`, branch `main`) — NOT a greenfield rebuild
**Predecessor docs:** `v2_spec.md` lives in the repo root. This document supersedes it where they conflict. Where v3 is silent, v2 still applies (design system, adherence-neutral principles, safety requirements, Health/Relationships tab specs).
**Deliverable:** The same installable PWA, upgraded with cloud sync, push notifications, a native Capacitor/HealthKit path, photo-based nutrition, and a pattern-aware AI coach with memory.

---

## HOW TO RUN THIS PROMPT (operator instructions — not for the model)

1. `git checkout -b v3-upgrade` from a clean `main`.
2. Save this file to the repo root as `V3_SPEC.md` and commit it before starting, so every session can reference `@V3_SPEC.md`.
3. Run **Phase 0 alone in Plan Mode** first. Review `AUDIT_V3.md` and `V3_PLAN.md` before approving any code.
4. Run each phase as its own session where practical. `/clear` between phases — context bloat degrades output quality.
5. A phase is not merged until its gate passes: `npm run typecheck` → `npm test` → `npm run build` → a subagent diff review of the phase's changes against this spec.
6. Phases 1–5 are strictly ordered. Phase 6 is optional and must never block 1–5.

---

# PART A — OPERATING RULES

## A1. Role and mission

You are a senior product engineer upgrading **Forge30**: an all-in-one 30-day lifestyle platform (body, nutrition, training, mind, money, skills — with health and relationships specced in v2). The v3 mission is singular: **build the moat**. Forge30's defensible position is not any single vertical — it is the cross-domain correlation layer plus an AI coach that remembers the user's whole 30 days. Every phase in this document serves that moat: sync makes the data durable, notifications make the loop daily, HealthKit makes half the logging passive, photo nutrition removes the biggest friction point, and LifeGraph + Coach 2.0 turn the accumulated data into insight no single-category app can produce.

## A2. Hard rules (inherited and confirmed)

1. **The `StorageAdapter` interface is never bypassed.** Components never touch `localStorage`, Supabase, or Capacitor plugins directly. All persistence flows through `lib/storage/adapter.ts`. New data types get new adapter methods, implemented in every adapter.
2. **Pure logic lives in `/lib/engine`** with Vitest tests. UI components stay thin.
3. **Adherence-neutral design** (v2 §Core UX): missed days are stated plainly, never shamed. No red guilt screens, no broken-streak dramatics. This now extends to notification copy — see Phase 2.
4. **Safety guardrails** (v2 §Safety) are unchanged: no medical diagnosis or treatment advice, no therapy claims, no legal advice, no financial/investment advice. Pain guidance caps at "reduce load, avoid aggravating movements, stop on sharp pain." All AI surfaces carry these guardrails in their system prompts.
5. **Every failure falls back gracefully.** The coach falls back to the mock engine. Sync falls back to local. HealthKit falls back to manual entry. Photo logging falls back to search/manual. Nothing hard-breaks when a key, network, or permission is missing.
6. **API keys never reach the client.** All Anthropic calls go through `/app/api/*` routes.
7. Strict TypeScript stays strict. No `any` escapes, no `@ts-ignore` without a comment explaining why.

## A3. Scope removals — DECISIONS ALREADY MADE, do not re-litigate

Record these in a new `DECISIONS.md` at repo root during Phase 0:

- **CUT: consensual-recording framework.** Remove the `consensualRecording` flag, any related code paths, and `RECORDING_LEGAL_REVIEW.md` references from the roadmap. Rationale: legal exposure disproportionate to user value.
- **CUT: Cluster B trait screening and IQ testing.** Do not build clinical-adjacent screeners or intelligence tests. Rationale: liability, validity problems, and no retention value. **Replacement:** a transparent, plainly-disclaimed *Coaching Style & Values* onboarding assessment (10–15 questions, non-clinical, results framed as preferences that tune coach tone and priorities — never as diagnoses or scores of the person).
- **DEMOTE: the seeded 7-day meal plan.** After Phase 4 ships real food logging, the seeded plan becomes an optional template selectable in Settings, not the centerpiece of the Nutrition tab.
- **CHANGE: the rigid 8-part daily review.** Coach output becomes adaptive (Phase 5). The 8-part structure remains the *maximum* schema, but the coach returns only the sections that earned their place that day.

## A4. Model usage (server-side, via `@anthropic-ai/sdk`)

- **Daily coach review & weekly report:** `claude-sonnet-4-6` (upgrade from the current `claude-opus-4-8` in `app/api/coach/route.ts` is a cost decision; keep opus only if the operator sets `COACH_MODEL=claude-opus-4-8`). Read model from `process.env.COACH_MODEL` with `claude-sonnet-4-6` default.
- **Photo meal analysis (vision):** `claude-sonnet-4-6`.
- **Micro-copy (notification personalization, one-line nudges):** `claude-haiku-4-5-20251001`.
- Keep structured outputs with JSON schemas on every route, exactly as the existing coach route does. Any parse failure → deterministic fallback.

---

# PART B — PHASE 0: AUDIT & RECONCILIATION (Plan Mode, no production code)

1. Confirm the current state of `main` against these verified facts (flag any drift):
   - `lib/storage/supabaseAdapter.ts` is a 25-line throwing scaffold implementing `Partial<StorageAdapter>`.
   - `lib/storage/adapter.ts` defines the full interface (profile, daily logs, meals, saved meals, workouts, journals, spending, sunday reviews, skill tasks, body metrics, ai reviews) at ~83 lines.
   - `components/shell/BottomNav.tsx` renders six tabs: Today, Food, Train, Mind, Money, Progress. (v2 called for a 5-item nav with a Log sheet — reconcile: v3 keeps six tabs for now; the nav decision is re-evaluated only if Health/Relationships tabs from v2 get built.)
   - `app/api/coach/route.ts` uses `claude-opus-4-8` with an 8-part JSON schema.
   - `public/sw.js` is a ~99-line hand-rolled service worker.
   - No auth, no push, no Capacitor config, no food database exists on `main`.
2. Diff `main` against `v2_spec.md` and list which v2 items are built, partially built, or absent. The known-absent set: Health tab, Relationships tab, LifeGraph, streak system, subscription architecture.
3. Produce: `AUDIT_V3.md` (findings), `DECISIONS.md` (§A3 removals), `V3_PLAN.md` (file-level plan for Phases 1–5 with estimated touch lists), and update `CLAUDE.md` with the v3 rules from Part A.
4. Delete or quarantine any code behind the `consensualRecording` flag if present.

**Gate:** operator approves `V3_PLAN.md` before Phase 1.

---

# PART C — BUILD PHASES

## PHASE 1 — SUPABASE AUTH + CLOUD SYNC (offline-first)

**Why first:** every later phase (push tokens, subscriptions, coach memory) needs a durable user identity, and today a cleared Safari cache erases a user's entire 30 days.

### 1.1 Auth
- `npm install @supabase/supabase-js`. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only, used **only** in API routes, never imported by client code).
- Email magic-link + Apple Sign In + Google OAuth via Supabase Auth. (Apple/Google config steps documented in `docs/AUTH_SETUP.md` — reuse the patterns from the operator's Style Eternal OAuth work.)
- **Auth is optional at first run.** The app must remain fully usable signed-out on local storage. Onboarding offers "Continue without account" and a persistent, quiet "Back up your data" prompt on the Settings and Progress pages. Signing in later triggers the migration in 1.3.

### 1.2 Schema + RLS
- One migration file `supabase/migrations/0001_core.sql`. Tables mirror the adapter collections exactly (the scaffold comment in `supabaseAdapter.ts` already lists them): `profiles`, `daily_logs`, `meals`, `saved_meals`, `workouts`, `journals`, `spending`, `sunday_reviews`, `skill_tasks`, `body_metrics`, `ai_reviews`.
- Every table: `user_id uuid references auth.users`, natural key (`date` for per-day rows, `id` for append collections), `updated_at timestamptz`, RLS policy `user_id = auth.uid()` for select/insert/update/delete. No public access anywhere.

### 1.3 SyncedAdapter (the real work)
- Implement `SyncedAdapter implements StorageAdapter` in `lib/storage/syncedAdapter.ts`:
  - **Reads:** local-first, always. The UI never waits on the network.
  - **Writes:** write local, enqueue to an outbox (persisted queue in local storage), flush the outbox to Supabase in the background with retry/backoff. Flush on regained connectivity (`online` event) and app foreground.
  - **Pull:** on sign-in and app open, pull rows with `updated_at > lastPulledAt` per collection and merge.
  - **Conflicts:** last-write-wins per row using `updated_at`. Add `updatedAt` to every record type in `lib/types.ts` (stamped in the adapter, not in components).
  - **Migration:** on first sign-in, push all existing local data to Supabase, then continue in synced mode. Show a one-time "Your data is backed up" confirmation.
- `provider.tsx` selects: signed-out → `LocalStorageAdapter`; signed-in → `SyncedAdapter`. Components don't change.
- Engine tests for the outbox/merge logic (pure functions in `lib/engine/sync.ts`): dedupe, ordering, LWW merge, partial-flush recovery.

### 1.4 IndexedDB tier
- Journals, AI reviews, and (Phase 4) photo thumbnails move to IndexedDB via the adapter, honoring the ~5MB localStorage ceiling flagged in v2. Wrap with a tiny promise-based helper; no heavyweight dependency.

**Acceptance:** sign out/in on a second device reproduces the full 30 days; airplane-mode logging syncs on reconnect; all existing tests pass; new sync engine tests pass; signed-out experience is byte-for-byte unchanged.

---

## PHASE 2 — PUSH NOTIFICATIONS + STREAKS (the retention loop)

### 2.1 Web push
- VAPID web push: `web-push` on the server, subscription flow in the client. iOS requires the installed PWA (16.4+) — detect standalone mode and gate the prompt: never ask for notification permission in a browser tab on iOS; instead show the Add-to-Home-Screen instruction card first.
- Store push subscriptions in a `push_subscriptions` table (per user, per device, RLS as above).
- Scheduler: a Vercel Cron route (`app/api/cron/notify/route.ts`, protected by `CRON_SECRET`) that runs the notification engine.

### 2.2 Notification engine (`lib/engine/notifications.ts`, pure + tested)
Rules, all user-configurable in Settings, all off-able, all respecting quiet hours (default 21:30–08:00):
- **Morning brief** (default 08:00 local): today's #1 priority from yesterday's coach review.
- **Evening close** (default 20:30): only if the day is incomplete — "20 minutes to close out today" listing the 1–2 quickest missing items.
- **Streak-at-risk** (19:00): only when a ≥5-day streak would break and the day's Minimum Viable Day isn't met.
- **Silence discipline:** hard cap 2 notifications/day, zero on fully-logged days. Copy is adherence-neutral — state, never shame ("Protein is 40g short. One shake covers it." — never "Don't ruin your streak!").
- Personalized one-liners generated server-side with `claude-haiku-4-5-20251001`, deterministic template fallback.

### 2.3 Streak system (build the v2 spec)
- Implement the v2 streak spec: domain streaks + overall streak, **streak freeze** (1 earned per 7 perfect days, auto-applied, max 2 banked), and **repair** (a missed day can be neutralized by hitting Minimum Viable Day before noon the next day). Streaks reward *showing up*, not perfection — MVD counts.
- Progress tab gets the streak surface; Today gets a quiet chip, not a siren.

**Acceptance:** notifications deliver to an installed iOS PWA and Android/desktop Chrome; cron route is idempotent (double-fire sends nothing twice); notification engine has full unit coverage; every notification type can be disabled.

---

## PHASE 3 — CAPACITOR + HEALTHKIT (passive data)

### 3.1 Capacitor wrap
- Add `@capacitor/core`, `@capacitor/ios` (and `@capacitor/android` scaffolding). Next.js already prerenders statically; configure `output: 'export'` compatibility for the Capacitor build **without breaking** the Vercel PWA deployment — two build targets, one codebase. Document the dual-build in `docs/NATIVE_BUILD.md`.
- The PWA remains the primary distribution (no App Store cut, per the existing strategy). The Capacitor build exists **because HealthKit requires it** and as the future App Store path.

### 3.2 Health data layer
- `lib/health/provider.ts` defines a `HealthProvider` interface: `getSteps(date)`, `getSleep(date)`, `getWorkouts(date)`, `getWeight(range)`, `requestPermissions()`, `isAvailable()`.
- Implementations: `HealthKitProvider` (Capacitor HealthKit plugin — pin the chosen plugin in `V3_PLAN.md` after checking current maintenance status), and `NullHealthProvider` (web — `isAvailable() = false`).
- **Merge policy:** passive data pre-fills, the user confirms. HealthKit steps/sleep auto-populate the daily log as "detected" values shown with a distinct chip; one tap accepts, and manual entry always overrides. Never silently overwrite a manual entry.
- Weight from HealthKit feeds the existing 7-day trend logic in `lib/engine/trends.ts`.

**Acceptance:** on iOS (Capacitor build) steps/sleep/weight appear without typing; on web nothing regresses and no HealthKit code ships to the client bundle; permission denial degrades to manual entry with no error states.

---

## PHASE 4 — NUTRITION LEAPFROG (photo + database)

### 4.1 Photo meal logging (the flagship feature)
- New route `app/api/nutrition/photo/route.ts`: accepts a downscaled image (client resizes to ≤1024px, JPEG ~0.8 before upload), calls `claude-sonnet-4-6` vision with a structured-output schema: `{ items: [{ name, portionEstimate, calories, protein, carbs, fat, confidence }], overallConfidence, assumptions: string[] }`.
- UI: camera/photo-picker button in `AddMealSheet.tsx` → analyzing state → editable line-item review (user can adjust portions before saving; each item shows the model's assumption, e.g. "assumed cooked in oil"). **Estimates are always labeled estimates.** Low `overallConfidence` → the sheet says so plainly and suggests search instead.
- Thumbnails stored in IndexedDB (Phase 1.4), full images never persisted.

### 4.2 Food database + search
- Integrate **Open Food Facts** (free, no key) as the search backend via a server route (`app/api/nutrition/search`), normalizing to the `MealEntry` macro shape, with a local cache of the user's previous picks so repeat foods are instant and offline.
- Custom foods and the existing quick-adds/saved meals remain first-class.
- **Barcode scan:** in the Capacitor build only, via a maintained barcode plugin → Open Food Facts lookup. Web falls back to search.

### 4.3 Demotion of the seeded plan
- Per `DECISIONS.md`: the seeded 7-day plan moves behind Settings → "Meal plan templates." The Nutrition tab leads with: photo log, search, recents, quick-adds. The grocery-list generator stays, now driven by whichever template (if any) is active.

### 4.4 Adaptive targets
- Add an adaptive calorie-target engine (`lib/engine/adaptiveTargets.ts`, pure + tested): weekly, compare the 7-day average intake against the 7-day weight trend and nudge `calorieTarget` toward the user's stated goal (surplus/deficit/maintain) in ≤150 kcal steps, always shown as a *suggestion* the user accepts in the Sunday review — never silently changed. This replaces the blunt "+250 kcal banner" logic with the same MacroFactor-style principle at MVP depth.

**Acceptance:** photo → confirmed meal in under 15 seconds on a real iPhone; search returns results offline for previously-used foods; failed vision call falls back to search with no dead end; adaptive-target suggestions appear only in the Sunday review and are covered by unit tests.

---

## PHASE 5 — LIFEGRAPH + COACH 2.0 (the moat)

### 5.1 LifeGraph pattern engine (`lib/engine/lifegraph.ts`, pure + tested)
- Co-occurrence analysis over the trailing 30 days across domain signals: sleep hours, stress, pain, unnecessary spend, protein adherence, workout completion, skill minutes, mood.
- Method: for each signal pair, bucket days (e.g. sleep <6h vs ≥7h) and compare outcome rates; report only when `n ≥ 8` days per bucket **and** the difference exceeds a meaningful threshold. Output shape: `{ a, b, direction, strength: 'possible'|'notable', sampleDays, plainEnglish }`.
- **Honesty rules:** language is always "pattern," never causation ("On days after <6h sleep, your unnecessary spending was 2.1× higher — 12 days of data. Possible pattern."). Below sample thresholds, LifeGraph says it's still learning. No pattern surfaces twice in one week.
- Surface: a "Patterns" card on Progress, and as an input to the coach context.

### 5.2 Coach 2.0
- **Memory:** `lib/engine/coachContext.ts` expands to include: trailing-30-day compressed summary (computed locally, ~1KB), the last 7 stored reviews' `tomorrowPriority` and whether each was hit, active streaks/freezes, current LifeGraph patterns, and the Coaching Style assessment (§A3 replacement) preferences.
- **Adaptive output:** schema becomes `{ sections: [{ key, text }], tomorrowPriority }` where `key` is one of the existing eight plus `patternInsight` and `weeklyArc`. The coach returns 3–6 sections that earned their place; `tomorrowPriority` is always required. Stored reviews remain backward-compatible (old 8-part reviews render fine).
- **Follow-through loop:** every review opens by closing yesterday's loop — did yesterday's #1 priority happen? (Determinable from the log; the coach states it, adherence-neutral.)
- **Weekly deep report:** Sunday's review becomes a longer weekly arc (still one API call): the week's trajectory per domain, the strongest pattern, one thing to drop, one thing to double down on. Rendered as a distinct card the user can screenshot — make it beautiful; it's organic marketing.
- Guardrails from A2.4 remain verbatim in every system prompt.

**Acceptance:** LifeGraph unit tests cover threshold gating, direction, and the no-repeat rule; coach responses parse against the new schema with mock fallback intact; a 30-day seeded fixture produces a sensible weekly report; no coach output ever references data not in its context.

---

## PHASE 6 (OPTIONAL, NEVER BLOCKING) — SUBSCRIPTION TIERS
- Only after 1–5 are merged. Per v2: Supabase auth precedes Stripe; PWA-distributed Stripe Checkout preserves the no-App-Store-cut advantage (note: the Capacitor/App Store build, if ever submitted, must use Apple's IAP for digital goods — document this constraint in `docs/MONETIZATION.md`, do not solve it now).
- Free: full logging + mock coach + streaks. Pro: live AI coach, photo nutrition, LifeGraph, weekly report. Entitlement check server-side on the AI routes.

---

# PART D — QUALITY BAR & ACCEPTANCE (GLOBAL)

1. Every phase: `typecheck` clean, all tests green (grow the suite — sync, notifications, adaptive targets, lifegraph are all pure-engine testable), production build succeeds, subagent diff review against this spec.
2. Real-iPhone QA checklist per phase in `docs/QA.md`: installed-PWA standalone, safe areas, offline behavior, and (Phase 2+) notification delivery.
3. Performance: Today dashboard interactive < 1.5s on a mid-tier phone; photo analysis perceived wait masked with a skeleton + line-item streaming reveal.
4. The design bar stands: a stranger seeing a Forge30 screenshot next to any competitor identifies Forge30 in under one second. New surfaces (Patterns card, weekly report, photo review sheet) must clear this bar using the existing Solaris-base design tokens.
5. Nothing in this spec weakens a safety guardrail. If any instruction here appears to conflict with A2.4, the guardrail wins and the conflict is logged in `DECISIONS.md`.

---

## ENVIRONMENT VARIABLES (final set)

```
ANTHROPIC_API_KEY=            # server-only (existing)
COACH_MODEL=claude-sonnet-4-6 # optional override
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # server-only
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=            # server-only
CRON_SECRET=                  # server-only
```

## PHASE ORDER RECAP

`0 Audit → 1 Sync → 2 Notifications+Streaks → 3 Capacitor+HealthKit → 4 Nutrition → 5 LifeGraph+Coach → (6 Subscriptions)`

Each phase ships independently. Stop after any phase and the app is strictly better than before it.
