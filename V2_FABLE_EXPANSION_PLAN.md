# V2_FABLE_EXPANSION_PLAN.md — Forge30 expansion build order

Maps the Fable expansion mandate onto this repo. Companions: `v2_spec.md` (base v2 spec),
`AUDIT.md` (verified v1 audit), `V2_PLAN.md` (base v2 phases — still valid; this plan extends
it and re-sequences where the mandate adds scope), `CLAUDE.md` (rules).

**State at time of writing:** Phases 0–1 shipped (audit docs; schema versioning + migrate() +
export/import + adherence fixes — 51 tests). Phase 2 hardening shipped alongside this plan:
the seven live-build findings fixed, in-progress/final score states in the engine, and the
5-item nav shell (Today · Log · Coach · Progress · More) — 58 tests. Baseline: typecheck
clean · 58/58 · build green.

Every chunk gates the same way: typecheck → tests (count only grows) → build → subagent diff
review vs spec (adherence-neutral + safety-copy checks explicit) → fix → one descriptive
commit. Engines stay pure and tested; persistence stays behind `StorageAdapter`; new routes
update `BottomNav.tsx` + `sw.js` `SHELL_ROUTES` + `VERSION` together.

## Disposition legend

- **NOW** — implement fully in the named chunk.
- **FLAG** — build the surface behind a feature flag with clean types + mock data; ships dark.
- **WAIT(x)** — blocked on a real dependency: `backend` (Supabase), `ai-key` (live API),
  `payments` (Stripe), `legal` (recording/counsel review), `device` (physical-iPhone QA).

## Dependency chains (decide-once facts)

- **Payments chain:** entitlements (NOW, local) → Supabase **auth** + wiring `SupabaseAdapter`
  (WAIT backend) → Stripe web checkout (WAIT payments). As a web-distributed PWA, Stripe
  checkout avoids Apple IAP commission entirely; a future Capacitor/App Store build would
  require IAP + revenue share — **tradeoff documented here, not decided silently.**
- **Storage chain:** journals, assessment banks, and audio will blow past localStorage's ~5MB.
  **E1's IndexedDB adapter lands before any of those collections exist** (same
  `StorageAdapter` interface, per-collection routing, keyed migration from localStorage,
  feature-detected fallback). Everything heavy afterward depends on it.
- **AI chain:** every AI feature has a deterministic mock that works with zero key (existing
  pattern); live enhancement rides the existing `/api/coach` discipline. `/api/research` is
  the only new server surface (WAIT ai-key to be useful; route + fail-closed state NOW in E10).
- **Consent chain:** journal→AI/assessments/LifeGraph usage is default-OFF, granular, with a
  per-entry private flag that overrides everything (E6). Assessments and LifeGraph read
  journal data only through the consent gate — build the gate before the readers.

## Build order

### E1 — Infrastructure trio: IndexedDB · entitlements · safety copy
The three foundations everything else calls. **NOW.**
- `lib/storage/indexedDbAdapter.ts`: implements `StorageAdapter`; a routing wrapper sends
  large collections (journal bodies, audio blobs, assessment banks/results) to IndexedDB and
  keeps small hot ones in localStorage; keyed migration (schema step + fixture tests, per the
  Phase-1 migration contract); `canUseIndexedDb()` detection with localStorage fallback.
- `lib/engine/entitlements.ts`: `Tier = free|plus|pro|max|household`, feature→tier map,
  `hasFeature()`; tier persisted via adapter; dev tier-switcher in Settings behind a flag;
  paywall/upgrade card components (premium treatment, no dark patterns). **Crisis + safety
  surfaces are free at every tier, permanently** — encoded as a test, not a comment.
- `lib/engine/safetyCopy.ts`: the four verbatim disclaimers as exported constants; forbidden-
  output list (no diagnosis, no disorder labels for self or others, no "this proves abuse",
  no treatment/medication/legal/investment advice, no covert-recording encouragement, no
  shame copy); required-register helpers ("possible pattern", "not a diagnosis", confidence
  labels). Tests assert coach/assessment/relationship outputs route through it.
- `lib/flags.ts`: single flag registry (see Flag registry below).
- Acceptance: adapters interchangeable behind the interface; migration fixture survives;
  entitlement tests prove safety surfaces ungated. Risks: IndexedDB async + private-mode
  quirks → adapter integration tests with a fake IDB; routing wrapper must never split one
  collection across stores.

### E2 — Daily ritual architecture (Morning Plan · Evening Review · Hard Day · Plan Tomorrow)
Builds directly on the Phase-2 `scoreState` work. **NOW.**
- Morning Plan: first-open-of-day view (15s): today's plan (`getDailyPlan`), MVD reminder,
  one focus, streak status. Evening Review: at the boundary, score finalizes with count-up +
  ring sweep, coach review generates, tomorrow's #1 set (this is where `inProgress → final`
  resolves). Hard Day mode: one tap → targets collapse to MVD, 60-second reset surfaced,
  coach tone switches to recovery framing — zero guilt copy (safetyCopy-tested). Plan
  Tomorrow: pick workout, pre-log intended meals, spending intention → feeds Morning Plan.
- Files: `lib/engine/dayPhase.ts` (pure open-state logic), Today page sections,
  `mockCoach.ts` hard-day tone input, `DailyLog.hardDay?: boolean` (+ migration step).
- Motion: count-up/ring sweep, card stagger ≤30ms, spring sheets, `prefers-reduced-motion`
  respected everywhere, nothing >400ms; `navigator.vibrate` on log-success where supported.
- Acceptance: ritual flows reachable from Today; hard-day never reduces streak or shames.

### E3 — Streaks, MVD, celebrations (V2_PLAN Phase 5, unchanged scope)
**NOW.** `lib/engine/streaks.ts` (MVD default meal+check-in, 2 freezes earned at 7-day
milestones, 48h earn-back, weekly 3-of-7 mode, persisted `StreakState`), migrate
`skills/page.tsx` `streakFor()` + `coachContext.skillMissedTwoDays`, flame by the hero ring,
milestone celebration card at 7/14/21/30 (shareable, user-initiated), warm comeback flow.
Configurable Forge Score weights + renormalization (extend `forgeScore.ts`; zero regressions
to its 19 tests). Tests: freeze order, earn-back edges, weekly mode, renormalization.

### E4 — Adaptive Expenditure Engine (V2_PLAN Phase 4, unchanged scope)
**NOW.** `calculateSmoothedWeightTrend` (EWMA, alongside the raw fallback),
`estimateExpenditure` (14–21-day windows), `runWeeklyCheckIn` (plain-language target moves),
calibrating state, data-quality guards; wire into Nutrition (trend + weekly check-in card),
Progress (TDEE chart), `coachContext`. Protein-anchor recommendations ride the same PR.
Tests: calibration threshold, partial-day guard, recalibration math, EWMA on noisy fixtures.

### E5 — Onboarding & universal profile (V2_PLAN Phase 3 + mandate deltas)
**NOW.** Multi-step, skippable-per-step; universal fields + goal menu + domain enable/disable
(drives score renormalization from E3) + MVD definition + notification preferences (for E9);
de-personalized defaults (`defaults.ts`); `InjuryProfile` type alongside `PainFlags` (derived
view; flip in E8-T). Migration step + fixtures.

### E6 — Journal system + consent architecture + Mind upgrades
**NOW**, on top of E1's IndexedDB. Free-write + structured tags, search/filter, weekly
reflection, MVD-eligible; CBT thought record + reframing; consent: global default-off toggle
(granular per consumer: coach / assessments / LifeGraph), per-entry private flag that always
wins, full export+delete, attribution line on every journal-informed output. Voice journal
via `MediaRecorder` (NOW, audio in IndexedDB); transcription **FLAG(ai-key)**. AI journal
summary: mock = tag/theme counts (deterministic), live = enhancement. Tests: consent gating
(the critical ones), tag extraction, private-flag exclusion.

### E7 — Health tab (V2_PLAN Phase 6, unchanged scope + timeline)
**NOW.** `healthRules.ts` (AHA categories every-boundary-tested, crisis flow + emergency-
symptom escalation, bloodwork paste parser + seed dictionary, `calculateHealthScore`
explainable via the ScoreRing pattern), BP/fitness-marker logging, health timeline,
appointment-question generator, doctor-ready print export, verbatim health disclaimer.
PDF/photo bloodwork upload **FLAG(ai-key)**; HealthKit/wearables **FLAG(backend)** placeholders.
Nav: flip the Log-sheet "Health — coming soon" slot live (+`SHELL_ROUTES` already lists it).

### E8-T — Training upgrade (V2_PLAN Phase 7 + mandate deltas)
**NOW.** Exercise library tagging, workout builder, `InjuryProfile` intake +
`generateInjuryModification` (generalizing the existing pain engine — its math and the
warm-up gate stay), red-flag escalation (always "seek medical evaluation"), readiness-based
adjustment, **Minimum Viable Workout** (pairs with Hard Day mode), deload suggestions, RIR
alongside RPE, experience modes. Logger speed pass; `ExerciseCard`/`RestTimer`/`SwapSheet`/
`HeatMap`/`PainStopModal` untouched.

### E9 — Push notifications + PWA polish
Split disposition: client permission flow, per-type toggles in Settings, SW `push`/
`notificationclick` handlers, and in-app scheduled fallbacks **NOW**; actual Web Push sending
**WAIT(backend)** (needs a push server + VAPID keys — scaffold `lib/push/` with the
subscription plumbing behind a flag). Notification types: morning plan, evening review,
streak-protection ("your freeze will cover today — or 2 minutes keeps the streak alive"),
weekly report. No shame copy, ever (safetyCopy-tested). Physical-iPhone verification of the
whole shell remains **WAIT(device)** — checklist in every phase summary.

### E10 — Assessments / self-insight system (the flagship; Pro-gated via E1)
Staged inside one architecture: `lib/engine/assessments/` — definitions, question banks,
scoring (+reverse-scoring), **branching/adaptive selection**, progress save/resume, retake
scheduling + test-retest comparison, and the **validity system** (attention checks,
reverse-coded consistency, social-desirability/acquiescence/idealization indicators,
contradiction + response-time signals → a disclosed **confidence score, never an
accusation**). All results route through `safetyCopy.ts`; every result screen carries the
mental-health disclaimer + professional-referral pathway; no covert or disorder-detecting
framing anywhere (this is also the App Store/liability requirement).
- Wave 1 **NOW**: engine + Big Five + values ranking + conflict/communication/attachment
  styles (self-report, deterministic scoring).
- Wave 2 **NOW after wave 1**: EQ profile (incl. cognitive-vs-affective empathy as an
  educational insight), trauma-response & coping profile (educational register), remaining
  style assessments.
- Wave 3: cognitive skills profile as real timed mini-games (pattern recognition, working
  memory, verbal/logical reasoning, attention) — labeled "not a formal IQ test"; premium
  motion treatment. **NOW**, sized as its own chunk.
- Wave 4: transparent Personality Patterns screening (trait-level, confidence-scored,
  "when a licensed evaluation is worth pursuing" pathway) — copy reviewed against
  `safetyCopy.ts` line by line. **NOW**, last of the catalog.
- **Overall Psyche Report** (3+ assessments → unified narrative + growth plan feeding
  Skills): mock = deterministic template over scored traits **NOW**; live-AI narrative
  **FLAG(ai-key)**. Journal cross-reference only through the E6 consent gate.
- Tests: scoring, reverse scoring, branching, validity flags, confidence computation,
  consent gating, safety-copy routing.

### E11 — Relationship Clarity + Relationships tab (V2_PLAN Phase 8 + mandate deltas)
**NOW:** modes, daily check-in, prompt decks, conflict debrief, micro-lessons, couples
assessments reuse the E10 engine (similarities/differences/discussion prompts — never
verdicts); **text-thread analysis** with manual paste + redaction helper + incident tagging +
**timeline/documentation builder with dated export** (standard DV-support practice, private);
pattern vocabulary as deterministic heuristics (invalidation, contempt, stonewalling, DARVO-
like sequence, guilt-tripping, coercive-control indicators, love-bomb/devalue cycle, boundary
violations — **and the healthy side:** repair attempts, accountability, validation). Locked
register from the mandate; abuse-indicator inputs escalate to safety resources (free at every
tier). Live-AI enhancement of the heuristics **FLAG(ai-key)**. Screenshot OCR (tesseract.js
is ~2–4MB wasm — decide at implementation; default **FLAG(legal+size)**), consensual-recording
mode **WAIT(legal)** (scaffold with consent reminder + jurisdiction notice only), real-time
analysis **WAIT(legal)**. Verify all four disclaimers verbatim across tabs in this chunk.

### E12 — Social connection + Skills expansion
**NOW.** Social: friendship goals, outreach tracker (weekly streak mode from E3), reconnect
list, weekly challenge, post-event reflection, loneliness pattern → LifeGraph. Skills: new
tracks (nutrition basics, communication, sleep, career/business, social confidence,
discipline, learning-how-to-learn); assessment results (E10) feed track recommendations.
Nav: flip "Social"/"Assessments" More-sheet slots live.

### E13 — Money upgrades (V2_PLAN Phase 9 money scope + mandate deltas)
**NOW.** Recurring expenses, bills, debts, savings goals, emergency fund, safe-to-spend,
cash-flow view, category caps, **impulse-spending 24-hour pause** (pairs with the LifeGraph
stress-spending pattern), export. Existing <30s log + Sunday review untouched.

### E14 — LifeGraph engine
**NOW.** `lib/engine/lifeGraph.ts`: deterministic co-occurrence over 7/30-day windows,
≥5-qualifying-day guard, ≥60% threshold, lag support; consent-gated journal themes as one
input among many; locked cautious language + one suggested experiment. Surfaced in exactly
three places: Today Patterns card, weekly report, Coach pattern-review mode. AI narration
**FLAG(ai-key)**. Tests: guard (4 days → nothing), thresholds, lag pairs, determinism.

### E15 — Coach expansion + research mode (V2_PLAN Phase 10 superset)
**NOW:** mode architecture over the existing route/mock pair (Daily Review with
inProgress/final framing ✅ shipped in Phase 2; add Weekly Review, Tomorrow Plan, Hard Day,
Relationship Debrief, Training/Nutrition/Money adjustments, Journal Reflection (consent-
gated), Pattern Review) — every mode works via deterministic mock with zero key; grow
`REVIEW_SCHEMA` + `SYSTEM_PROMPT` together per mode; keep model `claude-opus-4-8`.
`/api/research`: route + fail-closed no-key state **NOW**; useful behavior **WAIT(ai-key)**
(credible sources, citations, uncertainty, never diagnosis/treatment).

### E16 — Payments (LAST; entitlements from E1 make everything gateable meanwhile)
**WAIT(backend → payments):** Supabase auth → implement `SupabaseAdapter` against the
existing interface (sync = the real product reason, not just billing) → Stripe web checkout →
tier assignment from subscription state. Household tier needs multi-user data — explicitly
after Supabase. Keep the PWA/Stripe vs App Store/IAP tradeoff decision with the operator.

## Flag registry (single source: `lib/flags.ts`)

`transcription` · `bloodworkUpload` · `wearables` · `photoMeal` · `barcode` · `ocrThreads` ·
`consensualRecording` (legal) · `realtimeAnalysis` (legal) · `pushServer` · `researchLive` ·
`psycheReportLive` · `lifeGraphAI` · `devTierSwitcher` · `lightMode` (deferred unless trivial
after token consolidation).

## Standing risks

1. **Scope discipline** — every chunk is one reviewable commit; nothing half-lands outside a
   flag. 2. **Safety copy drift** — all sensitive output routes through `safetyCopy.ts`;
   reviewer checks it every chunk. 3. **Storage growth** — IndexedDB first (E1); audio and
   assessment banks never touch localStorage. 4. **Mock/live divergence** — one shared type
   per AI mode; mock is the contract. 5. **Migration debt** — every persisted-shape change =
   numbered step + fixture test (Phase-1 contract). 6. **Device QA gap** — no physical iPhone
   in this environment; every phase summary carries the manual checklist (standalone launch,
   safe areas, offline, no input zoom, push permission UX when E9 lands).
