# HYBRID_TRAINING_SCHEMA.md — data model

How the Hybrid Athletic Bodybuilding system persists data, and why there are **no new SQL
migrations** (the prompt's Phase 13, resolved against this app's real database architecture).

## The database resolution

Forge30 is local-first: **every user collection persists through `StorageAdapter`**
(`lib/storage/adapter.ts`) into `forge30:*` localStorage blobs (+ IndexedDB for large
records), and cloud sync rides the generic `sync_blobs`/`sync_rows` tables added in v3
Phase 1 — which already carry **per-user RLS** (`user_id = auth.uid()` policies, see
`supabase/migrations/0002_sync.sql`). DECISIONS §9 made this binding: new user collections
do **not** get bespoke Supabase tables; they inherit sync, RLS, offline queueing, and
export/import automatically by registering in the adapter's `KEYS` map.

So the hybrid feature's "database design" is five adapter collections + one reuse:

| Collection | Key | Shape (lib/types.ts) | Notes |
|---|---|---|---|
| `hybridSettings` | `forge30:hybridSettings` | `HybridSettings` | Schedule length, equipment, meso config, **configurable readiness thresholds**, aesthetic priorities + trap guard, remembered substitutions |
| `hybridReadiness` | `forge30:hybridReadiness` | `Record<ISODate, HybridReadinessCheckin>` | One check-in per day; band computed by the engine, stored for trends |
| `boxingSessions` | `forge30:boxingSessions` | `BoxingSessionEntry[]` | Type, rounds planned/completed, work/rest seconds |
| `mobilitySessions` | `forge30:mobilitySessions` | `MobilitySessionEntry[]` | Drill ids + minutes |
| `hybridSessionState` | `forge30:hybridSessionState` | `HybridSessionState \| null` | **The in-flight session.** Persisted on every mutation; refresh/close resumes mid-set; cleared on finish/discard |
| *(reuse)* workouts | `forge30:workouts` | `WorkoutEntry` | Completed hybrid sessions freeze into canonical `WorkoutEntry` rows (`id: hybrid-<date>-<dayId>`, `splitLabel: "Hybrid — …"`) via `sessionToWorkoutEntry()` |

The `WorkoutEntry` reuse is the load-bearing decision: PRs
(`computePersonalRecords`), weekly volume (`weeklyVolumeByMuscle`), deload detection
(`suggestDeload`), the training heat map, workout CSV export, **and the AI coach's daily
review context** all consume `WorkoutEntry` — so hybrid sessions feed every existing
surface with zero new plumbing. Accepted AI modifications and stop-reasons land in the
entry's `note` field (the Phase 18 audit trail).

Seeded content is code, not rows: the program (`lib/data/hybridProgram.ts`), mobility
library (`lib/data/mobilityLibrary.ts`), and boxing sessions (`lib/data/boxing.ts`) are
versioned by git and shipped with the bundle — the "seed data" requirement is satisfied at
build time, offline-safe by construction.

## Security posture

- **RLS / cross-user isolation:** hybrid data syncs only through `sync_blobs`, whose
  existing policies scope every row to `auth.uid()`. There is no hybrid-specific server
  endpoint, so there is no new attack surface; signed-out users' data never leaves the
  device.
- **Input validation:** CSV import (`parseProgramCsv`) is pure and defensive — 512 KB cap,
  500-row cap, required-column checks, per-line typed validation with line-numbered errors,
  length-capped text fields, no dynamic evaluation of imported content.
- **Health-data sensitivity:** readiness check-ins and pain logs are health-adjacent; they
  follow the same posture as the rest of the app (local-first, user-owned export, no
  third-party transmission; Anthropic calls only via existing `app/api/*` guardrailed
  routes).

## Engine surface (pure, tested)

`lib/engine/hybridTraining.ts` — `classifyHybridReadiness` (green/yellow/orange/red,
thresholds configurable, neuro symptoms force red), `readinessAdjustment` /
`adjustedSetCount` (yellow ≈ −25% sets, RPE cap 7, explosive dropped; orange recovery-only;
red stop), `mesocycleWeek` (4/5/6/8-week templates, deload −45% volume / −15% intensity,
repeat-week), `suggestProgression` (double / strength-e1RM / explosive-quality),
`filterSubstitutions`, `weeklySchedule` (3/4/5/6-day), `accessoryEmphasis` (trap guard),
`sessionToWorkoutEntry`, `newSessionState`, `plannedSets`.
`lib/engine/hybridExport.ts` — `programCsv`, `programJson`, `parseProgramCsv`.

## Deferred (honest)

- **Runtime admin program editor + RBAC (prompt Phase 15).** The app has no roles system
  and no server-persisted program store; shipping an "admin" UI gated only by hidden
  buttons is exactly what the prompt forbids. The program is administered through the repo
  (data files, PR review, CI). A real editor requires: a `roles` claim in Supabase auth, a
  `programs` table with author/publish state and RLS distinguishing admin write from user
  read, and server routes enforcing the role — none of which should be faked client-side.
- **Admin CSV import UI.** The validated parser ships and is unit-tested
  (`parseProgramCsv`); wiring it to a privileged screen waits on the roles system above.
- **Demonstration media.** `HybridExercise.mediaUrl` exists in the schema; no assets are
  bundled.
