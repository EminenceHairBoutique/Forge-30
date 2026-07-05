# DECISIONS.md — Forge30 v3 (binding scope decisions, per V3_SPEC §A3)

Decisions recorded here were made in the v3 spec and are not re-litigated. Execution notes
document exactly what was done in this codebase.

## 1. CUT: consensual-recording framework (executed, v3 Phase 0)

**Decision:** remove the `consensualRecording` flag and all related code paths. Rationale:
legal exposure disproportionate to user value.

**Executed:** deleted `components/recording/`, `lib/engine/recordingLaw.ts` (+ tests),
`lib/data/recordingLaw.ts`, `RECORDING_LEGAL_REVIEW.md`, the `Recording` type, the adapter's
`listRecordings`/`saveRecording`/`deleteRecording`, `UserProfile.recordingJurisdiction`, and
the Relationships-page entry + placeholder cards. Migration path (CLAUDE.md rule 6): schema
v2→v3 strips `recordingJurisdiction` from stored profiles; `DROPPED_LARGE_COLLECTIONS`
("recordings") is cleared by the adapter on load and filtered from imports. The journal's
**voice notes** (self-recording with a visible REC badge) are a separate feature and remain.

## 2. CUT: Cluster B trait screening + cognitive/IQ-adjacent testing (executed, v3 Phase 0)

**Decision:** no clinical-adjacent screeners, no intelligence tests. Rationale: liability,
validity problems, no retention value.

**Executed:** deleted `lib/engine/assessments/clusterB.ts` (+ tests),
`ClusterBResultExtras.tsx`, the `COGNITIVE_SKILLS` bank (+ tests), and the timed-task
machinery (`TimedQuestion`, `timedItemScore`, `TimedTaskItem.tsx`) — no remaining consumer;
recoverable from git history if a non-clinical use ever appears. `AssessmentId` dropped
`"clusterB" | "cognitiveSkills"`; stored results of removed assessments are pruned via
`REMOVED_ASSESSMENT_IDS` (adapter load + import). **Kept:** the self-harm support routing
(`supportFlag` on items, `supportTriggered` — now in `scoring.ts` — and
`SupportResourcesCard`), free at every tier; wave-1 and wave-2 assessments (Big Five, values,
conflict, communication, attachment, EQ, trauma-response coping) are unaffected.

**Replacement (shipped):** **Coaching Style & Values**
(`lib/engine/assessments/coachingStyle.ts`) — 13 items, 4 preference dials (directness,
structure, push, evidence style), plainly disclaimed as coach-tuning preferences, never
diagnoses or scores of the person. Feeds coach tone in Phase 5.

**Test-count baseline:** the cuts removed their test files; the suite went 328 → 299 → 301
(with the new coachingStyle + migration tests). CLAUDE.md's "test count only ever grows"
resumes from **301**.

## 3. DEMOTE: seeded 7-day meal plan (executes in v3 Phase 4)

After photo/search logging ships, the seeded plan becomes an optional template under
Settings → "Meal plan templates". The Nutrition tab leads with photo log, search, recents,
quick-adds. The grocery-list generator stays, driven by whichever template is active.

## 4. CHANGE: rigid 8-part daily review → adaptive (executes in v3 Phase 5)

The 8-part structure becomes the *maximum* schema. The coach returns
`{ sections: [{key, text}], tomorrowPriority }` with only the 3–6 sections that earned their
place; `tomorrowPriority` always required; stored 8-part reviews render unchanged.

## 5. v3 baseline branch (operator decision, 2026-07-05)

V3_SPEC's operator instructions assume a checkout from `main` — but `main` is the v1
codebase; all v2 work (29 commits: E1–E15, Phase NEXT, Solaris HUD) lives on
`claude/forge30-pwa-build-2hb416`. **Decision: v3 builds on the current branch.** The spec's
"known-absent" list (Health, Relationships, LifeGraph, streaks, subscriptions architecture)
is stale against this baseline — see AUDIT_V3.md for the reconciled map.

## 6. Coach model default (operator decision, 2026-07-05)

V3_SPEC names `claude-sonnet-4-6`, which is not a valid Anthropic model ID. **Decision:
default `claude-sonnet-5`** (read from `COACH_MODEL`, env-overridable — the spec's cost
intent, a real ID). Micro-copy: `claude-haiku-4-5-20251001`. Vision: `claude-sonnet-5`.
Executes in Phase 5 (coach route) and Phase 2/4 (haiku/vision routes).

## 7. Guardrail-conflict log (V3_SPEC Part D.5)

None so far: no v3 instruction has conflicted with the A2.4 safety guardrails. Entries land
here if one ever does — the guardrail wins.

## 8. Streak repair semantics (v3 Phase 2 parity check, 2026-07-05)

V3_SPEC §2.3 paraphrases repair as "hitting Minimum Viable Day before noon the next day."
The shipped engine (E3, built to the v2 spec §Streaks) uses the v2 earn-back: **2 met days
inside a 48-hour window** — date-granular, no hidden clock, fully tested. Freeze economics
match v3 exactly (1 earned per 7 days, auto-applied, max 2 banked). Since v3 defers to v2
where its own text is a summary, the v2 semantics stand; switching to an hour-granular noon
deadline would add clock state the engine deliberately doesn't keep. Revisit only if the
operator asks for the stricter deadline.

## 9. ADD: one opt-in "Protocols" tab (V3_SPEC Rev 3.1 §A3, executes in v3 Phase 6)

One surface for physician-prescribed TRT, HGH, peptide, and GLP-1 therapy tracking instead of
separate tabs. **The §6.0 compliance rails are part of this decision and are not
negotiable:** prescribed-therapy framing (patient-record language, never
optimization language); the app never recommends, calculates, or adjusts doses — no dose or
reconstitution calculators, no titration, no cycle planners, no stack builders, no compound
suggestions (the only unit math allowed is displaying the mL/IU equivalent of the user's
*entered* dose at their *entered* label concentration); a hard coach blocklist with red-team
fixtures in CI; education stays general and sourced, never personalized into advice;
discretion by default (lock-screen copy never names compounds, biometric lock, local-only
sync mode); hidden entirely unless enabled. Execution notes land here as Phase 6 ships.

**Storage note:** protocol collections ride the generic sync_blobs/sync_rows tables from
0001_core.sql — no new SQL tables are required; local-only mode excludes them from sync at
the adapter layer.

## 10. SEPARATION: Forge30 and Noir Peptides never touch (V3_SPEC Rev 3.1 §A3, permanent)

No links, no promotions, no shared branding, no product mentions, no shared marketing —
in either direction, ever. **Rationale (from the spec):** a therapy-tracking app
cross-promoting a research-use-only peptide retailer creates FDA intended-use evidence
against the retailer and drug-facilitation exposure for the app. Additionally (§6.0.7):
nothing in Forge30 links to any vendor of any compound. This rule survives every future
phase and is grep-gated in the Phase 6 review.

## 11. v3.3 audit remediation adaptations (operator context, 2026-07-05)

`V3_3_PROMPT.md` (Claude + ChatGPT audits, reconciled) is the active remediation prompt.
Three adaptations, logged per its global-acceptance rule:

- **Audit source files not provided.** The prompt says to commit `FORGE30_AUDIT_JUL5.md` and
  `Forge30_Audit.md` alongside it; neither was uploaded. The prompt's inline task text (IDs
  B1–B6, C1–C10, D2–D5, E, F, G woven into Phases 1–5) is self-contained and is the
  executed source of truth. The audit files can be added later without changing scope.
- **Branch.** Work continues on `claude/forge30-pwa-build-2hb416` (the session's binding
  push target) rather than a new `v3.3-audit-fixes` branch.
- **Baseline.** The prompt cites `e142800` · 367 tests; the actual baseline is `1ad949b`
  (the Rev 3.1 review-fix commit, two HIGH rail fixes included) · **369 tests**. The
  only-grows floor for v3.3 is 369.

## 12. RENAME: "Trauma-Response & Coping Profile" → "Stress Response Patterns" (v3.3 C7)

Display name only; the stored assessment id stays `traumaCoping`, so previously saved
results render under the new name with zero migration. **Rationale (Claude audit C7):**
"trauma" in a product surface reads clinical and gatekeeps the people most likely to
benefit; "Stress Response Patterns" describes the same content — learned protective
patterns, named without judgment — in the register the rest of the app uses. Content,
items, scoring, and the not-a-diagnosis/PTSD safety framing are unchanged.

## 13. Export is never paywalled (v3.3 §3.3 vs §5 conflict, resolved)

V3_3_PROMPT §3.3 gates the JSON full export on Elite, while its own Phase 5 lists
"export/delete-data controls" as never-paywalled (per both audits) — and the free JSON
backup/restore has shipped since v1. Regressing a shipped data-portability control violates
the standing guardrail rule, so **all exports stay free at every tier**: the versioned JSON
envelope (with the new include-media toggle) and all five per-collection CSVs. The Elite
anchor list loses nothing users already owned.
