# AUDIT_V3.md — Phase 0 reconciliation (V3_SPEC Part B)

Audited 2026-07-05 on branch `claude/forge30-pwa-build-2hb416` (the v3 baseline per
DECISIONS.md §5). The spec's "verified facts" describe `origin/main` — the v1 codebase — and
every one of them checks out **against main**; none of them describe this branch. The drift is
the 29 unmerged commits of v2 expansion work.

## Spec's verified facts vs. this baseline

| Spec claim (about main) | main | this branch |
|---|---|---|
| `supabaseAdapter.ts` = 25-line throwing scaffold | ✓ | ✓ unchanged (Phase 1 replaces the role with `syncedAdapter.ts`) |
| `adapter.ts` ≈ 83 lines, 11 collections | ✓ | ~200+ lines, ~30 localStorage collections + 4 IndexedDB collections |
| BottomNav = six tabs | ✓ | **5-item nav + Log sheet** (v2 §Navigation; spec's own condition — "re-evaluated only if Health/Relationships get built" — is met: both are built) |
| Coach route = `claude-opus-4-8`, 8-part schema | ✓ | same model; schema extended in E15 (2 fields, modes). Phase 5 makes it adaptive + `COACH_MODEL` env |
| `public/sw.js` ≈ 99-line hand-rolled SW | ✓ | still hand-rolled; VERSION `forge30-v16`, more routes/handlers (E9 push-display plumbing) |
| No auth, no push, no Capacitor, no food DB | ✓ | still true — exactly the v3 Phases 1–4 gap |

## v2-spec items the spec lists as absent — actual status on this baseline

| Item | Status | Where |
|---|---|---|
| Health tab | **BUILT** | `app/(app)/health/` (BP + crisis flow, bloodwork parser, health score) |
| Relationships tab | **BUILT** | `app/(app)/relationships/` (check-in, decks, thread analysis) |
| LifeGraph | **BUILT** | `lib/engine/lifeGraph.ts` + Patterns surfaces (E14) |
| Streak system | **BUILT** | `lib/engine/streaks.ts` (freezes, earn-back, MVD) — Phase 2 parity-checks v3's exact freeze/repair wording |
| Subscription architecture | **PARTIAL** | entitlements/tiers built (E1); no Stripe/server enforcement (Phase 6, WAIT) |

Also present beyond the v2 list: onboarding, journal + consent architecture, notifications
(client-side engine + SW display path; no server push), assessments platform (wave 1 + EQ +
trauma-coping + Coaching Style), social tab, money upgrades, expenditure/TDEE engine
(foundation for Phase 4's adaptive targets), IndexedDB large store (spec Phase 1.4 — done),
Solaris HUD design system, PWA export/import with schema migrations (v3 currently = 3).

## §A3 removals — executed this phase

See DECISIONS.md §1–2. Recording framework and Cluster B/cognitive testing are deleted with a
migration path (schema v2→v3 + `DROPPED_LARGE_COLLECTIONS`/`REMOVED_ASSESSMENT_IDS` pruning);
Coaching Style & Values shipped as the replacement. Suite baseline: **301 tests**.

## What v3 actually has to build (mapped in V3_PLAN.md)

1. **Phase 1** — Supabase auth + SyncedAdapter (outbox, LWW, pull-merge, migration-on-sign-in).
2. **Phase 2** — server web push (VAPID, cron, subscriptions table), the three notification
   rules + caps/quiet hours, haiku one-liners; streak parity check only.
3. **Phase 3** — Capacitor dual-build + HealthProvider layer (Null + HealthKit) + merge policy.
4. **Phase 4** — photo meal analysis, Open Food Facts search + recents cache, barcode
   (native), seeded-plan demotion, adaptive-target suggestions on the E4 engine.
5. **Phase 5** — LifeGraph no-repeat rule; Coach 2.0 memory, adaptive schema, follow-through
   loop, weekly arc report; `COACH_MODEL` default `claude-sonnet-5`.
6. **Phase 6** — WAIT(operator): Stripe after 1–5; constraint notes in docs/MONETIZATION.md.
