# AUDIT.md — Forge30 v1 → v2 (Phase 0)

Audit of `main` for the v2 overhaul, per `v2_spec.md` §0.2. The spec's §0.1 Known Findings were
**confirmed by spot-check** (not rediscovered); everything else below was verified directly
against this working tree.

## Build/test status as of this run

```
npm run typecheck   → clean (strict + noUncheckedIndexedAccess)
npm test            → 36/36 passing  (forgeScore ×15 · mockCoach ×13 · trainingRules ×8)
npm run build       → green; 11 app routes prerender statically + 1 dynamic API route
                      First Load JS 102–240 kB (heaviest: /progress at 240 kB — Recharts)
```

Runtime smoke test (Playwright against `npm start`): onboarding → Today → meal/water/spend
logging → mock coach review → Progress calendar all work; the only console error is the
expected `/api/coach` 503-without-key that triggers the mock fallback. **Not yet verified on a
physical iPhone** — that is v2 Phase 2.

## Repo map

- **Framework:** Next.js 15.5.20 (App Router), React 19.2.7, TypeScript 5.x strict.
  **Package manager:** npm (package-lock.json committed). Node 18.18+ (dev on 22).
- **Styling:** Tailwind CSS v4 (`@theme` tokens in `app/globals.css`), shadcn-style hand-rolled
  primitives in `components/ui/` (deliberate native `<select>` for iOS reliability).
- **Charts:** Recharts 2.15.4 (`components/charts/TrendChart.tsx`, CVD-validated dark palette).
- **AI:** `@anthropic-ai/sdk` 0.109.1, server-side only in `app/api/coach/route.ts`.
- **Tests:** Vitest 3.2.6, colocated `lib/engine/*.test.ts`.
- **Routes:** `(app)/` → `today` `nutrition` `training` `mind` `money` `progress` `coach`
  `skills` `settings`; root `/` redirects to `/today`; `api/coach` (POST).
- **Storage:** `lib/storage/adapter.ts` (interface) → `localStorageAdapter.ts` (binding) →
  `provider.tsx` (React context, `useStorage()`); `supabaseAdapter.ts` intentional stub.
- **Engines (pure, `lib/engine/`):** forgeScore · dailySync (single derived-state write path) ·
  nutritionRules · trainingRules · trends · weeklySummary · bodyRules · mockCoach ·
  coachContext · plan.
- **Seed data (`lib/data/`):** defaults · mealPlan · quickAdds · workoutPlan · skills · books.
- **PWA:** `public/manifest.json` + hand-rolled `public/sw.js` (`SHELL_ROUTES` precache,
  network-first navigations, cache-first static) + full icon set (192/512/maskable/apple-180).
- **Commands:** `npm run dev | build | start | typecheck | test | test:watch | lint | icons`.

## Feature inventory — exists vs. v2 needs

| Exists and verified correct (extend, don't rebuild) | v2 net-new (per spec) |
|---|---|
| Forge Score engine + tap-to-explain `ScoreRing.tsx` sheet | Health tab (BP + AHA categories/crisis flow, bloodwork entry/parser/AI review, fitness markers, Health Score) |
| Daily sync single write path (`dailySync.ts`) | Relationships tab (modes, check-in, prompt decks, conflict debrief, assessments, micro-lessons) |
| Nutrition: macro rings, water, meal slots, quick adds, saved meals, grocery list, prep checklist, "Still Need Today" | Adaptive Expenditure Engine (`expenditure.ts`, smoothed trend, weekly check-in) |
| Training: logger (sets/RPE/pain/notes), warm-up gate, rest timer, swaps, pain engine, `PainStopModal`, PRs, heat map | Workout builder + tagged exercise library; general `InjuryProfile` + red-flag escalation |
| Mind: check-in, breathing reset, pause timer, boundary scripts, wind-down | CBT thought record + pattern detection (via LifeGraph) |
| Money: <30s log, limit status, weekly breakdown, Sunday review | Recurring/debt/savings/emergency-fund/cash-flow/safe-to-spend |
| Skills: 3 tracks, XP, page-local streak, book plan | Persisted streak engine (MVD/freezes/earn-back/weekly), 5 more tracks |
| Progress: 30-day calendar, 9-metric trend chart, weekly report, body metrics + photos | Health/TDEE/BP/RHR/connection/outreach charts, print export, JSON export/import |
| Coach: deterministic mock + live route with structured outputs and mock fallback | +2 review fields (health, relationship/social), new rules, `/api/research`, LifeGraph |
| Onboarding: single-screen, skippable with defaults | Universal fields, goal menu, domain enable/disable, MVD config |

## Personalization audit (hardcoded to one user — generalize in v2)

Spec §0.1 seed list, all confirmed, plus additional finds:

1. `lib/data/defaults.ts` — `DEFAULT_CALORIE_TARGET = 3050`, `DEFAULT_PROTEIN_TARGET = 170`,
   `DEFAULT_WEIGHT_GOAL = "Gain 4–8 lb (lean-mass focus)"`: one user's bulk as universal default.
2. `defaultProfile()` pre-checks **all five** `painFlags` `true` — every new user starts
   "injured" with the thoracic/rib/scapular pattern. (`OnboardingGate.tsx` renders them checked.)
3. `lib/types.ts` `PainFlags` — five booleans wired directly into `trainingRules.ts` and
   `coachContext.ts`; not a general injury model.
4. `lib/data/mealPlan.ts` — one fixed omnivore chicken/beef/salmon rotation, no diet variants;
   `quickAdds.ts` assumes dairy/whey; `mockCoach.ts` + `nutritionRules.ts` copy names the whey
   shake specifically (fine as default suggestion, needs preference awareness).
5. `lib/data/workoutPlan.ts` — one fixed split; `PAIN_RELIEF_DRILLS` and the warm-up checklist
   are thoracic/scapular-specific; exercises carry no equipment/contraindication tags.
6. `lib/engine/trainingRules.ts` — adjustment copy hardcodes "chest-supported rows /
   neutral-grip pulldowns" and shrug warnings tied to the one injury pattern (correct as the
   *instance*; needs to become one case of a general engine).
7. `lib/data/skills.ts` / `books.ts` — three tracks and a book list picked for one user
   (fine as defaults; v2 adds tracks + configurability).
8. `app/(app)/skills/page.tsx` `streakFor()` — working page-local consecutive-day walk; the
   precedent to generalize, not a gap.
9. `lib/engine/trends.ts` `calculateWeightTrend()` — raw last-minus-first delta; called by
   `bodyRules.ts` and `nutritionRules.ts` (the "+250 kcal if flat" rule). Extension point for
   the expenditure engine; keep as fallback.
10. 30-day program framing (`PROGRAM_LENGTH_DAYS`, "Day N of 30") — product identity, keep, but
    v2 copy should tolerate users who continue past day 30.

## Architecture audit

- **StorageAdapter rule fully respected:** grep confirms zero `localStorage` calls outside
  `lib/storage/localStorageAdapter.ts` (all other matches are comments/imports). SSR-guarded,
  quota-error-tolerant, `forge30:*` keys.
- **No scoring/health/calorie math in UI components** — engines are pure and tested; pages call
  them. One minor deviation: `streakFor()` lives in a page (see #8) — planned migration.
- **No schema versioning / `migrate()`** in the adapter (confirmed: zero matches) and **no
  export/import** in Settings — both must land in Phase 1 before any type changes.
- Derived daily state flows through one path (`syncDailyLog`), so new domains should feed the
  same sync rather than writing `DailyLog` fields ad hoc.
- `app/api/coach/route.ts` — current, correct Claude API usage (`claude-opus-4-8`,
  `thinking: adaptive`, `output_config.format` json_schema, server-side key, non-200 → client
  mock fallback). Extend `SYSTEM_PROMPT`/`REVIEW_SCHEMA` in place.

## PWA audit

Manifest (standalone, `#0A0A0B`, id/start_url `/today`, real 192/512/maskable/apple icons),
hand-rolled SW with versioned caches and `SHELL_ROUTES` precache, Apple meta via `appleWebApp`,
`viewportFit: "cover"`, safe-area utilities, 16px inputs, headers for `/sw.js` and
`/manifest.json` set in `next.config.ts`. Verified served correctly against the production
build (all 200s). **Two watch-items:** (1) `SHELL_ROUTES` is a manual list — every new route
must be added in the same commit as the nav change; (2) SW `VERSION` string is bumped manually —
stale-shell risk if forgotten during v2. Device verification (real iPhone) still outstanding →
Phase 2.

## UI/UX audit — navigation crowding

Current `BottomNav.tsx`: **6 fixed tabs** (Today · Food · Train · Mind · Money · Progress),
icons + 10px labels, no overflow/"more" pattern. Coach, Skills, Settings are reachable only via
Today cards/quick actions. Adding Health and Relationships as fixed tabs (8+) does **not** fit —
at 375pt width, 8 tabs ≈ 46pt each with unreadable labels, and 10 is impossible. **Decision:
adopt the spec's recommended 5-item pattern — Today · Log · Coach · Progress · More** — where
Log opens a sheet/grid to Nutrition, Training, Mind, Money, Health, Relationships, Skills, and
More holds Settings + secondary items. Today's quick actions keep every domain ≤2 taps.
Implement in the first phase that adds a route (Phase 6), touching `BottomNav.tsx` +
`sw.js` `SHELL_ROUTES` together.

## Safety audit — disclaimers today vs. required

| Required verbatim (spec §Safety) | Current state |
|---|---|
| Health/bloodwork | **Absent** (no Health tab). Add with Phase 6. |
| Mental health | Similar-in-spirit text on `/mind` and `/settings` ("…not therapy, diagnosis, crisis support…") — **does not match verbatim**, lacks the crisis-hotline sentence. Replace in Phase 8. |
| Relationships | **Absent** (no tab). Add with Phase 8. |
| Finance | **Absent** — Money page has philosophy copy only. Add in Phase 9 (or Phase 1 opportunistically). |

`/coach` carries its own non-advice line (keep). `mockCoach.ts`/route guardrails (no diagnosis /
therapy / legal / financial advice) confirmed present in both engines.

**Adherence-neutral violations (fix Phase 1):**
1. `app/(app)/today/page.tsx` ~164: `workoutStatus === "skipped"` → `danger` tone.
2. `app/(app)/nutrition/page.tsx` ~140: "+250 kcal" suggestion banner styled `warning`.
No other violations found — remaining danger/warning uses (sharp pain, over-limit spend,
high-stress tint) are legitimate signals; re-sweep during Phase 5.

## Risk list

1. **Schema drift corrupting user data** — no versioning today; every v2 phase changes shapes.
   Mitigation: Phase 1 `migrate()` + fixture tests before anything else.
2. **Single-device data loss** — localStorage only, no export. Mitigation: Phase 1 export/import.
3. **localStorage quota** — progress photos stored as data URLs (downscaled, but they accumulate);
   bloodwork history adds more. Watch size; consider photo cap or IndexedDB later.
4. **Mock/live coach shape divergence** — the 8→10-field extension must change
   `CoachReview`, `mockCoach.ts`, `REVIEW_SCHEMA`, `SYSTEM_PROMPT`, and the client renderer
   together (Phase 10), with tolerant parsing of old saved 8-field reviews.
5. **`PainFlags` → `InjuryProfile` migration** — training engine and coach context depend on the
   flags; keep `PainFlags` as a derived view until all callers move.
6. **SW staleness** — manual `VERSION`/`SHELL_ROUTES`; add to phase checklists.
7. **Nav change touches every page's muscle memory** — do it once (Phase 6), not incrementally.
8. **`/progress` bundle weight** (240 kB First Load) grows with new charts — consider
   lazy-loading chart panels during Phase 9.
9. **UI has no automated tests** — engine coverage is good (36); UI regressions are caught only
   by build + manual/Playwright smoke. Keep the smoke script habit per phase.
10. **LifeGraph false patterns** — small samples mislead; the ≥5-qualifying-days guard and
    "possible pattern" phrasing are load-bearing requirements, not polish.
