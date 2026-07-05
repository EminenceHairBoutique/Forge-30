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
