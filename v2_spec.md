# FORGE30 v2 — OVERHAUL PROMPT (audit-verified, Claude Code / Claude Fable 5)

**Executor:** Claude Code running Claude Fable 5
**Mode:** Brownfield upgrade of `github.com/EminenceHairBoutique/Forge-30` (branch: `main`)
**Target:** Installable PWA, full-screen on iOS + desktop, deployed on Vercel

This version replaces the prior "audit-first" prompt. The audit has already been run against the real repository — pulled, installed, typechecked, tested, and built end-to-end — so Claude Code starts from verified ground truth instead of rediscovering it. Part A is that audit. Part B is the v2 spec. Part C is the phase plan, re-scoped against what's actually there.

**One model-scope note:** Claude Fable 5 is the agent executing this build inside Claude Code. That is separate from which model the *shipped app* calls at runtime for the AI Coach (`/api/coach`) — the existing route already correctly targets `claude-opus-4-8`, which is the right choice for a consumer-facing coaching feature and should stay as-is unless told otherwise (see A2).

---

## HOW TO RUN THIS PROMPT (operator instructions)

1. `git checkout -b v2-overhaul` on a clean clone of the repo.
2. Paste this file into Claude Code as `V2_SPEC.md` in the repo root, and reference it with `@V2_SPEC.md`. Start in **Plan Mode**.
3. First message to Claude Code: *"Read @V2_SPEC.md. Part A is a verified audit of this repo — confirm its key claims with a few spot-checks (don't redo the full audit), then write CLAUDE.md and V2_PLAN.md per A4. Stop for my review before writing any code."*
4. Run phases from Part C in order, one per session where practical. `/clear` between unrelated phases.
5. Gate every phase: `npm run typecheck` → `npm test` → `npm run build` → subagent diff review against this spec → fix gaps → commit.
6. Verify Phase 2 (PWA polish) claims on a real iPhone before proceeding — the audit found the PWA layer already installable, but device verification catches what static analysis can't.

---

# PART A — VERIFIED AUDIT

Performed by pulling the repo (`main`, commit at time of audit), running `npm install`, `npm run typecheck`, `npm test`, and `npm run build` to completion, and reading every source file. Results below are evidence-based, not inferred.

## A1. Build health — confirmed green

```
npm run typecheck   → clean, zero errors (strict + noUncheckedIndexedAccess)
npm test             → 36/36 passing (forgeScore.test.ts ×15, mockCoach.test.ts ×13, trainingRules.test.ts ×8)
npm run build        → succeeds, all 12 routes prerender statically, First Load JS 102–240kB
```

Stack confirmed: Next.js 15.5.20 (App Router), React 19, TypeScript strict, Tailwind v4, Vitest, `@anthropic-ai/sdk` ^0.109.1, `geist` fonts, `recharts`. No missing dependencies, no dead imports, no TODO/FIXME markers anywhere except one intentional stub (`supabaseAdapter.ts` throws "not implemented yet" by design).

**Conclusion: v1 is a genuinely production-quality build of the original 6-domain Forge30 spec (Today · Nutrition · Training · Mind · Money · Skills · Progress · Coach), not the expanded "universal lifestyle OS" scope.** There is no Health tab and no Relationships tab — that scope was never built, not broken. Everything that *was* built is built well. Treat this as a foundation to extend, not a codebase to fix.

## A2. Verified complete — do not rebuild these

| Area | Evidence | Notes |
|---|---|---|
| **StorageAdapter pattern** | `lib/storage/adapter.ts` (interface), `lib/storage/localStorageAdapter.ts` (SSR-guarded via `canUseStorage()`, try/catch on quota errors, `forge30:*`-prefixed keys), `lib/storage/supabaseAdapter.ts` (intentional stub), `lib/storage/provider.tsx` (React context) | UI never touches `localStorage` directly. Rule is fully respected. Extend the interface for new domains; don't replace it. |
| **Types centralized** | `lib/types.ts`, 373 lines | Matches the narrower spec 1:1. New v2 types (Health, Relationships, Streaks, Expenditure) get added here, not scattered. |
| **Forge Score engine** | `lib/engine/forgeScore.ts` + `forgeScore.test.ts` (15 tests) | Exact weights (15/15/10/15/10/10/10/10/5), partial-credit curve (`calorieProteinCredit`, ±10%→full, ±30%→zero, linear between), scaled penalties, and the result shape (`ScoreComponent[]` / `ScorePenalty[]`) is already tap-to-explain-ready. |
| **Score explainability UI** | `components/cards/ScoreRing.tsx` | Already a tap-to-open sheet listing every component and penalty. B1.4 in the spec below is **already shipped** for Forge Score — extend this pattern to the new Health Score, don't reinvent it. |
| **Mock AI Coach** | `lib/engine/mockCoach.ts` + `mockCoach.test.ts` (13 tests) | Deterministic, all spec rules present, exact 8-part `CoachReview` shape, tone matches "calm, direct, premium, not cheesy" well in practice — read the actual generated copy, it's good. |
| **Live AI Coach route** | `app/api/coach/route.ts` | Uses current, correct Claude API patterns: `output_config: { format: { type: "json_schema", schema } }` for structured outputs (GA, not beta), `thinking: { type: "adaptive" }`, model `claude-opus-4-8`, no `temperature`/`top_p` (correctly omitted — unsupported on Opus 4.7+), server-side-only key, graceful non-200 fallback to mock on any failure. **This route is correct as shipped — extend its system prompt and schema for new domains in Phase 9, don't rewrite it.** |
| **Pain-aware training engine** | `lib/engine/trainingRules.ts` + `trainingRules.test.ts` (8 tests) | Load-reduction scaling (7→15%, 8→20%, 9+→25%), overhead-press flagging, shrug warning, chest-supported-row/neutral-grip swap suggestions, PR tracking, muscle-group volume. |
| **Sharp-pain protocol** | `components/training/PainStopModal.tsx` | Exact stop→log→swap→reduce sequence, correct copy, dismissible without losing the logged pain event. |
| **PWA / iOS shell** | `public/manifest.json` (standalone, correct colors, full icon set incl. maskable), `public/sw.js` (network-first nav / cache-first static, versioned cache cleanup), `app/layout.tsx` (`appleWebApp` meta, `viewportFit: "cover"`), `app/globals.css` (`pt-safe`/`pb-safe`/`pb-safe-nav` utilities, 16px inputs, exact design tokens) | Icons verified as real 180/192/512/maskable PNGs, not placeholders. This is essentially the full B2 PWA requirement already met. Phase 2 becomes a device-verification pass, not a build phase. |
| **Design tokens** | `app/globals.css` | Matches the spec's palette exactly: `#0A0A0B`/`#141416`/`#1C1C1F` base, `#F5F1E8`/`#9B978C` text, `#C9A961` gold, `#3DFF8B` success, `#FF8A3D`/`#FF4D4D` warning/danger. |
| **Onboarding** | `components/shell/OnboardingGate.tsx` | Single-screen, skippable-with-defaults, matches the narrower spec (name, start date, calorie/protein/water targets, weight goal, 5 pain flags, spend limit). **Not** the expanded universal onboarding (age/sex/height/goal-weight/activity/equipment/diet-restrictions/etc.) — that's new work in Phase 3. |
| **README** | `README.md` | Accurate, complete: install steps, iOS/Android/desktop PWA install, Capacitor future path, customization pointers, AI coach setup, Supabase upgrade path. Update it per phase rather than rewriting it. |
| **Adherence-neutral design (mostly)** | grep audit across `components/` and `app/` | Danger/warning tones are used correctly in most places: sharp pain, overspend-past-limit, stress-purchase flags, high-pain calendar days. Two exceptions found — see A3. |

## A3. Concrete bugs / polish items (small, specific, fix in Phase 1)

1. **Adherence-shaming color violation.** `app/(app)/today/page.tsx` line ~165: `workoutStatus === "skipped"` maps to `tone: "danger"`. Skipping a workout is a missed habit, not a safety event — per the adherence-neutral rule (B1.3 below) this should be a neutral/muted tone, matching how missed calories/protein are already (correctly) handled elsewhere with no color penalty.
2. **Informational banner using warning color.** `app/(app)/nutrition/page.tsx` lines ~140–141: the "weight flat 7 days → +250 kcal" recommendation banner uses `border-warning/30 bg-warning/5 text-warning`. This is a helpful suggestion, not a problem — consider gold/neutral styling instead so warning-orange stays reserved for the two-tier safety signal it will carry in v2 (BP crisis, injury red flags).
3. **No schema versioning.** `lib/storage/localStorageAdapter.ts` has no version field or `migrate()` step. Not a bug today, but every v2 feature below changes the data shape — add versioning *before* Phase 3, or every subsequent phase risks corrupting existing users' localStorage on upgrade.
4. **No data export/import.** `app/(app)/settings/page.tsx` has profile editing and a (confirmed, double-tap) full reset, but no JSON export/import. For a localStorage-only app this is a real gap — one bad browser-storage clear currently loses everything with no recovery path.

## A4. Real gaps vs. the v2 "universal lifestyle OS" vision — this is the actual work

None of these are bugs. They're scope that was never built. Each maps to a Part C phase.

1. **No Adaptive Expenditure Engine.** `lib/engine/trends.ts` → `calculateWeightTrend()` is a raw last-minus-first delta over whatever's in the window (no smoothing). `lib/engine/bodyRules.ts` and `lib/engine/nutritionRules.ts` both consume this directly for the "+250 kcal if flat" rule. Static `calorieTarget`/`proteinTarget` live on `UserProfile` and never change themselves. This is the flagship v2 upgrade (B1.1) — a clean extension point, not a rewrite: keep `calculateWeightTrend`'s callers working, add the new EWMA + expenditure functions alongside.
2. **No general streak engine.** `grep` found exactly one streak implementation: `streakFor()` inline in `app/(app)/skills/page.tsx`, a page-local function that walks `SkillTask[]` history on every render — no persistence, no freezes, no earn-back, no MVD concept, no app-wide streak. `coachContext.ts` separately hand-computes a `skillMissedTwoDays` boolean rather than using any shared streak logic. Generalize the existing pattern into `lib/engine/streaks.ts` per B1.2 rather than building from nothing.
3. **No Health tab.** No `BloodPressureEntry`, `BloodworkReport`, or `Biomarker` types; no BP categorization logic; no bloodwork input/review anywhere. Full new build per B6.2.
4. **No Relationships tab.** No `RelationshipCheckIn`, `ConflictDebrief`, `PersonalityAssessment`, `CompatibilityReport`, or `SocialGoal` types; no conversation-prompt decks; no assessments. Full new build per B6.7.
5. **Injury model is minimal.** `PainFlags` is 5 booleans (`thoracic`, `rib`, `scapular`, `upperTrapDominant`, `leftArmAggravation`) hardcoded to one training profile — not the general `InjuryProfile` (body area, diagnosis, symptoms, pain score, aggravating/relieving movements, restrictions, onset date, professional care, notes) needed to support arbitrary injuries for arbitrary users. No red-flag symptom list (numbness, bowel/bladder loss, chest pain, etc.) exists anywhere.
6. **Onboarding is narrow.** Confirmed above (A2) — needs the universal fields (age, sex, height, goal weight, activity level, training experience, equipment, diet preference/restrictions, sleep target, relationship status, social goals, health concerns, meds, bloodwork upload, goal-type menu) per B4.
7. **Forge Score weights are hardcoded constants**, not user-configurable. No settings UI to adjust them, no renormalization when a domain (e.g., Relationships) is disabled. The result shape already supports display of weights (A2) — extend it to support *editing* them.
8. **No workout builder.** `lib/data/workoutPlan.ts` is one fixed seeded weekly split; exercises aren't tagged with equipment or injury-contraindication metadata. B6.4's goal/equipment/days/experience → generated-plan builder is entirely new.
9. **No diet-preference filtering.** `lib/data/mealPlan.ts` is one fixed 7-day rotation with no vegetarian/vegan/halal/etc. variants or filtering logic.
10. **No print/PDF export.** Nothing in `progress/page.tsx` or elsewhere produces a doctor-ready export.

## A5. CLAUDE.md to write in Phase 0 (keep under ~150 lines)

Include: exact commands (`npm run dev/build/test/typecheck/lint`), Node 18.18+/22 requirement, the StorageAdapter rule with a pointer to `lib/storage/adapter.ts`, the pure-engine rule with a pointer to `lib/engine/`, the design-token file (`app/globals.css`) and the adherence-neutral color rule (danger/warning reserved for genuine safety signals — cite A3 as the example of what *not* to do), the `forge30:*` localStorage key convention, the fact that `/api/coach` already uses correct current API patterns and should be extended not replaced, and "read V2_SPEC.md before large changes."

---

# PART B — THE v2 PRODUCT SPEC

## B1. What's new in v2 (research-driven; each maps to an A4 gap)

Grounded in category leaders: MacroFactor, MyFitnessPal, Cronometer, Strong, Fitbod, WHOOP, Oura, Headspace, Monarch, YNAB, PocketGuard, Streaks, Duolingo, Paired, Gottman-style tools.

### B1.1 Adaptive Expenditure Engine (MacroFactor-inspired) — flagship upgrade, fills A4.1
Static calorie targets are the current state; v2 estimates the user's *actual* expenditure from their own data:
- Add a **smoothed weight trend** (EWMA over daily weigh-ins) in `lib/engine/trends.ts` alongside (not replacing) `calculateWeightTrend` — `bodyRules.ts` and `nutritionRules.ts` currently import the raw version, so land the new function under a distinct name (e.g., `calculateSmoothedWeightTrend`) and migrate callers deliberately.
- Estimate **dynamic TDEE** from the relationship between logged intake and smoothed-weight change over rolling 14–21 day windows (~3500 kcal ≈ 1 lb, tunable constant).
- **Weekly check-in recalibration:** every 7 days, recompute TDEE and move calorie/protein targets toward the user's goal rate. Surface what changed and why in plain language — this is a Coach-adjacent surface, wire it through `coachContext.ts`.
- **Data-quality guards:** ignore obviously-partial-logging days; require a minimum weigh-in count per window; degrade to the current static-formula behavior with a "calibrating — N more days" state for the first 2–3 weeks. The existing `bodyRules.ts` flat/fast-change rules become the fallback, not dead code.

### B1.2 Streak & Consistency System — fills A4.2
- **Minimum Viable Day (MVD):** user-configurable, default = one meal logged + daily check-in (~2 min). A hard day still counts.
- **Streak Freezes:** hold up to 2, auto-consumed on a missed day, earned at 7-day milestones (not free/infinite).
- **Earn-Back:** 2 consecutive MVDs within 48h of a break restores the streak. Treat a broken streak as a recovery state in the copy, not a failure.
- **Weekly streaks** for circumstance-vulnerable habits (workouts, social outreach): 3-of-7 counts.
- Build `lib/engine/streaks.ts` as the generalized version of `skills/page.tsx`'s existing `streakFor()` — same underlying idea (consecutive-day walk), now persisted via a `StreakState` type through the StorageAdapter, covering skills, the app-wide daily streak, and weekly-mode habits. Milestone celebrations at 7/14/21/30 days.

### B1.3 Adherence-neutral design (hard rule, fixes A3.1–A3.2 and governs everything new)
Red/orange reserved exclusively for genuine safety warnings: BP crisis range, sharp/severe injury pain, red-flag symptoms. Never for missing a calorie target, skipping a workout, or any ordinary human variance. The subagent reviewer for every phase checks new UI against this rule explicitly.

### B1.4 Explainable scores (extend the shipped pattern)
`ScoreRing.tsx`'s tap-to-explain sheet already does this for Forge Score — reuse the same `ScoreComponent[]`/`ScorePenalty[]` shape and `Sheet` pattern for the new Health Score. Don't design a second UI pattern for the same job.

### B1.5 Speed logging everywhere
Every log flow targets <30 seconds: favorites, recents, one-tap repeat-yesterday, quick-add templates, `inputmode="decimal"` numeric entry (already used correctly in `OnboardingGate.tsx` and `settings/page.tsx` — follow that precedent in new forms).

### B1.6 Data lifecycle (fixes A3.3–A3.4)
Schema version field + `migrate()` step in `localStorageAdapter.ts`, landed *before* any v2 type changes. JSON export/import in Settings. Doctor-ready print export from Progress/Health (browser print stylesheet is fine for MVP).

## B2. Tech stack (unchanged, confirmed correct)

Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · Vitest · `StorageAdapter` interface (localStorage now, `SupabaseAdapter` stub for later) · `/api/coach` extended in place · Vercel deploy. No stack changes needed — everything is already the right choice.

## B3. Design system (unchanged, confirmed shipped correctly — see A2)

Reuse `app/globals.css` tokens as-is. Nav gains **Health** and **Relationships**: **Today · Health · Nutrition · Training · Mind · Money · Relationships · Skills · Progress · Coach**. Update `components/shell/BottomNav.tsx` and `public/sw.js`'s `SHELL_ROUTES` together — the service worker route list will silently miss the new pages if only the nav is updated.

## B4. Onboarding upgrade (extends `OnboardingGate.tsx`, fills A4.6)

Add to the existing single-screen flow (or split into a short multi-step flow if the single screen gets too dense — operator's call, ask if unsure): age, sex, height, goal weight, primary + secondary goals, activity level, training experience, equipment, diet preference + restrictions, sleep target, relationship status + social goals, health concerns, injuries (repeatable `InjuryProfile`, see B6.4), optional meds/supplements, optional bloodwork, tracking preferences, MVD definition (B1.2). Keep it skippable with sensible defaults — that pattern already works well, don't lose it.

Goal types: gain muscle · lose fat · recomp · improve health markers · strength · cardio fitness · reduce stress · improve sleep · improve relationship · improve dating life · build friendships · improve finances · build discipline · learn skills · general reset.

## B5. Forge Score upgrade (extends `forgeScore.ts`, fills A4.7)

Keep the existing component/penalty engine and test suite intact — add: user-visible, adjustable weights in Settings (default weights close to current: nutrition 15/15, hydration 10, movement 15, recovery 10, health-marker check-in 5 *(new)*, mental reset 10, spending 10, relationship/social 5 *(new)*, skill 5), with renormalization to 100 when a domain is disabled. New caution modifiers: BP concerning range, unresolved relationship conflict, skipped user-added doctor-directed task. Every change here needs new unit tests alongside the 15 that already pass — don't regress `forgeScore.test.ts`.

## B6. Section specs (new sections use full detail; existing sections list only the delta)

### B6.1 Today — delta only
Add: BP-today card, resting HR, relationship check-in card, streak flame next to the Forge Score ring, "Log BP" and "Relationship Check-In" quick actions. Fix A3.1 (skipped-workout tone) while touching this file.

### B6.2 Health (new)
1. **Bloodwork input & AI review.** Manual entry + copy/paste parser first; PDF/image upload as a "coming soon" placeholder. Parse biomarker name/result/unit/reference range/lab date/flag/trend. Seed dictionary: CBC, CMP, lipids, glucose metabolism, thyroid, iron, vitamins, inflammation, hormones (full lists as in prior spec revisions — don't trim). AI review: in/out of range vs. the lab's own ranges, general relevance, patterns worth discussing with a doctor, lifestyle areas to review, trend over time, generated doctor-visit questions. Never diagnose; medication changes only framed as "ask your clinician"; always note ranges vary.
2. **Blood pressure tracker.** Systolic/diastolic/pulse/time/position/context/notes. AHA categories: normal <120/<80 · elevated 120–129/<80 · stage 1 130–139 or 80–89 · stage 2 ≥140 or ≥90 · crisis >180 and/or >120. Crisis → urgent warning; crisis + chest pain/shortness of breath/back pain/numbness/weakness/vision changes/trouble speaking → instruct emergency care immediately. Never diagnose hypertension.
3. **Fitness markers:** RHR, HRV, sleep, steps, cardio/zone-2 minutes, VO2max estimate, waist, weight, body-fat estimate, grip strength, push-up test, plank time, 1-mile time, mobility, pain, energy, soreness.
4. **Health Score:** educational composite (eat better, move more, avoid nicotine, sleep well, healthy weight, lipids, glucose, BP), explainable via the `ScoreRing.tsx` pattern (B1.4), never diagnostic.

### B6.3 Nutrition — delta only
Wire in the Adaptive Expenditure Engine (B1.1): replace the static-target display with the expenditure trend chart + weekly check-in card, keep `getNutritionRecommendation()`'s existing suggestion copy style (it's good — "a whey shake covers ~46g" is exactly the right register, match it for new suggestions). Add diet-preference-aware filtering to `lib/data/mealPlan.ts` (A4.9) and micronutrient awareness on logged foods where data exists. Fix A3.2 (banner tone) while touching this file.

### B6.4 Training — delta only
Add the workout **builder** (goal/equipment/days/experience/injury restrictions/liked-disliked → generated plan) as a new layer on top of the existing exercise/logger infrastructure — don't replace `ExerciseCard.tsx`, `RestTimer.tsx`, `SwapSheet.tsx`, `HeatMap.tsx`, or `trainingRules.ts`'s pain engine, all of which are solid. Tag `ExerciseDef` entries in `lib/data/workoutPlan.ts` with equipment + injury-contraindication metadata so the builder has something to filter on. Generalize `InjuryProfile` (A4.5) beyond the current 5-boolean `PainFlags` — keep `PainFlags` working as a derived/compatible view if that's the lower-risk migration path. Add the red-flag symptom list (sudden severe pain, numbness/weakness, bowel/bladder loss, chest pain, shortness of breath, unexplained swelling, fever with joint pain, major trauma, progressive neurologic symptoms) → always escalate to "seek medical evaluation," never train through.

### B6.5 Mind — delta only
Add CBT-style thought record + reframing, emotional pattern detection (recurring triggers surfaced over time from existing `JournalEntry` history). Keep the existing breathing reset, pause timer, boundary script generator, and disclaimer as-is.

### B6.6 Money — delta only
Add recurring-expense tracker, debt list, savings goal, emergency fund, cash-flow view, "can I afford this?" safe-to-spend quick check. Keep the existing <30s logging flow, Sunday review, and stress-purchase tracking as-is — they're already good.

### B6.7 Relationships (new)
Modes: single/dating · in a relationship · married/long-term · complicated · family focus · friendship focus · social confidence. Daily check-in (connection/communication/conflict/repair/appreciation/boundary/heard/safe + note). Conversation prompt decks (getting-to-know / emotional intimacy / conflict repair / values / money / family / intimacy-adults / future planning / appreciation / apology / boundaries / friendship / family connection). Conflict debrief (what happened/felt/needed/they-needed/did-well/did-poorly/repair/boundary) with AI neutral-summary + repair-language + calm-message-draft output — never diagnose or label the other person, never encourage unsafe reconciliation where abuse indicators exist. Optional assessments (Big Five, attachment style, love languages, conflict style, communication style, values, lifestyle/financial compatibility, social energy, emotional regulation) — couples see similarities/differences/discussion prompts, never a deterministic compatible/incompatible verdict. Micro-lessons per the earlier universal spec (active listening, repair, validation, boundaries, apologizing, etc., inclusive tips for men/women/everyone, no stereotyping). Social connection: outreach goals (weekly streak per B1.2), social calendar, activity ideas, post-event reflection.

### B6.8 Skills — delta only
Migrate `streakFor()` to `lib/engine/streaks.ts` (B1.2) with persistence. Add the additional default tracks from the universal spec if not already present (nutrition basics, communication, sleep optimization, career/business, social confidence) alongside the existing finance/regulation/movement tracks.

### B6.9 Progress — delta only
Add: expenditure/TDEE trend, BP trend, RHR trend, relationship connection trend, social outreach trend — alongside all existing charts (weight, calories, protein, workout completion, strength/PRs, spending, mood/stress, skills, Forge Score, pain). Add doctor-ready print export (A3.4/B1.6).

### B6.10 Coach — delta only
**Extend, don't rewrite, `app/api/coach/route.ts` and `lib/engine/mockCoach.ts`.** Both are correct and well-tested as shipped. Add to the existing 8-part structure as new domains land: one health/BP adjustment, one relationship/social adjustment — matching the exact tone and one-to-three-sentence register the mock engine already nails. Extend `REVIEW_SCHEMA` and `SYSTEM_PROMPT` together; add new mock-engine rules per B1's domains (BP crisis → urgent warning; repeated elevated BP → track + discuss with clinician; conflict without repair → calm repair attempt; social isolation high → one low-pressure outreach) following the existing rule style in `mockCoach.ts` exactly. Add a **research mode** (optional, live-AI only): credible-source retrieval with citations, states uncertainty, separates evidence from speculation, never presents research as diagnosis or a treatment plan.

## B7. Data model & engine additions

New types in `lib/types.ts` (alongside, not replacing, the existing 373 lines): `InjuryProfile`, `InjuryModification`, `HealthMarker`, `BloodPressureEntry`, `BloodworkReport`, `Biomarker`, `RelationshipCheckIn`, `ConflictDebrief`, `PersonalityAssessment`, `CompatibilityReport`, `SocialGoal`, `StreakState`, `ExpenditureEstimate`.

New engine functions in `lib/engine/` (pure, Vitest-tested, following the existing file-per-domain convention): `calculateSmoothedWeightTrend`, `estimateExpenditure`, `runWeeklyCheckIn` (extends `trends.ts`/new `expenditure.ts`); `updateStreak` with MVD/freeze/earn-back/weekly-mode logic (new `streaks.ts`); `categorizeBloodPressure`, `parseBloodworkInput`, `summarizeBiomarkers` (new `healthRules.ts`); `generateInjuryModification` (extends `trainingRules.ts`); `generateRelationshipPrompt`, `generateConflictRepairSuggestion`, `calculateCompatibilityInsights` (new `relationshipRules.ts`); `detectPatterns` (new, or extends `weeklySummary.ts`).

Minimum new test coverage, matching the rigor of the existing 36 tests: expenditure engine (calibrating state, partial-day guard, recalibration math), streak engine (freeze consumption, earn-back window, weekly mode), BP categorization (every AHA boundary + crisis flow), injury modification, new mock-coach rules.

Persistence: add schema versioning + `migrate()` to `localStorageAdapter.ts` first (A3.3), write migration tests proving current-shape user data survives. Add JSON export/import (A3.4).

## B8. Safety spec (verbatim requirements — none of this exists yet since Health/Relationships are new)

The app never claims to diagnose medical conditions, replace a physician/therapist/emergency care/dietitian/financial advisor/lawyer, guarantee injury recovery, or guarantee relationship success. It may summarize user data, flag values worth discussing with a professional, suggest habits generally associated with better health, recommend safer training modifications, encourage professional evaluation, provide educational information with citations, and help users prepare better questions for their professionals.

Ship these disclaimers verbatim, placed persistently in their sections:
- **Health/bloodwork:** "Forge30 provides educational wellness insights only. It does not diagnose, treat, cure, or prevent disease. Always consult a qualified healthcare professional for interpretation of bloodwork, symptoms, medications, injuries, or medical concerns."
- **Mental health:** "Forge30 supports reflection and habit-building. It is not therapy, crisis care, or diagnosis. If you are in danger or may harm yourself or someone else, contact emergency services or a crisis hotline immediately."
- **Relationships:** "Forge30 provides relationship education and communication tools. It does not determine whether a relationship is safe, abusive, compatible, or worth continuing. If there is violence, coercion, threats, stalking, or fear, seek professional/legal/domestic violence support."
- **Finance:** "Forge30 provides budgeting and spending awareness tools. It is not professional financial, tax, legal, or investment advice."

The existing Mind section already carries a disclaimer in spirit through its careful, non-diagnostic copy in `mockCoach.ts` — confirm it matches the verbatim text above when Phase 7 touches that file, rather than assuming it's already correct.

---

# PART C — BUILD PHASES (re-scoped against the audit)

Every phase: `npm run typecheck` clean → `npm test` passes (including new tests, never fewer than the current 36) → `npm run build` passes → subagent diff review against this spec, explicitly checking the B1.3 adherence-neutral rule → fix gaps → commit.

- **Phase 1 — Data lifecycle & polish fixes.** Schema versioning + `migrate()` in `localStorageAdapter.ts` (A3.3). JSON export/import in Settings (A3.4). Fix the two adherence-neutral violations (A3.1, A3.2). This phase touches no new features — it's the safety net every later phase depends on. Gate adds: a migration test proving today's real data shape survives untouched.
- **Phase 2 — PWA/iOS device verification.** The audit found this essentially complete (A2). Operator installs the current build to a real iPhone via Add to Home Screen and confirms: standalone launch, safe-area rendering, offline shell, no input-zoom. Fix anything that fails; otherwise this phase is a checklist, not a build.
- **Phase 3 — Adaptive Expenditure Engine + onboarding upgrade.** Build `calculateSmoothedWeightTrend`, `estimateExpenditure`, `runWeeklyCheckIn` in `lib/engine/`. Wire into Nutrition (replace static-target framing with the expenditure trend + weekly check-in card) and Progress. Expand `OnboardingGate.tsx` per B4. Update `defaultProfile()` in `lib/data/defaults.ts` accordingly.
- **Phase 4 — Streak system + Forge Score configurability.** Build `lib/engine/streaks.ts`, migrate `skills/page.tsx`'s `streakFor()` and `coachContext.ts`'s `skillMissedTwoDays` onto it, add the app-wide daily streak with flame on Today. Add configurable Forge Score weights in Settings with renormalization, extending (not replacing) `forgeScore.ts`.
- **Phase 5 — Health tab.** New types, `healthRules.ts`, BP tracker with AHA categories + crisis flow, fitness markers, Health Score (reusing the `ScoreRing.tsx` explain pattern), bloodwork manual entry + paste parser + AI review scaffolding. Add "Health" to `BottomNav.tsx` and `sw.js`'s `SHELL_ROUTES` in the same commit.
- **Phase 6 — Training upgrade.** Exercise-library tagging, workout builder, generalized `InjuryProfile` + red-flag escalation layered onto the existing pain engine.
- **Phase 7 — Relationships tab + Mind upgrades.** Full B6.7 build. Thought record + pattern detection in Mind. Verify the four B8 disclaimers are present verbatim across Health/Mind/Relationships/Money.
- **Phase 8 — Money upgrades + Skills curricula + Progress overhaul.** Recurring/debt/savings/cash-flow/safe-to-spend. Additional skill tracks. All new Progress charts + print export. Add "Relationships" to nav/SW route list in the same commit as Phase 7 if not already done.
- **Phase 9 — Coach extension.** Extend `REVIEW_SCHEMA` and `SYSTEM_PROMPT` in `app/api/coach/route.ts` and the matching rules in `mockCoach.ts` for the new domains — do not rewrite either file. Add research mode. Update README for every new section, the new nav items, and the expanded onboarding. Final Lighthouse + accessibility pass. Deploy config check.

---

# PART D — QUALITY BAR & ACCEPTANCE

No lorem ipsum, no broken links, no generic dashboards, no clutter. Fast input flows (<30s per log; essentials loggable in <5 min/day) — match the bar `SpendLogSheet.tsx` and `AddMealSheet.tsx` already set. Good empty states. Accessible labels (the existing `aria-label` on `ScoreRing.tsx`'s trigger is the right level of care — match it). Readable charts. Every tab has a clear purpose. Premium and practical. Never regress the 36 existing passing tests or the clean typecheck/build.

**v2 ships when a user can:** everything the current build already does (open installed iPhone app, see Today, log nutrition/training/mind/money/skills fast, get pain-aware training swaps, read an explained Forge Score, get an 8-part AI review) **plus**: get calorie targets that adapt to real expenditure with a plain-language weekly check-in · keep a streak through an imperfect week via MVD/freezes/earn-back · input bloodwork and get safe educational insights + doctor questions · track BP with correct categories and crisis safety behavior · build a training plan around goals/equipment/injuries with explained swaps · debrief a conflict and get a calm repair draft · export all their data · receive AI feedback that now also covers health and relationships.

**The differentiator is unchanged:** food apps track nutrition, gym apps track workouts, finance apps track spending, meditation apps track mood, dating apps track matches, habit apps track streaks — Forge30 connects the domains. The daily loop — plan → execute → log → honest AI feedback → adjust tomorrow — **is the product**, and it already works end to end in the current build. v2 widens what feeds the loop; it does not change what the loop is.
