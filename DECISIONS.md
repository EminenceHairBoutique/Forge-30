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

## 14. Transcription route ships fail-closed (v3.3 Phase 4)

`/api/journal/transcribe` ships the full pipeline (Pro gate, rate limit, validation, and the
client's review-before-save flow behind FLAG(transcription)) but returns 501 until a
speech-to-text provider is wired. **Rationale:** the Anthropic Messages API this app uses
takes no audio input, so there is no honest transcription path with the current model set;
shipping the plumbing now means flipping the flag + provisioning a provider is the only
remaining step, and the voice note always saves and plays back regardless. The transcript,
when one exists, is always returned as editable text the user approves into the caption —
never an automatic write.

## 15. Starship OS visual overhaul (operator decision + reconciliation, 2026-07-05)

`FORGE30_STARSHIP_OS_IMPLEMENTATION.pdf` as amended by `STARSHIP_RECONCILIATION.md` (the
patch wins on every point it addresses). Reskin only — engine logic and copy untouched.

- **Theme (operator decision):** ship **both light and dark via `[data-theme]`, dark as the
  default**. Rationale: the app has heavy night-usage surfaces (Mind, Journal, in-bed
  protocol dose logging); a blinding health app is a retention risk, so dark leads. Light is
  the bright Starship look behind a Settings toggle. The retired `FLAGS.lightMode` is
  superseded by this real preference (stored `forge30:theme`, device-only, never synced).
- **Palette strategy:** the Solaris warm tokens are repointed onto the Starship violet/cyan
  palette while keeping the SEMANTIC names (`gold`→violet primary, `ember`→deep-violet
  gradient partner, `gold-soft`→light violet, new `cyan` telemetry accent). Every existing
  utility reskins through the tokens — no mass component rewrite.
- **Reconciliation adaptations:** test baseline is **438** (not the patch's 367 — v3.3
  shipped since); work stays on `claude/forge30-pwa-build-2hb416` (not a new `starship-os`
  branch) per the standing push constraint; corrected file paths used
  (`components/health/HealthScoreRing.tsx`, `components/today/Streak*.tsx`); the existing
  `BottomNav`/`DestinationGrid` are **restyled, not rebuilt**; the existing
  `prefersReducedMotion` helper in `lib/utils.ts` is the one motion path. The §2 safety
  dark-alert sweep and byte-identical crisis copy are non-negotiable (S3).
- **Fonts:** Space Grotesk (display), JetBrains Mono (microlabels), Inter (body) via
  `next/font` (self-hosted at build → CSP-safe); Geist stays as fallback.

## 16. Starship §2 safety-color sweep — re-mapping list (S3)

Visual treatment only; every crisis line, hotline number, and disclaimer is byte-identical
(verified by diff + the safetyCopy suite). Safety surfaces render on the neutral cool-dark
`bg-safety` in the **red family only** (`--accent-danger`: `#ff3b5c` dark / `#c1123c` light),
never the violet/cyan brand.

Re-mappings applied:
- `SupportResourcesCard` (self-harm crisis support): `border-gold/50 bg-gold/10 text-gold`
  (brand) → `bg-safety border-danger/40 text-danger` (red-family caution, icon + label).
- `PainStopModal` (sharp-pain protocol): step 1 "Stop the movement" stays `text-danger`
  (the genuine safety imperative); follow-up steps 2–4 dropped `text-gold` → neutral bold
  (no brand color inside a safety surface).
- Already §2-compliant, reskin automatically through the danger/safety tokens (no brand
  leak): BP crisis flow (`BloodPressureSheet`), BP stage chips, injury red-flag cards, the
  four persistent section disclaimers, overspend indicators. `Badge variant="caution"/"danger"`
  is the shared red-family primitive.

## 17. Contrast (WCAG AA) tuning for the light theme + dark violet (S3)

The light inversion is the biggest contrast risk. Computed ratios drove these token nudges so
all text pairs clear 4.5:1 (graphics 3:1):
- Dark violet primary `#7c5cff` → `#8a6dff` (clears 4.5 on elevated surfaces for violet
  microlabels/eyebrows).
- Light violet `#6d4aff` → `#5f3ae8` (4.8 on the bright base); light gold-soft → `#7c5cff`.
- Light danger `#e11d48` → `#c1123c` (5.4 on `bg-safety`); light success `#00998c` →
  `#0a7a68` (5.25 on white); light cyan `#009fc4` → `#0089a8`.
Dark body text (primary 17:1, secondary 6–7:1) and all completion/telemetry accents already
passed.

## 18. Stripe hardening — keep Free/Pro/Elite + API-mediated reads (operator, 2026-07-06)

A "add Stripe from scratch (Free/Plus/Pro)" request arrived against a branch where Stripe was
already ~85% shipped. Operator decisions:
- **Keep tiers Free / Pro / Elite** — no rename. Renaming to Free/Plus/Pro would churn
  `subscription.ts`, `entitlements.ts`, `pricing.ts`, `PaywallSheet`, env names, and 7+ tests
  for cosmetic naming with a data migration. `.env.example` carries a name-map comment so the
  earlier spec's `STRIPE_PLUS_*` / `NEXT_PUBLIC_APP_URL` names are unambiguous.
- **Keep the subscription table API-mediated** — RLS stays enabled with NO user policies
  (service-role/webhook is the sole writer; clients read tier via `GET /api/entitlements`).
  No self-read SELECT policy added; the client never trusts a client-side flag.

**Hardening shipped:** webhook now also handles `customer.subscription.created`,
`invoice.paid`, and `invoice.payment_failed` (→ `past_due`), with an idempotency ledger
(`stripe_events`, migration 0007) that short-circuits Stripe's duplicate deliveries and
un-records on handler failure so retries reprocess. Migration 0006 adds
`billing_interval` / `current_period_start` / `cancel_at_period_end` / `created_at`
(additive; `tier` column unchanged). The Stripe→row mapping is a pure, unit-tested engine
function (`subscriptionPatch`, `subscriptionIdFromInvoice` in `lib/engine/subscription.ts`);
the route stays thin I/O. Full A–J product audit committed as `docs/AUDIT.md`.
