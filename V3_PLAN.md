# V3_PLAN.md — file-level plan for v3 Phases 1–5

Baseline: branch `claude/forge30-pwa-build-2hb416` after Phase 0 (see AUDIT_V3.md,
DECISIONS.md). Every phase gates on: `npm run typecheck` → `npm test` (count only grows from
301) → `npm run build` → diff review against V3_SPEC → Playwright runtime pass → commit +
push. SW `VERSION` bumps whenever shell content changes. Acceptance items needing live
backends or devices are tracked in `docs/QA.md` as WAIT(operator/device).

## Phase 1 — Supabase auth + cloud sync

| Touch | What |
|---|---|
| `package.json` | + `@supabase/supabase-js` |
| `lib/supabase/client.ts` (new) | browser client; `null` when env unset → signed-out mode |
| `supabase/migrations/0001_core.sql` (new) | one generic shape per collection: `user_id uuid`, natural key (`date`/`id`), `data jsonb`, `updated_at timestamptz`; RLS `user_id = auth.uid()` on all verbs; tables for every adapter collection (localStorage KEYS + large-store) |
| `lib/engine/sync.ts` + test (new) | pure outbox: dedupe (collection+key last-wins), ordering, LWW merge on `updatedAt`, partial-flush recovery, `lastPulledAt` |
| `lib/storage/syncedAdapter.ts` (new) | implements StorageAdapter; wraps LocalStorageAdapter; local-first reads; outbox writes; flush on `online`/foreground; pull-merge on sign-in/open; first-sign-in full push |
| `lib/types.ts` | `updatedAt?: string` on persisted records (additive) |
| `lib/storage/provider.tsx` | adapter selection by auth state |
| `components/settings/` + Progress | quiet "Back up your data" card; sign-in sheet (magic link); "Continue without account" stays default |
| `docs/AUTH_SETUP.md` (new) | Apple/Google OAuth config steps |

## Phase 2 — Push + notification engine

| Touch | What |
|---|---|
| `package.json` | + `web-push` |
| `app/api/push/subscribe/route.ts` (new) | store/remove subscription (service-role, server-only) |
| `app/api/cron/notify/route.ts` (new) | CRON_SECRET-guarded; idempotent via notification_log |
| `supabase/migrations/0002_push.sql` (new) | `push_subscriptions`, `notification_log` (RLS) |
| `lib/engine/notificationRules.ts` + test | + morning brief / evening close / streak-at-risk; 2/day cap; zero on fully-logged days; quiet hours 21:30–08:00 |
| haiku micro-copy | in cron route, `claude-haiku-4-5-20251001`, template fallback |
| `lib/engine/streaks.ts` + test | parity: freeze 1 per 7 perfect days max 2 banked; repair by noon next day |
| Settings | per-type toggles extend E9's surface |

## Phase 3 — Capacitor + HealthKit

| Touch | What |
|---|---|
| `package.json` | + `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` |
| `capacitor.config.ts` (new), `next.config.ts` | `BUILD_TARGET=capacitor` → `output: "export"`; PWA build unchanged |
| `lib/health/provider.ts` (new) | `HealthProvider` interface + `NullHealthProvider`; `HealthKitProvider` dynamic-imported under Capacitor only (plugin pinned at build time; candidate `@perfood/capacitor-healthkit` — verify maintenance then) |
| `lib/engine/healthMerge.ts` + test (new) | detected-vs-manual merge: pre-fill, confirm, manual always wins |
| Today daily-log inputs | "detected" chip UI |
| `docs/NATIVE_BUILD.md` (new) | dual-build instructions |

## Phase 4 — Nutrition leapfrog

| Touch | What |
|---|---|
| `app/api/nutrition/photo/route.ts` (new) | `claude-sonnet-5` vision, structured output, graceful fallback |
| `components/forms/AddMealSheet.tsx` | camera/picker → analyzing skeleton → editable line items (assumptions + ESTIMATE label + low-confidence path) |
| `lib/storage` | `mealPhotos` large-store collection (thumbnails only) |
| `app/api/nutrition/search/route.ts` (new) | Open Food Facts, normalized to MealEntry macros |
| KEYS `foodCache` | recents cache — instant/offline repeats |
| Nutrition tab + Settings | seeded plan → "Meal plan templates"; tab leads with photo/search/recents/quick-adds |
| `lib/engine/adaptiveTargets.ts` + test (new) | 7-day intake vs 7-day weight trend (reuses E4 expenditure) → ≤150 kcal suggestion, Sunday-review-only, accept/decline |
| Barcode | Capacitor-only plugin → OFF lookup; web falls back to search |

## Phase 5 — LifeGraph polish + Coach 2.0

| Touch | What |
|---|---|
| `lib/engine/lifeGraph.ts` + test | no-repeat-within-7-days surfacing rule (last-surfaced dates) |
| `lib/engine/coachContext.ts` + test | 30-day compressed summary (~1KB), last-7 `tomorrowPriority` + hit/miss, streaks/freezes, patterns, Coaching Style preferences |
| `app/api/coach/route.ts` (extend) | model `process.env.COACH_MODEL ?? "claude-sonnet-5"`; adaptive `{sections[{key,text}], tomorrowPriority}` (8 keys + patternInsight + weeklyArc, 3–6 returned); `thinking: adaptive` + `output_config.format` unchanged; guardrails verbatim |
| `lib/engine/mockCoach.ts` (extend) | same adaptive shape, deterministic, zero-key path intact |
| Review renderer | accepts old 8-part and new adaptive shapes |
| Sunday weekly report | distinct screenshot-worthy card (Solaris tokens, glow budget respected) |

## Phase 6 — Protocols (Rev 3.1: opt-in prescribed-therapy tracking)

| Touch | What |
|---|---|
| `lib/types.ts` | Compound, ProtocolSchedule, DoseEvent, LabPanel, ProtocolSettings, DailyLog.protocolSymptoms (all additive) |
| `lib/data/protocolReference.ts` (new) | 11 injection sites, 30+ lab-marker catalog w/ editable ranges, published half-life table (source-noted, estimates-only banner) |
| `lib/engine/protocols.ts` + test (new) | schedule expansion, site rotation (LRU rest scoring), vial inventory (entered-dose unit display only), adherence %, estimated-level decay curve, lab status chips |
| `lib/engine/coachGuardrails.ts` + test (new) | PROTOCOL_COACH_RAIL (§6.0.3 blocklist), protocolDeflection, red-team fixtures in CI |
| storage | adapter CRUD (doses/labs in large store), PROTOCOL_COLLECTIONS sync-exclusion registry (local-only mode); no new SQL — rides the generic sync tables |
| `app/(app)/protocols/` + `components/protocols/` (new) | instrument surface: one-tap dose log, body map, inventory, labs trends + range bands, level curve, doctor report (print pattern, free), WebAuthn lock |
| Settings + nav + sw.js | opt-in enable with prescribed-and-supervised confirmation; MORE_DESTINATIONS entry only when enabled; SHELL_ROUTES + VERSION |
| LifeGraph + coach | dose-day/symptom behavioral signals w/ prescriber framing; behavioral-only coach context fields |

## Phase 7 — Subscriptions (after 6)

| Touch | What |
|---|---|
| `supabase/migrations/0004_subscriptions.sql` (new) | subscriptions + ai_usage (service-role only) |
| `app/api/stripe/webhook` + `checkout` (new) | signature-verified events → tier rows; Checkout session w/ 7-day trial; 404 unconfigured |
| `lib/server/entitlements.ts` (new) | resolveTier(request) w/ graceful fallbacks (unconfigured ⇒ current keyless behavior) |
| AI routes | coach Pro+ (Elite → COACH_MODEL_ELITE ?? claude-opus-4-8), photo quotas (Free 3/mo, Pro 150/mo via ai_usage), lab import Pro+ |
| `lib/engine/subscription.ts` + test (new) | row→tier mapping w/ period-end grace, month quota math |
| client | Free/Pro/Elite feature map (UX only), Settings subscription card (env-gated checkout), non-destructive downgrade copy, /api/entitlements |
