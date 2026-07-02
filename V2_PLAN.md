# V2_PLAN.md — Forge30 v2 phase plan

Maps `v2_spec.md` §Build Phases onto this repo, adjusted for what `AUDIT.md` confirmed.
Read those two files first. v1 is green (typecheck clean · 36/36 tests · static build) and the
spec's §0.1 findings all held up — v2 **extends** v1; nothing is rebuilt.

**Every phase gates on:** `npm run typecheck` → `npm test` (count only grows) →
`npm run build` → subagent diff review against `v2_spec.md`, explicitly checking the
adherence-neutral rule → fix gaps → one descriptive commit.

**Standing rules:** new math = pure functions in `lib/engine/` + Vitest tests · new types in
`lib/types.ts` · persistence only via `StorageAdapter` · new routes update `BottomNav.tsx` +
`sw.js` `SHELL_ROUTES` (and bump SW `VERSION`) in the same commit · derived daily fields flow
through `dailySync.ts`.

**Decisions recorded (spec "operator's call" items):**
- **Navigation:** adopt the spec's 5-item bar — **Today · Log · Coach · Progress · More** (Log
  = sheet/grid to Nutrition, Training, Mind, Money, Health, Relationships, Skills; More =
  Settings + secondary). The current 6-fixed-tab bar has no overflow pattern and cannot absorb
  Health + Relationships (AUDIT.md). Lands in Phase 6 with the first new route.
- **Onboarding:** split into a short multi-step flow. The universal field set (~25 fields +
  goal menu + domain toggles + MVD) is objectively too dense for the current single screen;
  keep the skip-to-defaults escape hatch on every step.

---

## Phase 0 — Audit ✅ (this deliverable)
`AUDIT.md`, `CLAUDE.md`, `V2_PLAN.md`. Stop for operator approval before any code.

## Phase 1 — Foundation hardening
**Goals:** schema safety net + the two adherence fixes + data lifecycle. No new features.
**Files:** `lib/storage/localStorageAdapter.ts` (add `forge30:schemaVersion`, `migrate()`
chain run before first read), `lib/storage/adapter.ts` (export/import surface),
`app/(app)/settings/page.tsx` (JSON export = all `forge30:*` collections in one versioned file;
import = validate → `migrate()` → write), `app/(app)/today/page.tsx` ~164 (skipped → neutral),
`app/(app)/nutrition/page.tsx` ~140 (banner → gold/neutral), new
`lib/storage/migrations.test.ts`.
**Tests:** migration fixture built from real v1 key blobs survives untouched at version 1;
future-version import rejected cleanly; export→import round-trip is lossless.
**Migration notes:** version starts at 1 = current shape; every later phase that touches a
persisted type adds a numbered migration + fixture test here.
**Risks:** import overwrites — require explicit confirm; validate before any write.
**Manual verify:** export from a seeded browser profile, wipe, import, confirm Today/Progress
identical; skipped workout renders muted; banner renders gold.

## Phase 2 — PWA/iOS device verification (checklist, not a build)
**Goals:** confirm on a physical iPhone what static analysis can't.
**Checklist:** Safari → Add to Home Screen → standalone launch (no browser chrome) · safe-area
at notch + home indicator (shell, bottom nav, sheets) · offline relaunch after airplane mode ·
no input zoom on focus anywhere · icon/splash correctness · quick actions reachable ≤2 taps.
**Files:** only what verification proves broken (`public/sw.js`, `app/layout.tsx`,
`app/globals.css`).
**Risks:** none if green; fixes are surgical.

## Phase 3 — Onboarding & universal profile
**Goals:** de-personalize defaults; collect the universal profile; domain enable/disable; MVD
definition; `InjuryProfile` foundation.
**Files:** `lib/types.ts` (`UserGoal`, `InjuryProfile`, `UserProfile` extensions:
demographics, goals, activity/experience/equipment, diet preference+restrictions, sleep target,
relationship status, social goals, health concerns, meds/supplements, tracking prefs,
`enabledDomains`, `mvd`), `lib/data/defaults.ts` (neutral defaults — no 3050/170/bulk goal,
pain flags default **false**; targets derived from profile via a standard static formula until
the expenditure engine calibrates), `components/shell/OnboardingGate.tsx` (multi-step,
skippable per step), `app/(app)/settings/page.tsx` (edit everything collected), migration #2
(old profiles gain new fields with safe defaults; existing painFlags preserved).
**Tests:** migration #2 fixture; `deriveStaticTargets()` (new pure helper) sanity cases.
**Migration notes:** `PainFlags` stays the storage shape this phase; `InjuryProfile` added
alongside with a `painFlagsFromInjuries()` derived view — training engine callers untouched
until Phase 7.
**Risks:** onboarding scope creep — keep each step ≤6 fields; defaults must remain genuinely
skippable.
**Manual verify:** fresh profile completes onboarding in <2 min; skip-all still lands on a
sane Today; disabling a domain hides its cards/quick actions.

## Phase 4 — Adaptive Expenditure Engine (flagship)
**Goals:** targets that adapt to the user's real data, with honest calibrating states.
**Files:** `lib/engine/trends.ts` (+`calculateSmoothedWeightTrend` EWMA — `calculateWeightTrend`
stays as fallback), new `lib/engine/expenditure.ts` (`estimateExpenditure` over rolling 14–21-day
windows, ~3500 kcal/lb tunable; `runWeeklyCheckIn` recalibrating targets toward goal rate with
plain-language "what changed and why"; data-quality guards: partial-logging-day exclusion,
minimum weigh-in count, calibrating state for first 2–3 weeks), `lib/types.ts`
(`ExpenditureEstimate`), `app/(app)/nutrition/page.tsx` (trend + weekly check-in card replaces
static-target framing; keep `getNutritionRecommendation()`'s voice), `app/(app)/progress/page.tsx`
(TDEE chart), `lib/engine/coachContext.ts` (feed check-in summary), migration #3 if profile
gains target-rate fields.
**Tests (new file `expenditure.test.ts`):** calibrating → estimating transition at the data
threshold; partial-day exclusion; recalibration math against hand-computed fixtures; guard
degradation back to static formula; EWMA vs raw trend on noisy fixtures.
**Risks:** silent target changes — every adjustment surfaces with its reason; `bodyRules.ts`
flat/fast rules remain the fallback path, not dead code.
**Manual verify:** seed 3 weeks of weigh-ins + meals; watch "calibrating — N more days" count
down; weekly check-in states old target → new target → why.

## Phase 5 — Streaks, Forge Score configurability, neutral sweep
**Goals:** consistency system decoupled from quality scoring; user-owned weights.
**Files:** new `lib/engine/streaks.ts` (`updateStreak`: MVD per profile, 2 freezes earned at
7-day milestones and auto-consumed, 48h earn-back via 2 consecutive MVDs, weekly 3-of-7 mode;
persisted `StreakState` via adapter — new `forge30:streaks` key + adapter methods),
`app/(app)/skills/page.tsx` (drop page-local `streakFor()`), `lib/engine/coachContext.ts`
(`skillMissedTwoDays` from streak state), `app/(app)/today/page.tsx` (flame by the score ring,
MVD status card; milestone moments 7/14/21/30), `lib/engine/forgeScore.ts` (+weights parameter
with spec defaults incl. health-marker 5 + relationship/social 5; renormalize to 100 for
disabled domains; new caution modifiers: BP concerning, unresolved conflict, doctor-task
skipped — neutral-toned), `app/(app)/settings/page.tsx` (weight editor), migration #4
(`StreakState` seed, weight prefs).
**Tests:** streak freeze consumption order, earn-back window edges (47h/49h), weekly-mode
3-of-7, milestone freeze grants; forgeScore renormalization sums to 100, disabled-domain
exclusion, modifier stacking — existing 15 tests untouched.
**Risks:** conflating streak (consistency) with score (quality) in UI copy — keep visually and
verbally separate per spec; midnight/timezone edges (reuse `toISODate` local-date convention).
**Manual verify:** miss a day with a freeze banked → streak holds and freeze decrements;
break + 2 MVDs within 48h → restored with warm copy; disable Relationships → weights sum 100.

## Phase 6 — Health tab (+ navigation restructure)
**Goals:** BP with correct safety behavior, fitness markers, bloodwork, Health Score; the new
5-item nav.
**Files:** `lib/types.ts` (`BloodPressureEntry`, `BloodworkReport`, `Biomarker`,
`HealthMarker`, `HealthScoreBreakdown`), new `lib/engine/healthRules.ts`
(`categorizeBloodPressure` — every AHA boundary; crisis → urgent warning; crisis + symptom
checklist → emergency-care instruction; `parseBloodworkInput` — manual + paste parser against
the seed biomarker dictionary, PDF/photo "coming soon"; `summarizeBiomarkers`;
`calculateHealthScore` — educational composite, explainable), new `app/(app)/health/page.tsx`
(+ forms in `components/forms/`), `components/cards/` (Health Score ring reusing the
`ScoreRing.tsx` sheet pattern), `app/(app)/today/page.tsx` (BP/RHR cards + "Log BP" quick
action when enabled), **`components/shell/BottomNav.tsx` → Today · Log · Coach · Progress ·
More** (+ Log sheet), `public/sw.js` (`SHELL_ROUTES` + `VERSION`), adapter methods + keys for
BP/bloodwork/markers, migration #5, verbatim health disclaimer.
**Tests (`healthRules.test.ts`):** every AHA boundary value (119/79, 120/80, 129, 130, 139/89,
140/90, 181, 121 diastolic), crisis + symptom escalation, parser happy/dirty-paste cases,
Health Score explain shape.
**Risks:** this is where danger/warning colors are *correct* — but only for crisis/stage
signals, not "elevated"; never diagnose ("hypertension" never asserted, categories only).
**Manual verify:** enter 185/125 → urgent copy + emergency-symptom check; paste a lab-report
blob → parsed rows editable before save; Health Score taps open the explain sheet.

## Phase 7 — Training upgrade
**Goals:** universal injury model; builder-generated plans; red-flag escalation.
**Files:** `lib/data/workoutPlan.ts` (tag every `ExerciseDef`: equipment, movement pattern,
difficulty, unilateral, category, injury-caution tags, substitutions — existing split becomes
one seeded output), `lib/engine/trainingRules.ts` (+`generateInjuryModification` generalizing
`getPainAwareWorkoutAdjustment` — existing 7→15%/8→20%/9+→25% math becomes the thoracic
instance; red-flag list → always "seek medical evaluation", never train through), new
`lib/engine/workoutBuilder.ts` (goal/days/session length/equipment/experience/injuries/likes →
plan), new builder UI in `app/(app)/training/` (logger, `ExerciseCard`/`RestTimer`/`SwapSheet`/
`HeatMap`/`PainStopModal` untouched), `InjuryProfile` intake flow (guided questions),
`coachContext.ts` (injury-aware inputs), migration #6 (painFlags → derived view flips; stored
`InjuryProfile[]` becomes source of truth).
**Tests:** builder filtering (equipment exclusion, contraindication exclusion, days/split
shape), `generateInjuryModification` parity with the existing 8 pain tests (which must keep
passing), red-flag escalation always wins over any modification.
**Risks:** the migration flip — do it behind the derived view with both paths tested before
removing anything.
**Manual verify:** build a 3-day dumbbell-only plan with a shoulder injury → no overhead
pressing, swaps explained; log sharp pain → existing stop modal unchanged; red-flag symptom →
medical-evaluation copy, session not modified around it.

## Phase 8 — Mind upgrades + Relationships tab
**Goals:** CBT thought record; full Relationships build; verbatim disclaimers.
**Files:** `app/(app)/mind/page.tsx` (+thought record: situation/thought/distortion-prompt/
reframe, stored via adapter; pattern surfacing reads LifeGraph outputs — no separate detector),
`lib/types.ts` (`RelationshipCheckIn`, `ConflictDebrief`, `PersonalityAssessment`,
`CompatibilityReport`, `SocialGoal`), new `lib/engine/relationshipRules.ts`
(`generateRelationshipPrompt` deck logic, `generateConflictRepairSuggestion`,
`calculateCompatibilityInsights` — similarities/differences/discussion prompts, never
verdicts), new `app/(app)/relationships/page.tsx` (modes, daily check-in, prompt decks,
conflict debrief, assessments, micro-lessons, social outreach goals on weekly streak mode),
Log-sheet + `SHELL_ROUTES` + `VERSION`, adapter keys, migration #7, **all four verbatim
disclaimers verified** (replace Mind's near-miss text; add Money's in this sweep if Phase 9
hasn't), Today relationship check-in card + quick action.
**Tests:** prompt-deck selection by mode, repair-suggestion guardrails (never labels the other
person; abuse-indicator input → support-resources copy, no reconciliation push), compatibility
insights shape.
**Risks:** highest safety-sensitivity phase — subagent review checks §Safety line by line.
**Manual verify:** each mode changes check-in + decks; conflict debrief produces neutral
summary + calm draft; disclaimers visible without scrolling tricks.

## Phase 9 — Money, Skills, Progress
**Goals:** money depth; more tracks; complete Progress.
**Files:** `lib/types.ts` (+recurring expense, debt, savings goal), money engine additions
(`calculateSafeToSpend` extending `trends.ts`'s breakdown logic), `app/(app)/money/page.tsx`
(recurring/debt/savings/emergency-fund/cash-flow/safe-to-spend; existing <30s log + Sunday
review untouched), `lib/data/skills.ts` (+nutrition basics, communication, sleep, career,
social confidence tracks), `app/(app)/progress/page.tsx` (+Health Score, TDEE, BP, RHR,
connection, outreach charts — lazy-load chart panels to hold bundle size; print stylesheet for
doctor-ready export using Phase 6 health data), migration #8.
**Tests:** `calculateSafeToSpend` (bills-aware, buffer-aware), recurring-expense projection;
existing spending tests extended.
**Manual verify:** safe-to-spend reacts to a logged bill; print preview of the health export is
legible mono-friendly; new charts render with sparse data.

## Phase 10 — Coach extension + LifeGraph
**Goals:** 10-part review; new domain rules; research mode; the pattern engine.
**Files:** `lib/types.ts` (`AIReview` +`healthAdjustment`, `relationshipSocialAdjustment` —
optional so saved 8-field reviews parse), `lib/engine/mockCoach.ts` (+BP-crisis urgent rule,
repeated-elevated-BP rule, conflict-without-repair rule, social-isolation rule — existing
register), `app/api/coach/route.ts` (`REVIEW_SCHEMA` + `SYSTEM_PROMPT` grown together; model
stays `claude-opus-4-8`), `app/(app)/coach/page.tsx` (10 sections; tolerant of old reviews),
new `app/api/research/route.ts` (server-side key, credible-source retrieval with citations,
uncertainty stated, never diagnosis/treatment; mock-off state when no key), new
`lib/engine/lifeGraph.ts` (`detectPatterns`: deterministic co-occurrence over trailing 30 days,
lagged pairs supported, ≥5-qualifying-day sample guard, ≥60% threshold, "possible pattern"
phrasing + one next experiment), surfacing on Today/Progress/Mind, `coachContext.ts` feeds
pattern summaries, migration #9 if needed.
**Tests:** 4 new mock-coach rules (existing 13 untouched), 10-part shape, lifeGraph
sample-size guard (4 days → nothing), threshold edges, lagged pairs, determinism.
**Risks:** schema/prompt drift between mock and live — one shared `CoachReview` type is the
contract; research mode must fail closed (absent, not hallucinated) without a key.
**Manual verify:** zero-key user gets a 10-part mock review referencing BP/relationship data;
seeded stress+spend history surfaces exactly one "possible pattern" with an experiment.

## Phase 11 — Final polish
Empty/loading states across new surfaces · accessibility pass (names, roles, focus, contrast) ·
Lighthouse PWA + perf pass · README rewrite for every new section, the 5-item nav, expanded
onboarding, AI setup (`/api/coach` + `/api/research`), iOS install · Vercel deploy config
check · final full-repo subagent review against `v2_spec.md`.

## Phase 12 — Monetization architecture (optional — only on explicit request)
Feature-flag scaffolding for free/plus/pro/max/household gating existing features; safety
surfaces (crisis copy, red-flag escalation, all four disclaimers) always free at every tier.
No payment integration.

---

## Cross-phase tracking

| Migration | Phase | Covers |
|---|---|---|
| v1 → 1 | 1 | versioning bootstrap, no shape change |
| 2 | 3 | profile universal fields, InjuryProfile alongside PainFlags |
| 3 | 4 | expenditure/target-rate fields |
| 4 | 5 | StreakState, score weight prefs |
| 5 | 6 | BP/bloodwork/marker collections |
| 6 | 7 | InjuryProfile becomes source of truth |
| 7–9 | 8–10 | relationships, money, review shape |

Nav + `SHELL_ROUTES` + SW `VERSION` change together: Phase 6 (restructure + /health) and
Phase 8 (/relationships). Verbatim disclaimers land: Health P6 · Mind/Relationships P8 ·
Money P8/P9. Test count checkpoints: start 36 → grows every phase that adds an engine (1, 3–10).
