# FORGE30 v2 — UNIVERSAL OVERHAUL MASTER PROMPT (Claude Code / Claude Fable 5)

You are Claude Code, running as Claude Fable 5, acting as a senior product engineer, UX architect, AI product strategist, and safety-aware full-stack builder, working inside the existing `Forge-30` GitHub repository.

**Model-scope note:** Fable 5 is the agent executing this build. That is a separate question from which model the *shipped app* calls at runtime for the AI Coach (`/api/coach`) — keep that on `claude-opus-4-8` (see the Coach section; this is verified correct in the current codebase) unless told otherwise. Don't conflate "the model building this" with "the model this app calls."

**Safety-posture note for Fable 5 specifically:** this build touches biology-adjacent content (bloodwork, biomarkers, blood pressure). Fable 5 carries extra caution on biology topics generally, but everything in this spec is educational wellness content with mandatory disclaimers, not diagnostic or treatment guidance — that framing should keep the work well inside normal bounds throughout. If a specific sub-task feels like it's drifting toward clinical specificity (dosing, treatment protocols, diagnostic certainty), that's a signal to pull back toward "flag it, suggest discussing with a professional" — which is what the spec already asks for, not a reason to refuse the section wholesale.

Important context:
- The existing repository was created from an original prompt personalized for one user.
- Forge30 v2 has **not** been built yet — it is in planning mode.
- Your job is not to blindly patch the existing app, and it is not to rebuild it from scratch either.
- Your job is to audit the current v1 codebase, preserve what is useful and already correct, generalize what is personal-specific, and build Forge30 v2 as a universal all-in-one lifestyle operating system for anyone.

Forge30 v2 must become a premium, installable, mobile-first PWA that helps users improve health, fitness, nutrition, recovery, bloodwork/biomarkers, injury-aware training, mental habits, finances, relationships, social connection, skills, and daily decision-making.

The product must be useful for people at different life stages: beginners, athletes, people rebuilding after burnout, people losing fat or gaining muscle, people improving health markers, people managing stress, people fixing spending habits, people improving relationships or building friendships, people tracking blood pressure or bloodwork, people working around injuries, people trying to become more disciplined, and people who simply want one clear daily plan.

Forge30 is not a generic habit tracker. It is a personal operating system that connects the dots across a user's life.

Core loop: **Plan → Execute → Log → Understand → Adjust Tomorrow.**

The differentiator: other apps track isolated categories; Forge30 connects the categories. Sleep affects training, cravings, blood pressure, mood, conflict, spending, and motivation. Stress affects food, workouts, relationships, pain, and financial decisions. Injuries affect movement, confidence, mental health, and adherence. Relationship conflict affects sleep, workouts, spending, and emotional regulation. Bloodwork and blood pressure become more useful viewed alongside behavior. Forge30 reveals these connections and turns them into a simple next action.

---

## HOW TO RUN THIS PROMPT (operator instructions — not part of the system framing above)

1. `git checkout -b v2-overhaul` on a clean clone.
2. Save this file as `V2_SPEC.md` in the repo root; reference it in Claude Code with `@V2_SPEC.md`. Start in **Plan Mode**.
3. First message: *"Read @V2_SPEC.md, including the Known Findings in Phase 0. Confirm those findings with spot-checks rather than rediscovering them from scratch, then complete the rest of Phase 0 and produce AUDIT.md, CLAUDE.md, and V2_PLAN.md. Stop for my review before writing any code."*
4. Run phases in order from the Build Phases section, one per session where practical, `/clear`-ing between unrelated phases so context doesn't degrade output quality.
5. Gate every phase: typecheck clean → tests pass (never fewer than whatever the current count is — check it, don't guess) → build passes → subagent diff review against this spec → fix gaps → commit.
6. Device-verify PWA/iOS claims on a real iPhone before trusting Phase 2 as complete — static analysis can't catch everything a real Add-to-Home-Screen install can.
7. If a decision in this spec is marked "operator's call" or conflicts with what Phase 0 finds in the repo, Claude Code should ask rather than assume — one clarifying question, not a cascade of them.

---

# OPERATING MODE

1. Audit first. Plan second. Build in phases only after the plan is approved.
2. Keep changes small and reviewable — one phase, one coherent diff.
3. Do not rebuild the app from scratch unless the audit proves it's necessary. (It won't — see Known Findings below.)
4. Do not preserve personal-specific logic from v1 unless it's generalized for all users.
5. Never modify a file before reading it.
6. Never delete data structures without a migration path.
7. Never bypass failing checks.
8. Pure logic lives in `/lib/engine`. UI components never contain scoring, health, calorie, streak, or recommendation math.
9. All browser APIs are SSR-safe.
10. All persistent data goes through a `StorageAdapter`.
11. All safety rules are requirements, not polish.
12. After every build phase: typecheck, tests, build — all three, every time.
13. When a phase would touch a file already confirmed correct in Phase 0's Known Findings, **extend it, don't rewrite it.** Rewriting working, tested code is wasted effort and new-bug risk with no offsetting benefit.

---

# PHASE 0 — AUDIT

## 0.1 Known findings (confirm these, don't rediscover them)

A prior audit pulled this repo, ran `npm install`, `npm run typecheck`, `npm test`, and `npm run build` to completion, and read every source file. Results:

**Build health:** typecheck clean (strict + `noUncheckedIndexedAccess`), all tests passing, production build succeeds, all routes prerender statically. This is a genuinely production-quality build of the *original* narrower Forge30 spec (Today · Nutrition · Training · Mind · Money · Skills · Progress · Coach) — there is no Health tab and no Relationships tab yet. That's unbuilt scope, not a defect. Confirm the current test count and build output as a first step in every session (`npm run typecheck && npm test && npm run build`), since these numbers will grow across phases.

**Verified complete — extend, don't rebuild:**
- `lib/storage/adapter.ts` / `localStorageAdapter.ts` / `provider.tsx` — the `StorageAdapter` pattern is fully and correctly implemented, SSR-guarded, `forge30:*`-prefixed keys. `supabaseAdapter.ts` is an intentional not-implemented stub.
- `lib/types.ts` — centralized, matches the narrower v1 spec cleanly. New v2 types get added here.
- `lib/engine/forgeScore.ts` + its test file — exact weighted scoring, partial-credit curve, scaled penalties, and a result shape (`ScoreComponent[]` / `ScorePenalty[]`) that's already explain-ready.
- `components/cards/ScoreRing.tsx` — **already implements tap-to-explain** for the Forge Score via a bottom sheet listing every component and penalty. This is the exact pattern the Health Score and any future score need — reuse it, don't design a second explainability UI.
- `lib/engine/mockCoach.ts` + test file — deterministic, well-tested, and the actual generated copy is genuinely good ("a whey shake covers ~46g" register) — match that voice for every new rule you add.
- `app/api/coach/route.ts` — already uses current, correct Claude API patterns: `output_config: { format: { type: "json_schema", schema } }` for structured outputs (this is GA, not beta), `thinking: { type: "adaptive" }`, model `claude-opus-4-8`, no `temperature`/`top_p` (correctly omitted — unsupported on Opus 4.7+ models), server-side-only key, graceful fallback to mock on any non-200. **Extend `SYSTEM_PROMPT` and `REVIEW_SCHEMA` in place for new domains — do not rewrite this route.**
- `lib/engine/trainingRules.ts` + test file — pain-aware load scaling, overhead-press flagging, swap suggestions, PR/volume tracking, all correct.
- `components/training/PainStopModal.tsx` — the sharp-pain stop→log→swap→reduce protocol is already implemented correctly.
- PWA shell — `public/manifest.json`, `public/sw.js`, `app/layout.tsx`'s Apple meta tags, and `app/globals.css`'s safe-area utilities and 16px-input rule together already satisfy essentially the full PWA/iOS requirement. Treat the PWA phase as a device-verification pass, not a build phase, unless verification finds something broken.
- `app/globals.css` — design tokens already match spec exactly (base `#0A0A0B`/`#141416`/`#1C1C1F`, ivory `#F5F1E8`, muted `#9B978C`, gold `#C9A961`, success `#3DFF8B`, warning `#FF8A3D`, danger `#FF4D4D`).

**Confirmed personalization to generalize (this fills the Personalization Audit requirement below with real evidence, not guesswork):**
- `lib/data/defaults.ts` — `DEFAULT_CALORIE_TARGET = 3050`, `DEFAULT_PROTEIN_TARGET = 170`, `DEFAULT_WEIGHT_GOAL = "Gain 4–8 lb (lean-mass focus)"` are one user's bulking targets hardcoded as universal defaults.
- `lib/types.ts`'s `PainFlags` — five booleans (`thoracic`, `rib`, `scapular`, `upperTrapDominant`, `leftArmAggravation`) hardcoded to one person's injury pattern, wired directly into the training engine. This needs to generalize into a real `InjuryProfile` (see Data Model) while ideally keeping `PainFlags` working as a derived/compatible view so the migration is lower-risk.
- `lib/data/mealPlan.ts` — one fixed 7-day chicken/beef/salmon-heavy rotation with no diet-preference variants.
- `lib/data/workoutPlan.ts` — one fixed weekly split, not generated from goals/equipment/experience.
- `app/(app)/skills/page.tsx` — has a working, page-local `streakFor()` function (walks task history, no persistence, no freezes/earn-back). This is real precedent to generalize into the v2 streak engine, not a gap to fill from nothing.
- `lib/engine/trends.ts`'s `calculateWeightTrend()` is a raw last-minus-first delta, not a smoothed trend — the exact spot the Adaptive Expenditure Engine extends. Add the new smoothed/expenditure functions alongside it under distinct names; `bodyRules.ts` and `nutritionRules.ts` both call the existing function today, so migrate those call sites deliberately rather than breaking them.

**Two small, specific bugs to fix in Phase 1 (not blockers, but real):**
- `app/(app)/today/page.tsx`: `workoutStatus === "skipped"` currently maps to the `danger` (red) tone. Per the adherence-neutral rule below, a skipped workout is a missed habit, not a safety event — this should be neutral/muted, matching how missed calories/protein are already (correctly) handled with no color penalty elsewhere in the same file.
- `app/(app)/nutrition/page.tsx`: the "weight flat 7 days → +250 kcal" banner uses warning-orange styling for what is a helpful suggestion, not a problem. Recommend neutral/gold instead, so warning-orange stays reserved for the two-tier safety signal it carries elsewhere (BP crisis, injury red flags, in v2).

**Gaps not yet mentioned above that are pure net-new work:** no Health tab, no Relationships tab, no general streak persistence, no user-configurable Forge Score weights, no workout builder, no diet-preference filtering, no data export/import, no schema versioning/migration step in `localStorageAdapter.ts`.

## 0.2 Produce these files (audit-only — no production code yet)

**AUDIT.md** — repo map (framework/versions/package manager/routes/components/storage/tests/build commands); feature inventory (what exists vs. what v2 needs, using 0.1 as the starting point and adding anything 0.1 missed); personalization audit (use the concrete findings above as the seed list, and look for anything else hardcoded to one user, one injury, one goal, one diet, one workout plan, one relationship situation, one money situation); architecture audit; PWA audit (confirm 0.1's claims on-device where possible); UI/UX audit (nav crowding — see Navigation below); safety audit (which disclaimers exist today vs. the required set); risk list; exact build/test status as of this run.

**CLAUDE.md** (~150 lines) — stack + package manager, run/test/build/typecheck commands, folder conventions, the StorageAdapter rule, the pure-engine rule, the design-token file and adherence-neutral color rule (cite the two Phase-1 bugs above as the concrete "don't do this" example), the `forge30:*` key convention, the note that `/api/coach` and `mockCoach.ts` are already correct and should be extended not replaced, accessibility rule, commit convention, and "read V2_SPEC.md before large changes."

**V2_PLAN.md** — phase-by-phase plan mapped onto the Build Phases section below, adjusted for what 0.1 already found true. For each phase: goals, files affected (cite real paths), acceptance criteria, tests required, migration considerations, risks, what to verify manually.

**Stop after Phase 0 and wait for approval.**

---

# PRODUCT POSITIONING

Forge30 v2 should feel like: MacroFactor-style adaptive nutrition intelligence · Strong/Fitbod-style fast workout logging and progression · WHOOP/Oura-style score explanations and recovery awareness · Cronometer-style health data seriousness · YNAB/Monarch/PocketGuard-style financial clarity · Headspace-style calm mental reset tools · Paired/Gottman-inspired relationship prompts and repair tools · Streaks/Duolingo-inspired consistency mechanics without shame · a private AI coach that connects every domain.

Do not clone any app. Use category best practices and create something more unified.

The app should be universal, configurable, premium, fast, calm, nonjudgmental, useful in under 5 minutes a day, deeper when the user wants depth, and safe around medical, mental health, relationship, and financial topics.

---

# TECH STACK

Use the existing repo stack — it's already the right stack, confirmed in 0.1. Next.js App Router · TypeScript strict · Tailwind CSS v4 · existing component system (shadcn-style, hand-rolled where iOS reliability mattered — e.g. native `<select>` over a Radix select, confirmed a deliberate and correct choice, keep that pattern for new form controls) · Recharts · Vitest for pure engine tests · localStorage behind `StorageAdapter` · `SupabaseAdapter` stays a stub unless explicitly approved · `/api/coach` (existing, extend) and new `/api/research` route, both server-side-key-only · mock AI engine always works with no live key · Vercel deploy · installable PWA with iOS Add to Home Screen.

---

# DESIGN SYSTEM

Forge30 should feel like a premium personal command center, not a homework app. Confirmed already shipped correctly (0.1): dark-first, matte black/charcoal base, warm ivory text, muted gold accent, electric green only for completion/progress, orange/red only for genuine safety warnings, neutral gray for missed/incomplete items, no shame UI, no "failed" language, no red calorie bars for normal variance, no motivational fluff, no clutter, one hero number per screen, large tap targets, fast numeric inputs, smooth cards, premium tabular numerals, mobile-first, with desktop widening into a centered command dashboard (Progress, Health, and Money get wider layouts).

## Navigation — a decision, not an open question

Ten top-level sections (Today · Health · Nutrition · Training · Mind · Money · Relationships · Skills · Progress · Coach) is too many for a bottom tab bar. Recommended default: a 5-item bottom nav — **Today · Log · Coach · Progress · More** — where **Log** opens a sheet/grid linking to Nutrition, Training, Mind, Money, Health, Relationships, and Skills, and **More** holds Settings plus anything else. Today's quick-action buttons still deep-link straight into each domain, so the common paths stay two taps or fewer. Confirm what the current `BottomNav.tsx` already does in Phase 0 before assuming this needs to change — if it already handles overflow well (e.g., a scrollable strip or an existing "more" pattern), adapt this recommendation rather than replacing something that works. Whichever pattern is used, update `BottomNav.tsx` and `sw.js`'s `SHELL_ROUTES` **in the same commit** — the service worker will silently miss new pages if only the nav changes.

The first screen is always the Today dashboard. Never a marketing page.

---

# CORE UX PRINCIPLES

### 1. Speed logging
Every daily log possible in under 30 seconds: quick-add templates, favorites, recents, repeat-yesterday, one-tap completion, numeric keypads (`inputmode="decimal"` — already used correctly in `OnboardingGate.tsx` and `settings/page.tsx`, follow that precedent), large buttons, minimal required fields, optional notes behind expansion, smart defaults. Essentials loggable in under 5 minutes a day.

### 2. Adherence-neutral design
Never shame the user. Use neutral copy: "Not logged yet," "Still open," "Ready when you are," "Next best action," "Recovery day," "Minimum Viable Day available." Avoid: failed, bad, ruined, cheat, lazy, and warning colors for normal missed targets. Red/orange reserved exclusively for: blood pressure crisis, injury red flags, emergency/crisis guidance, serious safety escalation. (See Phase 0's two confirmed violations to fix first — they're the concrete reference for what this rule catches.)

### 3. Explainable scores
Every score is tappable: Forge Score, Health Score, Readiness, Relationship Score, Money Score — show components, points earned, points possible, explanation, penalties, what to do next. `ScoreRing.tsx` already does this for Forge Score — reuse that exact pattern for every new score rather than inventing a new one per domain.

### 4. Minimum Viable Day
The app supports hard days. Default MVD: log one meal + complete the daily check-in. User-customizable. Perfection is measured by scores; consistency is measured by streaks. Keep them conceptually and visually separate.

---

# ONBOARDING

Skippable with sensible defaults (the existing single-screen, skip-to-defaults pattern in `OnboardingGate.tsx` already works well — extend it, or split into a short multi-step flow only if the single screen gets genuinely too dense; operator's call if Phase 0 finds it's already crowded).

Collect: name, age, sex, height, weight, goal weight, primary goal, secondary goals, activity level, training experience, equipment, dietary preference, dietary restrictions, sleep target, water target, budget goal, daily spending limit, relationship status, social goals, health concerns, injuries, medications/supplements (optional), bloodwork (optional), blood-pressure-tracking preference, fitness-markers preference, general tracking preferences, domain enable/disable (so someone who doesn't want a Relationships tab can turn it off — this then drives Forge Score renormalization), and Minimum Viable Day definition.

Goal options: gain muscle · lose fat · recomposition · maintain · improve health markers · improve blood pressure · improve strength · improve cardio fitness · improve sleep · reduce stress · improve relationship · improve dating life · build friendships · improve finances · build discipline · learn skills · general reset.

---

# DATA MODEL

Strict, centralized TypeScript types in `lib/types.ts`, added alongside the existing 373 lines (0.1) — not a rewrite.

New/expanded types: `UserGoal`, `FoodItem`, `Recipe`, `WorkoutPlan`, `Exercise` (tagged per the Training section), `InjuryProfile` (generalizes `PainFlags` — body area, diagnosis if known, symptoms, pain score, aggravating movements, relieving movements, medical restrictions, onset date, professional care received, notes), `InjuryModification`, `HealthMarker`, `BloodPressureEntry`, `BloodworkReport`, `Biomarker`, `BudgetReview`, `RelationshipCheckIn`, `ConflictDebrief`, `PersonalityAssessment`, `CompatibilityReport`, `SocialGoal`, `SkillTrack`, `StreakState`, `ExpenditureEstimate`, `ForgeScoreBreakdown`, `HealthScoreBreakdown`.

Already exist and stay as-is: `UserProfile` (extended per Onboarding), `DailyLog`, `MealEntry`, `WorkoutEntry`, `ExerciseSet`, `JournalEntry`, `SpendingEntry`, `SkillTask`, `AIReview`, `WeeklySummary`, `BodyMetric`.

Persistence: all reads/writes through `StorageAdapter` (already true). Add schema versioning + a `migrate()` function in `localStorageAdapter.ts` **before** any v2 type lands — every phase after this one changes the data shape, so version the schema first or risk corrupting real users' data on upgrade. Write migration tests proving today's actual data shape survives untouched. Add JSON export/import in Settings (currently missing — Settings has profile editing and a full reset, but no way to back up or move data).

---

# ENGINE FUNCTIONS

Pure logic in `/lib/engine`, one file per domain (the existing convention — `forgeScore.ts`, `mockCoach.ts`, `trainingRules.ts`, `nutritionRules.ts`, `trends.ts`, `bodyRules.ts`, `weeklySummary.ts`, `coachContext.ts`, `dailySync.ts`, `plan.ts` — keep following it).

**Already implemented, confirmed correct:** `calculateForgeScore`, `calculateMacroTotals`, `generateMockAIFeedback`, `computePersonalRecords`/workout-completion logic, `getPainAwareWorkoutAdjustment`, `calculateSpendingBreakdown`, `calculateWeightTrend` (the raw-delta version — keep it as the fallback path).

**Net new:** `calculateNutritionAdherence`, `estimateExpenditure`, `runWeeklyCheckIn` (new `expenditure.ts`, alongside `trends.ts`'s new smoothed-trend function — see Nutrition section), `calculateHealthMarkerTrend`, `categorizeBloodPressure`, `parseBloodworkInput`, `summarizeBiomarkers`, `calculateHealthScore` (new `healthRules.ts`); `generateInjuryModification` (extends `trainingRules.ts`); `generateRelationshipPrompt`, `generateConflictRepairSuggestion`, `calculateCompatibilityInsights`, `calculateRelationshipInsights` (new `relationshipRules.ts`); `detectPatterns` (new `lifeGraph.ts` — see LifeGraph section); `updateStreak` with MVD/freeze/earn-back/weekly-mode logic (new `streaks.ts`, generalizing `skills/page.tsx`'s existing `streakFor()`); `calculateSafeToSpend` (extends money logic); `calculateReadinessScore`.

**Minimum test coverage** (matching the rigor of the existing suite — never regress it): Forge Score weights/disabled-domain renormalization/penalties/partial credit (extend existing tests) · expenditure engine calibrating state, data-quality guards, recalibration math · streak engine MVD/freezes/earn-back/weekly streaks · BP categories and crisis flow (every AHA boundary) · injury modification and red-flag escalation · mock coach rules (extend existing tests, don't replace) · storage migration · relationship prompt generation · spending breakdown (extend existing tests) · bloodwork parser basics.

---

# TODAY DASHBOARD

Answers: "Am I on track today, and what's my next best action?"

Cards: Forge Score (reuse the existing `ScoreRing.tsx` pattern) · streak flame · Minimum Viable Day status · calories · protein · hydration · workout/movement · steps · sleep · blood pressure (if enabled) · resting heart rate (if enabled) · mood/stress · relationship/social check-in · spending check · skill progress · AI daily recommendation.

Quick actions: Add Meal · Start Workout · Log Health Marker · Log Blood Pressure · Journal · Log Spending · Relationship Check-In · Skill Task · Get AI Feedback.

Everything important reachable in two taps or fewer. Fix the `workoutStatus === "skipped"` danger-tone bug (0.1) while touching this file.

---

# FORGE SCORE

Default weights: nutrition adherence 15 · protein 15 · hydration 10 · movement/training 15 · recovery/sleep 10 · health-marker check-in 5 · mental reset 10 · spending check 10 · relationship/social check-in 5 · skill progress 5. User-visible and adjustable; renormalize to 100 when a domain is disabled (this is why domain enable/disable belongs in onboarding). Extend `forgeScore.ts` and its test suite — don't replace either.

Caution modifiers (configurable, neutral-toned): severe pain · very high stress · very poor sleep · blood pressure in concerning range · major unnecessary spending over limit · unresolved relationship conflict · doctor-directed task skipped.

---

# HEALTH TAB (new)

## Bloodwork input and AI review
Manual entry, copy/paste parser, and a PDF/image-upload placeholder (mock parser is fine for MVP — real extraction is future work). Each biomarker: name, value, unit, reference range, lab flag, lab date, notes, trend vs. previous.

Seed dictionary: CBC (WBC, RBC, hemoglobin, hematocrit, platelets, neutrophils, lymphocytes) · CMP (glucose, BUN, creatinine, eGFR, sodium, potassium, chloride, CO2, calcium, albumin, total protein, bilirubin, AST, ALT, ALP) · lipids (total cholesterol, LDL, HDL, triglycerides, ApoB, Lp(a)) · glucose metabolism (fasting glucose, A1c, fasting insulin) · thyroid (TSH, free T4, free T3, antibodies) · iron (ferritin, iron, TIBC, transferrin saturation) · vitamins (D, B12, folate) · inflammation (hs-CRP, ESR) · hormones (total/free testosterone, SHBG, estradiol, DHEA-S, cortisol).

AI review must: compare against the lab's own ranges, identify in/out-of-range markers, explain what markers generally relate to, identify patterns worth discussing with a clinician, suggest lifestyle areas to review, generate doctor-visit questions, state uncertainty clearly, avoid diagnosis, avoid medication changes, avoid disease claims.

## Blood pressure tracker
Fields: systolic, diastolic, pulse, time, body position, cuff location, caffeine/exercise/stress context, notes.

Categories (AHA): normal <120 and <80 · elevated 120–129 and <80 · stage 1 130–139 or 80–89 · stage 2 ≥140 or ≥90 · crisis >180 and/or >120.

Crisis behavior: urgent warning; if chest pain, shortness of breath, back pain, numbness, weakness, vision changes, or trouble speaking accompany it, instruct emergency care immediately. Never diagnose hypertension. Encourage proper measurement technique and clinician confirmation.

## Fitness markers
Weight, trend weight, waist, body-fat estimate, resting heart rate, HRV, sleep duration/quality, steps, cardio minutes, zone-2 minutes, VO2max estimate, grip strength, push-up test, plank time, one-mile time, mobility, pain, energy, soreness.

## Health Score
Configurable educational composite: movement, sleep, weight/waist, blood pressure, glucose markers, lipid markers, nutrition quality, nicotine avoidance, recovery markers. Explainable via the `ScoreRing.tsx` pattern. Never diagnostic.

Add "Health" to `BottomNav.tsx`/nav sheet and `sw.js`'s `SHELL_ROUTES` in the same commit as this phase.

---

# NUTRITION TAB

Supports all goals: gain muscle · lose fat · recomp · maintain · performance · general health · biomarker improvement.

Features (mostly already present — 0.1): calorie/protein/carb/fat/fiber/water targets, macro rings, meal planner, grocery list, saved meals, recipe builder, custom foods, quick-add foods, meal-prep mode, repeat-yesterday, favorites, recents, "Still Need Today" card (already good copy in `getNutritionRecommendation()` — match that register for new suggestions), diet-preference-aware suggestions (net new — `mealPlan.ts` is currently one fixed rotation, add filtering/variants).

**Flagship feature: Adaptive Expenditure Engine.** Estimate real-world energy expenditure over time from logged calories + smoothed trend weight over rolling 14–21 day windows, with data-quality guards and weekly recalibration. Use the static formula only while calibrating (first 2–3 weeks, or whenever data quality guards fail), with a plain-language "calibrating — N more days" state. Show: trend weight, estimated expenditure, target adjustment, and *why* it changed, in copy matching the existing suggestion voice. Implementation note from 0.1: add `calculateSmoothedWeightTrend` to `trends.ts` under a new name (don't replace `calculateWeightTrend`, which stays as the fallback), and add `estimateExpenditure`/`runWeeklyCheckIn` in a new `expenditure.ts`.

Fix the nutrition banner warning-tone bug (0.1) while in this file.

---

# TRAINING TAB

Universal, not hardcoded to one injury profile or one split.

Build: workout builder, workout logger (exists, keep — `ExerciseCard.tsx`/`RestTimer.tsx`/`SwapSheet.tsx`/`HeatMap.tsx` are all solid per 0.1), exercise library, injury-aware modifications, progression engine, workout history, PR tracker (exists), weekly volume (exists), muscle-group heat map (exists).

Workout builder inputs: goal, days/week, session length, equipment, experience, injuries, movement restrictions, liked/disliked exercises, sport/activity needs. This is entirely net-new — `workoutPlan.ts` today is one fixed seeded split.

Exercise library tags: muscle groups, equipment, movement pattern, difficulty, unilateral/bilateral, push/pull/squat/hinge/carry/core, cardio/mobility/prehab, injury-caution tags, substitution options. Add these tags to `ExerciseDef` entries in `workoutPlan.ts` so the builder has something to filter on.

Logger: sets, reps, weight, RPE, rest timer, notes, pain rating per set, completed state, exercise swap, next target — all exist, extend as needed.

Injury-aware engine: user can input any injury or limitation via the new `InjuryProfile`; a guided intake asks clarifying questions; suggests safer substitutions, warm-ups, mobility, commonly-used strengthening work, and load modifications; explains *why* each swap is suggested; never claims to treat or heal; never replaces a clinician/PT/AT. Generalize `generateInjuryModification` from the existing `getPainAwareWorkoutAdjustment` in `trainingRules.ts` rather than writing a parallel system — the existing pain-load-scaling math (7→15%, 8→20%, 9+→25%) is correct and should keep working for the specific thoracic/rib/scapular case it currently covers, now as one instance of the general engine.

Red flags (always "seek medical evaluation," never train through): sudden severe pain, numbness, weakness, loss of bowel/bladder control, chest pain, shortness of breath, unexplained swelling, fever with joint pain, major trauma, progressive neurologic symptoms.

---

# MIND TAB

Existing and correct: daily mood/stress/anxiety/anger/energy check-in, sleep quality, trigger, thought dump, what-I-can-control, what-I-need-to-release, gratitude, boundary practiced, 10-minute reset, 60-second breathing timer, pause-before-reacting card, sleep wind-down. Keep all of this as-is.

Net new: CBT-style thought record + reframing prompts, pattern detection (recurring triggers surfaced over time from existing `JournalEntry` history — feed this into the LifeGraph engine below rather than building a separate detector).

AI should identify repeating triggers, suggest coping tools and reflection prompts, suggest professional support when appropriate — never diagnose, never label other people, never act as crisis care. Confirm the section's copy matches the mental-health disclaimer verbatim (Safety Requirements below) rather than assuming the existing careful phrasing already covers it.

---

# MONEY TAB

Existing and correct, keep as-is: daily spending log (necessary/unnecessary, business/personal, stress-purchase flag, category, note — already <30s to log), weekly budget review (income expected, bills due, food budget, debt payment, business budget, emergency buffer, one thing to cut, one thing to sell/liquidate).

Net new: recurring expenses, debt list, savings goals, emergency fund, cash-flow view, safe-to-spend number, category caps, recurring-expense review, stress-spending pattern detection (feed into LifeGraph).

AI should identify stress-spending patterns, suggest spending limits, suggest review questions, help users see cash-flow risk — never provide professional financial, tax, legal, or investment advice.

---

# RELATIONSHIPS TAB (new)

Relationship fitness and human connection — explicitly not a dating app.

Modes: single/dating · in a relationship · married/long-term · complicated · family focus · friendship focus · social confidence.

Daily check-in: relationship type, connection 1–10, communication 1–10, conflict yes/no, repair attempt yes/no, appreciation expressed yes/no, boundary respected yes/no, feeling heard 1–10, feeling safe 1–10, note.

Prompt decks: getting to know · emotional intimacy · conflict repair · values · money · family · intimacy for adults · future planning · appreciation · apology · boundaries · friendship building · family connection.

Conflict debrief: what happened, what I felt, what I needed, what they may have needed, what I did well, what I did poorly, repair attempt, boundary needed, next calm message. AI output: neutral summary, pattern identification, repair language, calm-message draft, pause-before-responding suggestion, boundary suggestion — never diagnose the other person, never label someone (narcissist/borderline/etc.), never encourage unsafe reconciliation when abuse indicators exist.

Assessments (optional): Big Five, attachment style, love languages, conflict style, communication style, values ranking, lifestyle compatibility, financial style, social energy, emotional regulation style. Couples answer separately, see similarities/differences/discussion prompts/friction points — never a deterministic compatible/incompatible verdict. Dating: clarify valued traits, better prompts, red/green-flag reflection, post-date reflection. Friendship: outreach + follow-up tracking, activity suggestions, conversation starters. Family: difficult-topic tracking, boundary planner, repair planner, appreciation prompts, recurring check-ins.

Micro-lessons: active listening, repair attempts, validation, boundaries, secure communication, apologizing, raising hard topics, respectful disagreement, noticing patterns without blame, communication differences without stereotyping, intentional dating, friendship maintenance, family boundaries. Include inclusive, non-stereotyped tips for men, women, and everyone.

---

# SOCIAL CONNECTION

First-class lifestyle category: friendship goals, weekly outreach goal (weekly streak mode, see Streaks), social calendar, interest-based activity ideas, post-event reflection, reach-out nudges, loneliness/self-isolation pattern detection (feed into LifeGraph), low-pressure outreach suggestions.

---

# SKILLS TAB

Configurable tracks. Existing: finance, emotional regulation, functional movement. Add: nutrition basics, communication, sleep optimization, career/business, social confidence.

Each track: 30-day curriculum, daily 10–20 minute task, weekly milestone, notes, XP, streak (via the new `lib/engine/streaks.ts`, replacing the page-local `streakFor()`), AI feedback, optional book checklist.

---

# STREAK SYSTEM

Build `lib/engine/streaks.ts` as the generalized, persisted version of `skills/page.tsx`'s existing `streakFor()` — same underlying consecutive-day-walk idea, now backed by a `StreakState` type through `StorageAdapter`, covering skills, the app-wide daily streak, and weekly-mode habits.

Features: MVD streak, streak freezes (hold up to 2, auto-consumed on a miss, earned at 7-day milestones — not free/infinite), earn-back repair (2 consecutive MVDs within 48h of a break restores it), weekly streaks for workouts/social outreach (3-of-7 counts, so travel/illness doesn't wipe months of consistency), milestones at 7/14/21/30 days with a shareable card, neutral/warm comeback flow.

Rules: MVD counts consistency, Forge Score counts quality — don't conflate them. Never punish hard days. Never shame missed days. Warm recovery language always.

---

# PROGRESS TAB

Charts (Recharts, existing dark theme): Forge Score (exists), Health Score (new), weight raw + trend, estimated expenditure/TDEE, calories/protein (exist), BP, resting HR, HRV, sleep, workouts (exist), PRs (exist), steps/cardio, spending (exists), mood/stress (exists), relationship connection, social outreach, skills (exists), pain (exists), energy.

Include: 30-day calendar (exists, extend states as needed), weekly report (exists, extend), trend summaries, doctor-ready health export, print stylesheet, JSON export/import (net new — see Data Model), AI weekly review.

---

# COACH TAB

The AI Coach is the core differentiator. It analyzes nutrition, workouts, health markers, blood pressure, bloodwork, sleep, recovery, injuries, pain, mood, stress, spending, relationships, social connection, skills, journal notes, and weekly trends.

Daily AI output structure — **extends** the existing 8-part `CoachReview` with two new fields rather than replacing it (append `healthAdjustment` and `relationshipSocialAdjustment`; existing consumers of the 8-field shape keep working):
1. Score explanation
2. What went well
3. What slipped
4. One health adjustment *(new)*
5. One nutrition adjustment
6. One training adjustment
7. One money adjustment
8. One mental adjustment
9. One relationship/social adjustment *(new)*
10. Tomorrow's #1 priority

Tone: calm, direct, premium, honest, encouraging, nonjudgmental, not cheesy, no diagnosis, no fearmongering, no fake certainty — the existing `mockCoach.ts` already nails this register; match it exactly for new rules rather than introducing a different voice.

**Live route:** extend `app/api/coach/route.ts` in place (0.1 confirmed it's already correct) — grow `REVIEW_SCHEMA` and `SYSTEM_PROMPT` together for the two new fields and new guardrails, keep `thinking: { type: "adaptive" }` and `output_config.format` as they are, keep the model on `claude-opus-4-8` (verified GA-correct, appropriate for a consumer coaching feature; `claude-sonnet-5` is a reasonable cheaper fallback to offer as a config option if cost becomes a concern, but don't default to it without being asked). Server-side key only. Structured JSON day summary + 7-day trend summary. Defensive parsing. Mock fallback on any error — this behavior already exists, preserve it.

**Research mode** (new, optional, live-AI only): credible sources only (official medical organizations, peer-reviewed research, clinical guidelines), cites sources, separates evidence from speculation, states uncertainty, never presents research as diagnosis or a treatment plan. New `/api/research` route, same server-side-key-only discipline as `/api/coach`.

**Mock engine** (extend `mockCoach.ts`, don't replace — must keep working with zero API key): existing rules (protein short >30g → named add-on; calories short >400 → calorie-dense suggestion; weight-trend-flat → weekly-check-in-style adjustment; pain >6 → lower intensity + modifications; stress >7 → breathing reset + journal; unnecessary spend over limit → next-day cap; skill missed two days → 10-minute minimum) all stay. Add: repeated elevated BP → track context + discuss with clinician; BP crisis → urgent warning; conflict without repair → calm repair attempt; social isolation high → one low-pressure outreach.

---

# LIFEGRAPH / PATTERN ENGINE

A named, deliberately deterministic cross-domain pattern detector — this is a real differentiator, but it must stay honest about what it is: simple co-occurrence counting over the user's own logged history, not statistical inference or ML, and it must never claim more certainty than that.

**Implementation approach:** for a defined set of domain-pair flags (e.g., "high stress day" = stress ≥7, "elevated spend day" = unnecessary spend > limit), count how often flag B is true on days flag A was also true (or the day after, for lagged effects like sleep→next-day BP) over the trailing 30 days, against a minimum sample-size guard (e.g., require at least 5 qualifying days before surfacing anything — small samples produce false patterns and that's worse than showing nothing). Surface only pairs crossing a co-occurrence threshold (e.g., ≥60%), phrased as "possible pattern," never as causation.

Examples to seed: high stress + poor sleep → higher spending · relationship conflict → skipped workouts · low protein → worse hunger/mood · poor sleep → higher BP readings the next day · pain flare → lower movement + higher stress · missed planning → worse nutrition · social isolation → lower mood · caffeine + stress → elevated BP context · late logging → lower adherence.

MVP: deterministic pattern detection from 7-day and 30-day logs, "possible pattern" language, avoid certainty, recommend one next experiment. Example: "Possible pattern: your highest spending days happened after low sleep and high stress. Tomorrow, use the pause check before purchases over your set limit." Build as `lib/engine/lifeGraph.ts`, feeding off the same domain data everything else already logs — no new tracking surfaces required to power it.

---

# SAFETY REQUIREMENTS

The app never claims to: diagnose medical conditions, treat/cure/prevent disease, replace a physician/therapist/emergency care/dietitian/financial advisor/lawyer, guarantee injury recovery, guarantee relationship success.

The app may: summarize user data, flag values worth discussing with a professional, suggest general wellness habits, suggest safer training modifications, encourage professional evaluation, help prepare questions for professionals, provide educational information, provide communication tools, provide budgeting awareness.

**Required disclaimers (verbatim, persistent in each section):**

Health/bloodwork: *"Forge30 provides educational wellness insights only. It does not diagnose, treat, cure, or prevent disease. Always consult a qualified healthcare professional for interpretation of bloodwork, symptoms, medications, injuries, or medical concerns."*

Mental health: *"Forge30 supports reflection and habit-building. It is not therapy, crisis care, or diagnosis. If you are in danger or may harm yourself or someone else, contact emergency services or a crisis hotline immediately."*

Relationships: *"Forge30 provides relationship education and communication tools. It does not determine whether a relationship is safe, abusive, compatible, or worth continuing. If there is violence, coercion, threats, stalking, or fear, seek professional/legal/domestic violence support."*

Finance: *"Forge30 provides budgeting and spending awareness tools. It is not professional financial, tax, legal, or investment advice."*

Verify the Mind tab's existing copy against the mental-health disclaimer verbatim rather than assuming it already matches (0.1 found the spirit is right but didn't confirm the exact text is present).

---

# BUILD PHASES

Execute in order after Phase 0 is approved. Every phase ends with: typecheck clean → tests pass (count should only grow, never shrink) → build passes → subagent diff review against this spec, explicitly checking the adherence-neutral rule → gaps fixed → commit with a descriptive message.

**Phase 1 — Foundation hardening.** Fix the two confirmed Phase-1 bugs (0.1: skipped-workout danger tone, nutrition banner warning tone). Add schema versioning + `migrate()` to `localStorageAdapter.ts`. Add migration tests proving today's real data survives. Add JSON export/import to Settings. This phase touches no new features — everything after it depends on this being solid first.

**Phase 2 — PWA/iOS verification.** 0.1 found this essentially complete. Device-verify on a real iPhone: standalone launch, safe-area rendering, offline shell, no input-zoom, correct icons. Fix anything that fails; otherwise this is a checklist, not a build.

**Phase 3 — Onboarding and universal profile.** Replace personal-specific defaults in `lib/data/defaults.ts`. Expand `OnboardingGate.tsx` per the Onboarding section. Add domain enable/disable. Add MVD configuration. Generalize `PainFlags` toward `InjuryProfile` (keep `PainFlags` working as a compatible view for the existing training engine).

**Phase 4 — Adaptive nutrition engine.** `calculateSmoothedWeightTrend` in `trends.ts`, `estimateExpenditure`/`runWeeklyCheckIn` in new `expenditure.ts`. Wire into Nutrition and Progress. Tests for calibrating state, data-quality guards, recalibration math.

**Phase 5 — Streaks, Forge Score, adherence-neutral sweep.** Build `lib/engine/streaks.ts`; migrate `skills/page.tsx` and `coachContext.ts`'s ad hoc `skillMissedTwoDays` onto it. Add app-wide daily streak + flame on Today. Configurable Forge Score weights with renormalization. Full neutral-copy sweep across the app (not just the two confirmed bugs — check everything touched by this phase).

**Phase 6 — Health tab.** New types, `healthRules.ts`, BP tracker + AHA categories + crisis flow, fitness markers, Health Score (via `ScoreRing.tsx`'s pattern), bloodwork manual entry + paste parser + AI review scaffolding, doctor-ready export foundation. Update nav + `sw.js` routes in the same commit.

**Phase 7 — Training upgrade.** Exercise library tagging, workout builder, `InjuryProfile` intake + `generateInjuryModification` (generalizing the existing pain engine), red-flag escalation, logger speed pass.

**Phase 8 — Mind and Relationships.** Thought record + reframing in Mind (feed pattern detection through LifeGraph, don't build a separate detector). Full Relationships tab: check-in, prompt decks, conflict debrief, assessments, social connection tools. Verify all four disclaimers are present verbatim. Update nav + `sw.js` routes.

**Phase 9 — Money, Skills, Progress.** Recurring expenses, debt, savings, emergency fund, safe-to-spend. Additional skill tracks. Remaining Progress charts, weekly reports, print/export flows.

**Phase 10 — Coach and LifeGraph.** Extend `mockCoach.ts` and `app/api/coach/route.ts` (grow schema/prompt, don't rewrite) for the two new output fields and new domain rules. Build `/api/research`. Build `lib/engine/lifeGraph.ts` with the co-occurrence approach above, minimum sample-size guard included from day one.

**Phase 11 — Final polish.** Empty states, loading states, accessibility pass, Lighthouse, README updates (every new section, new nav pattern, expanded onboarding, AI setup, iOS install), Vercel deploy config check, final full-repo review against this spec.

**Phase 12 — Monetization architecture (optional; do not execute unless explicitly requested).** See Subscription Tiers below.

---

# SUBSCRIPTION TIERS (architecture only — Phase 12, optional)

Do not implement payments unless explicitly approved. Design the architecture — feature flags — so subscriptions can be added later without a rearchitecture. Never gate core safety features behind payment (crisis language, red-flag escalation, and the four required disclaimers are always free, at every tier).

- **Free:** basic logging, Today dashboard, limited history, basic Forge Score, basic workouts, basic spending, basic journal, limited AI reviews.
- **Plus:** unlimited history, advanced charts, custom plans, daily AI reviews, saved meals/workouts, export/import.
- **Pro:** bloodwork AI, injury-aware training intelligence, adaptive nutrition, advanced money tools, relationship tools, PDF exports.
- **Max:** unlimited deep AI reviews, research mode, document parsing, voice/photo logging placeholders, wearable integration placeholders, LifeGraph correlations.
- **Household:** multi-user, couples/family dashboards, shared goals, relationship prompts, household budget.

Feature flags: `free` · `plus` · `pro` · `max` · `household`. If this phase is executed, it's flag-gating existing features, not building new product surface — keep it that way.

---

# ACCEPTANCE CRITERIA

Forge30 v2 is ready when a user can: open the app installed full-screen on iPhone · understand what to do today immediately · configure the app for their own goals · log essentials quickly · track nutrition, training, health, money, mind, relationships, social, and skills · receive adaptive calorie targets from real data · keep consistency through imperfect days · enter blood pressure and receive safe category feedback · input bloodwork and receive educational insights · build workouts around goals, equipment, and injuries · get injury-aware exercise swaps with explanations · track spending and safe-to-spend · debrief conflict and draft calm repair language · improve friendships/social outreach · complete daily skill tasks · tap any score and understand it · export their data · see an occasional honest "possible pattern" surfaced from their own history · receive AI feedback that connects multiple domains into one clear plan for tomorrow.

---

# QUALITY BAR

No lorem ipsum. No broken links. No generic dashboards. No clutter. No shame UI. No unexplained scores. No personal-specific defaults. No diagnosis. No unsafe relationship advice. No financial/legal/tax/investment advice. No hardcoded one-user injury/workout/diet assumptions. No direct `localStorage` calls outside `StorageAdapter`. No scoring math inside UI components. No phase complete without verification. No regression of whatever the test count and clean build are at the start of the phase — check, don't assume.

Build Forge30 v2 like a product people would actually keep on their home screen. The current build already clears that bar for what it covers — v2 widens what it covers without losing what already works.
