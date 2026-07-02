# CLAUDE.md — Forge30

Forge30 is an installable, offline-first PWA (dark-only, mobile-first): a personal operating
system connecting nutrition, training, mind, money, skills — and, in v2, health and
relationships — into one daily loop. **Read `v2_spec.md` before any large change** (its §0.1 is
a verified audit of this codebase). `AUDIT.md` is the Phase 0 audit; `V2_PLAN.md` maps the spec
onto this repo phase by phase.

## Stack & commands

Next.js 15 App Router · React 19 · TypeScript strict (`noUncheckedIndexedAccess`) ·
Tailwind v4 · Recharts · Vitest · `@anthropic-ai/sdk` (server-side only). Package manager:
**npm** (lockfile committed). Node 18.18+ (dev on 22).

```bash
npm run dev          # dev server on :3000
npm run build        # production build — must stay green
npm start            # serve production build (service worker active)
npm run typecheck    # tsc --noEmit — must stay clean
npm test             # Vitest; test count only ever grows (36 at v2 start — check, don't guess)
npm run lint
npm run icons        # regenerate public/icons/ from scripts/generate-icons.mjs
```

Every phase gates on: typecheck clean → tests pass → build passes, all three, every time.

## Architecture rules (non-negotiable)

1. **All persistence goes through `StorageAdapter`** (`lib/storage/adapter.ts`). Components
   never call `localStorage` — currently zero direct calls exist outside
   `lib/storage/localStorageAdapter.ts`; keep it that way. Keys follow the `forge30:<collection>`
   convention in the adapter's `KEYS` map. Access from React via `useStorage()`
   (`lib/storage/provider.tsx`). `supabaseAdapter.ts` stays a stub unless explicitly approved.
2. **Engines are pure.** All scoring, health, calorie, streak, and recommendation math lives in
   `lib/engine/` as pure functions, one file per domain, with colocated `*.test.ts`. No React,
   no storage, no `Date.now()` side-channels inside engines. UI components never contain this
   math.
3. **Derived daily state has one write path:** `lib/engine/dailySync.ts` (`syncDailyLog`).
   Pages write their own collections, then bump `touch()`; never hand-write derived `DailyLog`
   fields from a page.
4. **Types are centralized** in `lib/types.ts`. Seeded content lives in `lib/data/`.
5. **All browser APIs are SSR-safe** (`typeof window` guards; see `canUseStorage()`).
6. **Never delete or reshape a persisted type without a migration path** through the adapter's
   schema version + `migrate()` (added in v2 Phase 1).
7. Files confirmed correct in `v2_spec.md` §0.1 get **extended, not rewritten** — notably
   `app/api/coach/route.ts`, `lib/engine/mockCoach.ts` (deterministic; must keep working with
   zero API key), `forgeScore.ts`, `trainingRules.ts`, `ScoreRing.tsx`, the storage layer, and
   the PWA shell. Grow `REVIEW_SCHEMA` and `SYSTEM_PROMPT` together; keep model
   `claude-opus-4-8`, `thinking: adaptive`, `output_config.format` as-is.

## Design system

Tokens in `app/globals.css` (Tailwind v4 `@theme`): base `#0A0A0B` · surface `#141416` ·
elevated `#1C1C1F` · ivory `#F5F1E8` · muted `#9B978C` · gold `#C9A961` · success `#3DFF8B` ·
warning `#FF8A3D` · danger `#FF4D4D`. Primitives in `components/ui/` are shadcn-style and
deliberately hand-rolled where iOS reliability matters (native `<select>`, not Radix) — follow
that pattern for new form controls.

**Adherence-neutral color rule (hard):** warning/danger are reserved for genuine safety
signals — BP crisis, injury red flags, crisis guidance, overspend past a user-set limit. Never
for ordinary variance. Concrete "don't do this" examples (v1 bugs, fixed in v2 Phase 1):
skipped-workout `danger` tone in `app/(app)/today/page.tsx`, and warning-orange styling on the
helpful "+250 kcal" banner in `app/(app)/nutrition/page.tsx`. Neutral copy: "Not logged yet,"
"Still open" — never "failed"/"cheat"/"ruined". Scores measure quality; streaks measure
consistency; don't conflate them.

Mobile constraints: ≥44pt touch targets · 16px minimum font on all inputs (iOS zoom) ·
`inputmode` numeric/decimal on number fields · safe-area utilities `pt-safe`/`pb-safe`/
`pb-safe-nav` · every log flow completes in <30 seconds. Chart marks use the validated
dark-surface palette in `components/charts/TrendChart.tsx` (`#B08A28`/`#4C86D8`); brand gold is
too gray for data marks; status colors never double as series colors.

## Accessibility

Every interactive element gets an accessible name (`aria-label` where the visual is iconic —
`ScoreRing.tsx`'s trigger is the reference standard). Checklists/switches/radios use real roles
(see `components/ui/`). Charts never encode meaning by color alone (print values in cells,
legends for ≥2 series). Respect focus-visible rings already styled in the primitives.

## PWA

`public/manifest.json` + hand-rolled `public/sw.js`. **Adding a route requires updating the nav
(`components/shell/BottomNav.tsx`) and `SHELL_ROUTES` in `public/sw.js` in the same commit**,
and bumping the SW `VERSION` string when shell content changes — otherwise installed apps serve
a stale shell.

## Safety copy

The app never diagnoses, treats, or replaces professionals (physician, therapist, dietitian,
financial advisor, lawyer, emergency care). The four verbatim section disclaimers in
`v2_spec.md` §Safety Requirements ship persistently in Health, Mind, Relationships, and Money.
Crisis/red-flag escalation copy is a requirement, never gated, never softened.

## Commit convention

Imperative summary line scoped to one coherent phase/change (`Phase N: what shipped`), body as
short bullets of what + why. One phase = one reviewable diff. Never commit with failing
typecheck/tests/build; never bypass a failing check.
