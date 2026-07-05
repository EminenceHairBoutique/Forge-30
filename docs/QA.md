# QA.md — per-phase device/operator checklist (v3)

Items here need a real device, a live backend, or operator-owned keys — they cannot be
verified in the build sandbox. Each phase appends its list; nothing ships as "done" on the
strength of this file alone.

## Standing (from v2/Solaris — still open)
- [ ] WAIT(device): installed-PWA pass on a physical iPhone — glass performance (60fps scroll
      with nav + sheet open), safe areas, focus brackets via keyboard, reduced-motion,
      AA spot-checks, new splash/icon palette.

## Phase 0
- (no device items — cuts + docs only)

## Phase 1 — cloud sync (WAIT: operator env)
- [ ] Create the Supabase project + run 0001_core.sql; fill env per docs/AUTH_SETUP.md.
- [ ] Sign in on device A (magic link) → confirm the one-time backup completes; sign in on
      device B → the full 30 days reproduce (spec acceptance).
- [ ] Airplane mode on A → log a meal + a journal note → reconnect → both appear on B.
- [ ] RLS spot-check: querying sync_blobs with a second user's JWT returns zero rows.
- [ ] Signed-out first-run remains byte-for-byte the local experience (no auth prompt
      anywhere except the quiet Settings/Progress cards).

## Phase 2 — web push (WAIT: operator env + devices)
- [ ] Generate VAPID keys (`npx web-push generate-vapid-keys`), set env, run 0002_push.sql,
      confirm the Vercel cron (vercel.json, every 15 min) fires with CRON_SECRET.
- [ ] Installed iOS PWA (16.4+): enable background push from Settings → receive a morning
      brief; confirm no permission prompt ever appears in a Safari tab (install card shows
      instead).
- [ ] Android/desktop Chrome: subscribe → receive evening close when a day is incomplete.
- [ ] Double-fire the cron manually → notification_log unique key sends nothing twice.
- [ ] Fully log a day → zero pushes that day; set quiet hours to now → silence.

## Phase 3 — Capacitor/HealthKit (WAIT: device + Xcode)
- [ ] `npm run build:native` with a real NEXT_PUBLIC_API_ORIGIN completes and `npx cap sync
      ios` ingests out-native/.
- [ ] Verify @perfood/capacitor-healthkit maintenance status; install + bridge-match per
      docs/NATIVE_BUILD.md.
- [ ] On-device: grant permissions → steps/sleep chips appear in Daily check without typing;
      deny permissions → sheet is plain manual entry, zero error states.
- [ ] Manual entry beats detected values everywhere (type a number, chip never overwrites).
- [ ] Web build: the healthkit chunk exists as a lazy asset but is never fetched on the
      web — confirm via DevTools Network that no healthkit chunk loads on any page (the
      dynamic import sits behind the Capacitor bridge check).

## Phase 4 — nutrition (WAIT: AI key + device)
- [ ] With ANTHROPIC_API_KEY set: photo → confirmed meal in under 15 seconds on a real
      iPhone (spec acceptance); low-confidence photo shows the plain "search may be more
      accurate" banner.
- [ ] Kill the network → previously-used foods still appear instantly in Search (recents
      cache); a failed vision call lands on "Try another photo / Search instead" — no dead end.
- [ ] Capacitor build: barcode scan (plugin pinned per lib/barcode.ts bridge) → OFF lookup →
      prefilled custom form. Web: no barcode button.
- [ ] Adaptive target suggestion appears ONLY inside the Sunday review, caps at ±150 kcal,
      and changes the profile target only on explicit accept.

## Phase 5 — Coach 2.0 (WAIT: AI key)
- [ ] With ANTHROPIC_API_KEY (+ optional COACH_MODEL): live review returns 3–6 adaptive
      sections; scoreExplanation opens by closing yesterday's loop; Sunday returns weeklyArc.
- [ ] Old stored 8-part reviews still render (legacy field map) next to new adaptive ones.
- [ ] Pattern shown on the Patterns card does not re-surface within 7 days; the coach can
      still reference it (context ≠ surfacing).
- [ ] Coaching Style retake visibly shifts the live coach's register (directness/structure).

## Phase 6 — Protocols (WAIT: device + operator)
- [ ] Real iPhone: dose log round-trip <5s from open to logged (spec acceptance).
- [ ] WebAuthn lock: enable with Face ID/Touch ID, relock on reload, unlock ceremony works.
- [ ] Local-only mode with a live Supabase project: log doses → confirm sync_blobs/sync_rows
      contain zero protocol collections (integration acceptance).
- [ ] Server push never names compounds on a lock screen (in-app reminder verified discreet;
      server-side protocol reminders are deliberately not implemented — privacy-first).
- [ ] Doctor report prints correctly from iOS Safari (print → PDF).

## Phase 7 — subscriptions (WAIT: operator Stripe account)
- [ ] Run 0004_subscriptions.sql; create Stripe products/prices; set env incl. price ids.
- [ ] `stripe listen --forward-to /api/stripe/webhook` → checkout with a test card →
      subscriptions row lands with tier/status/period; cancel → tier returns to free with
      data intact (non-destructive downgrade).
- [ ] 7-day trial starts at checkout; trialing status grants Pro.
- [ ] Free account: 4th photo analysis in a month returns the friendly 402 and the sheet
      shows the upgrade path; search/manual keep working.
- [ ] Elite account: coach responses come from the opus model (check response metadata).
- [ ] Unconfigured build: zero purchase UI anywhere (regression-checked in CI Playwright).

## v3.3 Phase 1 — rate limiting, validation, hygiene (2026-07-05)

Shipped and covered by tests: fixed-window daily limits on /api/coach (10 free / 40 pro /
80 elite), /api/nutrition/photo (+20/day burst atop the monthly quota), /api/protocols/labimport
(20/day) and /api/research (Elite, 10/day); the ALLOW_UNMETERED hard guard (a Supabase-less
deployment with an API key resolves anonymous callers to FREE tier unless the operator opts
in); request validation on coach/photo/labimport/push bodies (64 KB JSON cap, image caps,
unknown-key rejection); cross-origin pin on API routes (native shell origins allow-listed);
security headers + CSP; SW version stamped per build with the opt-in update toast; account
deletion endpoint; error boundaries; ESLint flat config + CI.

WAIT(operator):
- Create the `rate_limits` table (supabase/migrations/0005_rate_limits.sql).
- Decide ALLOW_UNMETERED for any personal deployment (docs in .env.example).
- After first deploy: confirm CSP report console is quiet on iOS Safari + Chrome, then keep
  the enforced policy (documented in next.config.ts).
- Verify the update toast on an installed PWA across one deploy.
- Account deletion end-to-end against a real Supabase project (needs auth.admin).

## v3.3 Phase 2 — UX polish (2026-07-05)

Shipped: full-width drag ScaleSlider (native range input, big readout, 1/5/10 ticks,
aria-valuetext, "not set" state) replacing tap-number rows on Mind, Relationships, Social,
BodyMetric, and the injury intake pain scale; Money empty state one-liner (philosophy is
footer-only); coach mode tabs gained a right-edge fade + active-tab scrollIntoView; Progress
reordered report → patterns → trends → calendar, with the calendar collapsed to a ≤96px
heat-strip (expands to the tappable grid + legend); "Trauma-Response & Coping Profile"
renamed "Stress Response Patterns" (display-only; DECISIONS §12); dimmed text lifted to
≥4.5:1 (placeholders, timeline stamps, ring sublabel); recharts now loads behind a lazy
client import with dimension-matched skeletons (/progress first-load 325 kB → 216 kB);
Day-1 "0 isn't a grade" line on onboarding's last step + under the gauge until the first
logged item; §2.9 flag rule documented in lib/flags.ts (flag-off = hidden; the Health
bloodwork/wearables "soon" chips are the one sanctioned marketing treatment) and
photoMeal now truthfully `true` with the AddMeal photo tab gated on it.

iPhone-width screenshots (Mind, Money, Today, Progress) captured in session scratchpad
during the Playwright pass; regenerate any time with verify-v33-phase2.mjs.

WAIT(device) — VoiceOver spot-check list:
- ScaleSlider: swipe up/down adjusts value; "Not set" then "N of 10" announced.
- ScoreRing: role=img label announces score + "tap for breakdown".
- Progress heat-strip: "Expand the 30-day calendar" then per-day labels in the grid.
- Coach tabs: selected state announced; horizontal scroll reachable.

## v3.3 Phase 3 — personalization, programs, export, media (2026-07-05)

Shipped: §3.1 onboarding gains schedule (days/week, minutes/session), sleep quality, and a
program picker suggested from the answers (every field consumed: schedule + program →
builder defaults; sleep quality → coach context + mock framing; diet/equipment/experience
were already consumed by the builder and targets). §3.2 programs — First 30 / Comeback 30 /
Busy 30 over pure engines (suggestProgram, programBuilderDefaults, quickAddFirst), Settings
switch affects future days only (non-destructive by test). §3.3 CSV export (days, meals,
workouts-per-set, spending, body) + include-media toggle on the JSON export; all free
(DECISIONS §13). §3.4 progress photos relocated to IndexedDB (one-time idempotent migration,
never synced), voice notes prefer opus @96kbps with a 30-second-left countdown, voice sync
is opt-in ("Sync voice recordings"), media usage surfaced in Settings.

WAIT(device): record a full 3:00 note on iOS Safari and confirm ≲3 MB on disk (the
mediaUsage line in Settings shows it) and playback works; verify photo relocation on a
device carrying pre-v3.3 embedded photos.

## v3.3 Phase 4 — AI flag flips (2026-07-05)

Flags are now env-derived (NEXT_PUBLIC_FLAG_*, current values as defaults, fail-closed) so
flips are ops. Flags off → zero UI change from Phase 3 (verified: photoMeal default-true is
the only visible surface; every other route degrades to its non-AI path). Each AI write path
has a human review step:
- photoMeal (already shipped): editable line items, low-confidence deflection to search.
- transcription (dark): /api/journal/transcribe ships the full pipeline but returns 501 until
  an STT provider is wired (DECISIONS §14); the review textarea + "Use as caption" flow is in
  VoiceNoteSheet behind the flag; the note always saves/plays without it.
- bloodworkUpload (dark, Pro): /api/health/labs transcribes a report photo into the
  BloodworkSheet review list; every value is editable inline before saving; paste + manual
  stay free.
- lifeGraphAI (dark, Pro): /api/lifegraph/narrate (haiku micro-copy) narrates the
  deterministic pattern lines only, under LIFEGRAPH_NARRATE_RAIL (no new patterns, no
  causation); deterministic patterns stay free-visible; any failure is silent.
- researchLive / research route: now Elite + rate-limited even while flagged off.

Guardrail suite green: PROTOCOL_COACH_RAIL + LIFEGRAPH_NARRATE_RAIL pinned; flags env test
covers true/1/other + default-on-turned-off.

WAIT(operator): provision an STT provider to flip transcription; live-key runs of
/api/health/labs and /api/lifegraph/narrate; decide which flags go on per environment.
