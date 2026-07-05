# CLAUDE.md — Forge30

Forge30 is an installable, offline-first PWA (dark-only, mobile-first): a personal operating
system connecting nutrition, training, mind, money, skills, health, and relationships into one
daily loop. **`V3_SPEC.md` is the active spec** — it supersedes `v2_spec.md` where they
conflict; where v3 is silent, v2 still applies. `AUDIT_V3.md` reconciles the spec against this
branch; `DECISIONS.md` records binding scope decisions (do not re-litigate them);
`V3_PLAN.md` maps Phases 1–5 file by file.

## v3 rules (V3_SPEC Part A)

- **Cut features stay cut** (DECISIONS.md): no consensual-recording code, no
  clinical-adjacent screeners, no IQ-adjacent testing. The Coaching Style & Values assessment
  is the sanctioned replacement — preferences, never diagnoses.
- **Every failure falls back gracefully**: coach → mock engine; sync → local; HealthKit →
  manual entry; photo logging → search/manual. Nothing hard-breaks on a missing key, network,
  or permission.
- **Model usage (server-side only):** coach reads `process.env.COACH_MODEL`, default
  `claude-sonnet-5`; photo/vision `claude-sonnet-5`; micro-copy `claude-haiku-4-5-20251001`.
  Structured outputs with JSON schemas on every route; any parse failure → deterministic
  fallback. API keys never reach the client — all Anthropic calls go through `app/api/*`.
- Server-only env (`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`,
  `ANTHROPIC_API_KEY`) is never imported by client code.
- Adherence-neutral extends to notification copy: state, never shame; hard cap 2/day; zero on
  fully-logged days; quiet hours respected; every type can be disabled.
- **Protocols rails (Rev 3.1 §6.0, hard):** the opt-in Protocols tab is a patient record for
  prescribed therapy — the app never recommends, calculates, or adjusts doses (no dose/
  reconstitution calculators, no titration, no cycle/stack tooling, no compound suggestions;
  the only unit math is displaying the entered dose at the entered label concentration). The
  coach carries a dosing blocklist with red-team fixtures in CI. Discreet notification copy,
  biometric lock, local-only sync mode; invisible unless enabled. **Forge30 and Noir Peptides
  never touch** — no links, mentions, branding, or promotion, in either direction, ever
  (DECISIONS.md §10).

## Stack & commands

Next.js 15 App Router · React 19 · TypeScript strict (`noUncheckedIndexedAccess`) ·
Tailwind v4 · Recharts · Vitest · `@anthropic-ai/sdk` (server-side only). Package manager:
**npm** (lockfile committed). Node 18.18+ (dev on 22).

```bash
npm run dev          # dev server on :3000
npm run build        # production build — must stay green
npm start            # serve production build (service worker active)
npm run typecheck    # tsc --noEmit — must stay clean
npm test             # Vitest; count only ever grows (301 at v3 Phase 0 — DECISIONS.md §2)
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

## Design system — "Solaris HUD"

Tokens in `app/globals.css` (Tailwind v4 `@theme`): warm base `#0b0806` · warm-glass
surface/elevated (rgba tints; solids `#161210`/`#1d1712`) · ivory `#fff4e4` · muted `#b3a18a` ·
gold `#ffb13d` · ember `#ff6a3d` (gradient partner, hero/primary only) · gold-soft `#ffd98a` ·
success (teal) `#2de1c2` · danger `#ff3b30` · safety surface `#16181a`. **`warning` is retired**
— there is no warning token or class. Molten/bar/glass gradients and the glow/stroke/radius
scale are defined once in `:root`. Primitives in `components/ui/` are shadcn-style and
deliberately hand-rolled where iOS reliability matters (native `<select>`, not Radix) — follow
that pattern for new form controls. Microlabels (`.microlabel`, Geist Mono 10px/.16em) are the
label register everywhere. Emotional surfaces (Mind, Relationships, Journal) keep warm glass +
microlabels but no corner brackets, delta chips, or glow — the instrument language lives where
data lives.

**Safety-color rule (§2, hard):** ember is brand, so color alone never carries safety
semantics. Safety states use the **red family only** (`--accent-danger`) at two intensities —
caution (reduced weight: tinted border + icon + explicit text label; `Badge variant="caution"`)
and critical (solid treatment). Every safety component pairs color with an icon and an explicit
text label, and renders on the neutral cool-dark `--surface-safety` (`bg-safety`), never warm
glass, never ember/gold inside. Genuine safety signals: BP stages/crisis, injury red flags,
crisis guidance, overspend past a user-set limit.

**Adherence-neutral color rule (hard):** danger is reserved for genuine safety signals — never
for ordinary variance. Missed habits stay neutral; teal = completion; ember/gold = brand and
progress, never judgment. Neutral copy: "Not logged yet," "Still open" — never
"failed"/"cheat"/"ruined". Scores measure quality; streaks measure consistency; don't conflate
them.

Mobile constraints: ≥44pt touch targets · 16px minimum font on all inputs (iOS zoom) ·
`inputmode` numeric/decimal on number fields · safe-area utilities `pt-safe`/`pb-safe`/
`pb-safe-nav` · every log flow completes in <30 seconds. Chart series A uses the molten
gradient stroke with `#ffb13d` marks; series B stays `#4C86D8` blue (CVD-safe separation from
the warm family) — see `components/charts/TrendChart.tsx`. Status colors never double as
series colors. Glow budget: ember glow on at most the score ring, the one primary action, and
the coach card per screen; teal glow only on completion/milestone moments. Blur budget: ≤3
backdrop-filter layers per screen, with solid fallbacks.

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
