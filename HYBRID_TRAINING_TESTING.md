# HYBRID_TRAINING_TESTING.md — test inventory + QA

## How to run

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint . (flat config)
npm test            # Vitest — full suite (count only ever grows)
npm run build       # production build (generates sw.js via prebuild)
```

All four are the per-phase gate and run in CI (`.github/workflows/ci.yml`).

## Automated coverage (Vitest)

`lib/engine/hybridTraining.test.ts` — 31 tests:
- **Program data integrity:** 7-day structure (10/6/9/7/10 slots), unique catalog ids,
  every slot resolves, every exercise carries explanation/steps/cues/mistakes, every
  substitution carries the six required fields, the spec'd substitution lists exist
  (bench 5, deadlift 6, front squat 5, clean pull 5, knee raise 5), mobility library is 19
  drills across 4 categories, boxing ships 4 types + the 2:1/3:1/30:30 presets.
- **Readiness:** green (pain 0–2), yellow (pain 3–4, short sleep, low energy, soreness),
  orange (pain 5–6, warm-up worsening), red (pain 7+, any neuro symptom) with
  medical-safety guidance; **custom thresholds honored**; yellow reduces sets 20–30% and
  caps RPE 7; orange is recovery-only; red stops.
- **Periodization:** 4-week RPE ramp 6–7 → 8–9, deload −45% volume / −15% intensity;
  cycle wrap; null start pins week 1; 5/6/8-week extensions with deload last; repeat-week
  runs a template week twice and extends the calendar cycle.
- **Progression:** kind classification (explosive flag > pure strength > double); double
  progression adds load only at top-of-range with reps in reserve; strength backs off
  after two RPE ≥ 9 sessions and adds load on a rising e1RM at RPE ≤ 8; explosive is
  always quality-first; baseline prompt with no history; rep-range parsing; Epley e1RM.
- **Substitutions:** equipment filtering, session-sub > remembered-sub > original
  resolution.
- **Schedules + emphasis:** 3/4/5/6-day maps (Sunday always recovery), date → day
  resolution, trap-dominance guard suppresses neck/trap emphasis with an explanation.
- **Session state:** plannedSets combines band × meso × manual adjustment (clamped ≥ 1);
  sessionToWorkoutEntry freezes substitutions (`swappedFromId`), excludes warm-ups,
  carries max pain, pain-flags, stop-reasons, and accepted AI modifications into the note.

`lib/engine/hybridExport.test.ts` — 8 tests: CSV export covers every slot + mobility drill
with the 18 spec'd columns (RFC-4180 quoting); JSON export shape; **export → import round
trip**; import validation (missing columns by name, per-line errors with line numbers,
quoted commas/escaped quotes, empty/oversized/row-capped files).

`lib/storage/localStorageAdapter.test.ts` — 5 hybrid tests: settings default + partial
merge; readiness per-date persistence; boxing/mobility upsert + delete; **in-flight
session survives adapter re-instantiation (refresh) and clears**; hybrid collections ride
`exportAll`/`importAll`.

Suite total at HT-4: **488 tests** (444 before the feature).

## Runtime verification (Playwright, production build)

Scripted run (`verify-hybrid.mjs`, 27/27 passing) against `npm start`:
enable flow → dashboard; readiness check-in (sliders, region chips, yellow at pain 3);
yellow adjustments on the dashboard; execution mode (band chip, RPE cap, explosive slot
dropped); set logging with rest timer; **hard refresh resumes the session mid-set**;
substitution applied + remembered into settings after finish; WorkoutEntry saved with
`hybrid-` id; boxing timer runs and logs; mobility drill logged; **neuro symptom forces
red** → safety card, start hidden; **no horizontal overflow at 320/375/390/430 px**.

## Manual QA checklist (operator, physical iPhone)

- [ ] Readiness sliders and region chips comfortable at 320 px; inputs don't zoom (16 px).
- [ ] Rest timer visible above the dock during a real set; ±30 s works.
- [ ] Round-timer audio cue audible with the ringer on; note vibration is a no-op on iOS.
- [ ] Background the PWA mid-round → timer lands on the correct phase on return.
- [ ] Finish a session → Training tab heat map and PRs include the hybrid session.
- [ ] Settings → Data export includes `hybridSettings` etc.; import restores them.
- [ ] Red check-in copy renders on the dark safety surface in both themes.

## Not covered by automation (by design)

- Real audio/vibration output (host-dependent); Supabase sync round-trip (operator WAIT —
  needs provisioning, see docs/QA.md); admin editor (deferred — HYBRID_TRAINING_SCHEMA.md).
