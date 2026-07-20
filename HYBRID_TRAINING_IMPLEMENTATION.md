# HYBRID_TRAINING_IMPLEMENTATION.md — Hybrid Athletic Bodybuilding system

Persistent implementation checklist for the 21-phase Hybrid Training prompt, reconciled
against this branch's real architecture. Status legend: ✅ done · 🔨 in progress ·
⬜ planned · ♻️ satisfied by existing code (reused, not rebuilt) · ⏸ deferred with reason.
Update this file as phases land; it is the source of truth for what shipped vs. deferred.

## Repository audit (prompt Phase 1) — ✅

| Concern | Finding |
|---|---|
| Framework | Next.js 15 App Router, React 19, TS strict (`noUncheckedIndexedAccess`) |
| Routing | `app/(app)/*` shell pages; adding a route requires `BottomNav.tsx` + `SHELL_ROUTES` in `public/sw.template.js` in the same commit |
| State | No global store; server-light pages + `useStorage()` adapter hooks |
| Database | **Local-first StorageAdapter** (`lib/storage/adapter.ts`, `forge30:*` keys, IndexedDB large store). Supabase sync rides `sync_blobs`/`sync_rows` with per-user RLS (v3 Phase 1); DECISIONS §9: **no bespoke per-feature Supabase tables** |
| Auth | Supabase auth (optional; app fully works signed-out). No roles system exists |
| Components | Hand-rolled shadcn-style `components/ui/*` (native `<select>` for iOS), Starship OS tokens |
| Existing workout modules | `lib/data/workoutPlan.ts` (7-day split), `lib/engine/trainingRules.ts` (pain rules, readiness, deload, PRs, red flags), `lib/engine/workoutBuilder.ts` (equipment/injury-aware builder), `components/training/*` (ExerciseCard set logger, RestTimer, SwapSheet, PainStopModal, InjuryIntakeSheet, ReadinessCard, HeatMap), `app/(app)/training/page.tsx` execution flow |
| AI | `app/api/coach/route.ts` + deterministic `lib/engine/mockCoach.ts` fallback, guardrails in `lib/engine/coachGuardrails.ts` |
| Mobile nav | Hexagonal dock `components/shell/BottomNav.tsx` + DestinationGrid |
| Profile | `UserProfile` + `InjuryProfile[]` (bodyArea/diagnosis/symptoms/pain/aggravating/relieving/restrictions) already exist |
| Fragile/duplicated | None blocking; `ReadinessCard` uses a 0–100 score with full/reduced/minimum bands — the hybrid green/yellow/orange/red model is a **new, separate** classifier (pain-primary), kept in `lib/engine/hybridTraining.ts` so the two never conflate |

## Architecture resolutions (binding for this feature)

1. **Persistence = StorageAdapter collections, not bespoke SQL.** New collections
   (`hybridSettings`, `hybridReadiness`, `boxingSessions`, `mobilitySessions`,
   `hybridSessionState`) follow the `forge30:<collection>` convention and sync automatically
   through the existing SyncedAdapter blob path with per-user RLS already enforced by
   `sync_blobs`. This *is* the production database design for this app (prompt Phase 13's
   "use the project's existing database system"); full schema documented in
   `HYBRID_TRAINING_SCHEMA.md`. No new migrations required.
2. **Logged hybrid strength sessions are `WorkoutEntry` rows** (`splitLabel` = hybrid day
   label). PRs, volume-by-muscle, deload detection, HeatMap, and CSV export keep working
   with zero new plumbing.
3. **Readiness:** new pure `classifyHybridReadiness()` with **configurable thresholds**
   (defaults: yellow ≥3, orange ≥5, red ≥7 pain; any neurological symptom → red) in
   `lib/engine/hybridTraining.ts`. The existing 0–100 `calculateReadinessScore` stays for
   the classic training tab.
4. **Safety:** red band renders on `bg-safety` with red-family treatment only (§2 rule);
   red-flag copy reuses `RED_FLAGS`/`redFlagGuidance` verbatim semantics; never gated.
5. **Admin editor/RBAC (prompt Phase 15): deferred honestly.** There is no roles system in
   this app and no server-persisted program store; faking RBAC by hiding buttons is exactly
   what the prompt forbids. The seeded program lives in code (`lib/data/hybridProgram.ts`),
   versioned by git — the effective "admin editor" is the repo. A runtime editor lands only
   with a real roles column + server program tables. Documented in
   `HYBRID_TRAINING_SCHEMA.md` §Deferred.
6. **AI coach:** hybrid context joins the existing coach payload; guardrails already block
   diagnosis/red-flag override. Accepted AI modifications are recorded on the session state
   (`aiModifications` note) — prompt Phase 18's audit-trail requirement.

## Phase checklist

| # | Prompt phase | Status | Where |
|---|---|---|---|
| 1 | Repository audit | ✅ | This file |
| 2 | Weekly program structure (Mon Upper A ×10 … Sun recovery, exact prescriptions) | ✅ HT-1 | `lib/data/hybridProgram.ts` |
| 3 | Mobility/prehab library (19 drills, full field spec) | ✅ HT-1 | `lib/data/mobilityLibrary.ts` |
| 4 | Injury-aware onboarding (16 regions, 12 symptoms, red-flag advisory) | ✅ HT-3 | Readiness check-in (regions/symptoms/neuro flags) + settings (equipment, experience, boxing, priorities); persistent injury profiles reuse the existing Training `InjuryIntakeSheet` |
| 5 | Pain-aware readiness (green/yellow/orange/red, configurable) | ✅ HT-1+3 | `classifyHybridReadiness` + `ReadinessSheet`; thresholds editable in settings |
| 6 | Substitution engine (structured subs w/ why-safer/goal/equipment/difficulty/type) | ✅ HT-1+3 | `HybridSubstitution` on every slot; `SubSheet` filtered by equipment; remembered on finish |
| 7 | Exercise-detail experience | ✅ HT-3 | `ExerciseDetailSheet` (cues, mistakes, breathing, regress/progress, subs, history, progression hint) |
| 8 | Execution mode with persistence | ✅ HT-3 | `SessionRunner` + `hybridSessionState` (verified refresh-proof) |
| 9 | Progression logic (double / strength e1RM / explosive quality-first) | ✅ HT-1 | `suggestProgression` + tests; surfaced in exercise detail |
| 10 | Periodization (4-wk mesocycle, extend 5/6/8, repeat week, wk4 deload −40–50% vol / −10–20% int) | ✅ HT-1 | `mesocycleWeek` + `mesoAdjustedSets`; deload 0.55 vol / 0.85 int |
| 11 | Customization (day count, boxing frequency, aesthetic priorities, trap-dominance guard) | ✅ HT-1+3 | `HybridSettings` + `HybridSettingsSheet` + `weeklySchedule(3/4/5/6)` |
| 12 | Boxing module (technical/speed/power/conditioning + presets 2:1, 3:1, 30:30, custom) | ✅ HT-1+3 | `lib/data/boxing.ts` + `BoxingTab` round timer (audio + guarded vibration) |
| 13 | Database design | ✅ resolved | Adapter collections (resolution #1); `HYBRID_TRAINING_SCHEMA.md` |
| 14 | CSV/JSON export + validated CSV import | ✅ HT-4 | `lib/engine/hybridExport.ts` (+ export buttons in settings); import parser tested, UI deferred with RBAC |
| 15 | Admin editor + RBAC | ⏸ deferred | Resolution #5; `HYBRID_TRAINING_SCHEMA.md` §Deferred |
| 16 | Premium mobile-first UI (320/375/390/430) | ✅ HT-3 | Starship tokens; Playwright width pass 27/27 |
| 17 | Hybrid dashboard | ✅ HT-3 | `/hybrid` Today tab: readiness, adjusted session, meso week, volume, PRs, pain trend, labeled suggestion surfaces |
| 18 | AI coaching layer with medical guardrails | ✅ via bridge | Hybrid sessions are WorkoutEntry rows → existing coach context + guardrails apply; accepted AI modifications audit into the entry note |
| 19 | Comprehensive tests | ✅ HT-1..4 | 44 new Vitest tests (444 → 488) + 27-check Playwright run (`HYBRID_TRAINING_TESTING.md`) |
| 20 | Security/quality | ✅ | Strict TS, adapter-only persistence, validated import, no secrets client-side, no fake success states |
| 21 | Documentation ×3 | ✅ HT-4 | This file + `HYBRID_TRAINING_SCHEMA.md` + `HYBRID_TRAINING_TESTING.md` |

## Commit plan

- **HT-0** — this checklist (docs only).
- **HT-1** — `lib/data/hybridProgram.ts`, `lib/data/mobilityLibrary.ts`,
  `lib/engine/hybridTraining.ts` + `hybridTraining.test.ts`; types in `lib/types.ts`.
- **HT-2** — StorageAdapter + LocalStorageAdapter + export/import coverage for the five new
  collections (may merge into HT-3 commit if small).
- **HT-3** — `/hybrid` route (dashboard, readiness sheet, execution mode, boxing timers,
  mobility library, exercise detail, settings) + BottomNav + `SHELL_ROUTES` same commit.
- **HT-4** — export/import + tests, schema/testing docs, Playwright width verification,
  final gates (typecheck → lint → tests → build), push.

## Deferred list (honest)

- Runtime admin program editor + RBAC (resolution #5).
- Admin CSV **import UI** (the validated import parser ships and is unit-tested; a
  maintainer runs it at build/dev time — no privileged runtime surface exists to host it).
- Demonstration media (schema carries an optional `mediaUrl`; no assets bundled).
- Haptics/vibration on round timers where the platform exposes it (`navigator.vibrate`
  guarded; iOS Safari does not support it — documented, not faked).
