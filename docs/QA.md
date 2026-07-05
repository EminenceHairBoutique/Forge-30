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
