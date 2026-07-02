# Forge30

A mobile-first, installable PWA for a 30-day lifestyle rebuild. One dashboard answers **"Am I winning today?"** across six domains — body, nutrition, training, mind, money, and skills — with a daily AI Coach that reads what you actually logged.

There is no landing page. The first screen is the app: open it, log your day, get honest feedback, adjust tomorrow. That loop is the product.

## What's inside

| Section | What it does |
|---|---|
| **Today** (`/today`) | Hero Forge Score ring (0–100, tap for the full breakdown), stat tiles for calories/protein/water/workout/steps/sleep/mobility/spending/mood/skills, the AI Coach one-liner, and one-tap quick actions for every logging flow. |
| **Nutrition** (`/nutrition`) | Macro rings + protein bar, +250ml water tracker, seeded 7-day meal plan (repeats ×4 weeks), one-tap planned-meal logging, quick-add templates, custom recipes, meal-prep checklist, weekly rotation view, grocery-list generator, and a "+250 kcal" banner when your 7-day weight trend is flat. |
| **Training** (`/training`) | Strong-style set logger (weight/reps/RPE/per-set pain/notes), seeded weekly split, warm-up checklist gate, rest timer, exercise swaps, a pain-aware rules engine (pain >6/10 → load cuts, overhead-press flags, supported-row swaps, appended prehab drills), the sharp-pain protocol modal, PR tracking, weekly muscle heat map, and history. |
| **Mind** (`/mind`) | Daily check-in (mood/stress/anxiety, triggers, boundaries), 60-second animated breathing reset, pause-before-reacting timer, thought dump, boundary script generator, night reflection, and sleep wind-down checklist. |
| **Money** (`/money`) | Sub-30-second spend logging (auto-focused amount, necessary/business/stress toggles), daily-limit status, weekly breakdowns, stress-purchase tracking, and the Sunday budget review. |
| **Skills** (`/skills`) | Three seeded tracks (finance, emotional regulation, functional movement) with rotating 10–20-minute daily tasks, minutes-as-XP, streaks, weekly milestones, and the 30-day book plan. |
| **Progress** (`/progress`) | The 30-day calendar with per-day state chips, trend charts for every metric, the weekly report card, body metrics + local progress photos, and rules-based coach recommendations. |
| **AI Coach** (`/coach`) | The same 8-part review every day: score explanation, what went well, what slipped, one physical / nutrition / money / mental adjustment, and tomorrow's #1 priority. Works fully offline via a deterministic mock engine; connects to the Anthropic API when a key is configured. |

## Tech stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn-style components · Recharts · localStorage behind a `StorageAdapter` interface · hand-rolled service worker · Vitest.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run typecheck  # tsc --noEmit
npm test           # Vitest unit tests (score engine, pain rules, mock coach)
npm run build      # production build
npm start          # serve the production build (service worker active)
```

Node 18.18+ (Node 22 recommended).

## Install as a PWA

### iPhone / iPad
1. Open the deployed URL in **Safari**.
2. Tap **Share** (the square with the arrow) → **Add to Home Screen** → **Add**.
3. Launch from the home screen icon — Forge30 opens full-screen (standalone, black-translucent status bar, safe-area aware) and works offline.

### Android
Open the URL in Chrome → menu → **Install app** (or accept the install prompt).

### Desktop (Chrome / Edge)
Click the install icon in the address bar → **Install**. The app opens in its own window; the mobile layout centers in a ~480px column, and the Progress and Money pages expand to two columns on wide screens.

### App Store path (future)
The documented upgrade path to a native App Store build is wrapping this PWA with **Capacitor** (`@capacitor/ios`): the app is already a self-contained client-side bundle, so it drops into a WebView shell without code changes. Not implemented in the MVP — Add to Home Screen covers the current requirement.

## Customize

- **Goals/targets** — Settings (`/settings`) or first-run onboarding: calorie target (default 3050), protein target (default 170g), water target, daily spending limit, weight goal, pain flags. The Sunday budget review can also update the live daily spending limit.
- **Meal plan** — edit `lib/data/mealPlan.ts` (7 `MealPlanDay` entries with per-meal macros and ingredients; the grocery list derives from the same data). Quick-add templates live in `lib/data/quickAdds.ts`.
- **Workout plan** — edit `lib/data/workoutPlan.ts` (weekly split, prescriptions, per-side/overhead flags, swap pool, warm-up checklist, prehab drills).
- **Skill tracks & books** — `lib/data/skills.ts` and `lib/data/books.ts`.
- **Score weights** — `lib/engine/forgeScore.ts` (components, partial-credit curve, penalties), covered by unit tests.

## AI Coach: mock engine vs live API

**Mock engine (default, no key needed).** `lib/engine/mockCoach.ts` is a pure, deterministic function of the day's log: protein short >30g → it names a specific quick-add; calories short >400 → calorie-dense shake; 7-day weight flat → +250 kcal/day; pain >6/10 → reduce loads 15–25% and avoid overhead pressing; stress >7/10 → breathing reset before charged conversations; unnecessary spend over the limit → next-day cap; skills missed two days running → 10-minute minimum task. Same log in, same review out — and it always produces the full 8-part structure.

**Live engine (optional).** Set the environment variable and the `/coach` page automatically upgrades:

```bash
cp .env.example .env.local
# ANTHROPIC_API_KEY=sk-ant-...
```

The client builds a structured JSON summary of today's log + trailing 7-day trends and POSTs it to `/api/coach`. The route calls the Anthropic Messages API (`claude-opus-4-8`) with a system prompt encoding the coach's tone, hard guardrails (no medical/therapy/legal/financial advice), and a JSON schema enforcing the exact 8-part output. The key is read server-side only and never shipped to the client. **Any** failure — missing key, network error, refusal, malformed output — falls back to the mock engine, so the coach never breaks.

## Persistence: localStorage now, Supabase later

All reads/writes go through the `StorageAdapter` interface (`lib/storage/adapter.ts`) — components never touch `localStorage` directly. The MVP binds `LocalStorageAdapter` (`lib/storage/localStorageAdapter.ts`): each collection (daily logs, meals, workouts, journal, spending, skills, body metrics, AI reviews) is a JSON blob under a `forge30:*` key, guarded for SSR and hydrated through a client-side React provider. Data is device-local and offline-native.

**Supabase upgrade path** (scaffolded in `lib/storage/supabaseAdapter.ts`, intentionally not wired):
1. `npm install @supabase/supabase-js`
2. Create tables mirroring the collections in `lib/types.ts`, keyed by `user_id` + date, with row-level security on `auth.uid()`.
3. Implement every `StorageAdapter` method against those tables.
4. Swap the adapter in `lib/storage/provider.tsx` — one line; no UI changes needed.

## Deploy to Vercel

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # production
```

Or connect the GitHub repo in the Vercel dashboard — the defaults work (framework: Next.js, build: `next build`). To enable the live coach, add `ANTHROPIC_API_KEY` under **Project → Settings → Environment Variables**. The service worker and manifest are served from `/public` with the correct headers (see `next.config.ts`), so the deployed site is installable out of the box.

## Project layout

```
app/                    routes: (app)/today · nutrition · training · mind · money
                        · progress · coach · skills · settings, plus api/coach
components/             ui/ (shadcn-style primitives) · cards/ · charts/ · forms/
                        · mind/ · training/ · shell/ · pwa/
lib/
  storage/              StorageAdapter interface · LocalStorageAdapter · Supabase stub · provider
  engine/               forgeScore · dailySync · nutritionRules · trainingRules
                        · trends · weeklySummary · bodyRules · mockCoach · coachContext (+ tests)
  data/                 mealPlan · quickAdds · workoutPlan · skills · books · defaults
public/                 manifest.json · sw.js · icons/
```
