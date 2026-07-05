# Forge 30 Audit

## Executive Summary

Forge 30 is a strong MVP, not just a mockup. It has real daily logging, scoring, training rules, nutrition tracking, progress charts, local PWA support, and a mock/live AI coach split. The core is genuinely usable.

The main issue is not "does it work?" It does. The issue is that it needs to evolve from a polished local-first MVP into a personalized, account-based coaching platform before it can feel like a paid must-have app.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test` | Passed, 36/36 tests |
| `npm run build` | Passed after repairing a corrupted local dependency install |
| `npm run lint` | Failed because `next lint` is deprecated and prompts for ESLint setup |

## Main Findings

### 1. Biggest Blocker: No Real Backend/Login Yet

The app is still device-local through:

- `lib/storage/provider.tsx`
- `lib/storage/localStorageAdapter.ts`

The Supabase adapter is only a throwing scaffold in:

- `lib/storage/supabaseAdapter.ts`

This is fine for an MVP, but it is not ready for paid subscriptions, account recovery, multi-device sync, user analytics, or serious retention.

### 2. Onboarding Is Too Shallow For A Universal Self-Improvement App

`components/shell/OnboardingGate.tsx` collects:

- Name
- Start date
- Calorie target
- Protein target
- Water target
- Spending limit
- Weight goal
- Basic pain flags

It does not yet ask for:

- Fitness level
- Equipment access
- Detailed injuries
- Schedule constraints
- Primary goals
- Diet preferences
- Sleep issues
- Stress level
- Work/life situation
- Desired coaching style

That limits how personalized the app feels.

### 3. AI Coach Is Architecturally Good, But Not Production-Hardened

`app/api/coach/route.ts` keeps the API key server-side, has guardrails, and falls back to the mock engine. That is a good foundation.

Before launch, it should add:

- Request validation
- Rate limiting
- Abuse protection
- Auth checks
- Error logging
- Usage limits by subscription tier

### 4. Lint Script Needs Updating

`package.json` uses:

```bash
next lint
```

This now prompts for ESLint setup and fails as an automated CI command. Replace it with a proper ESLint CLI setup so Vercel/CI can run lint non-interactively.

### 5. Progress Photos Are Risky In LocalStorage

`components/forms/BodyMetricSheet.tsx` downscales photos into base64 data URLs. This is clever for an offline MVP, but localStorage quota will eventually become a problem.

Move progress photos to Supabase Storage or another object store once accounts exist.

### 6. Some Future Features Are Visible But Disabled

Nutrition shows disabled Photo Log and Voice Log buttons in:

- `app/(app)/nutrition/page.tsx`

Either implement them soon or hide them until ready. Visible disabled features make the app feel unfinished.

## Strengths

- The app has a real local-first architecture, not scattered one-off state.
- The `StorageAdapter` pattern is the right foundation for adding Supabase later.
- The daily sync engine is a strong core idea: meals, workouts, journal, spending, and skills roll into one daily log.
- The mock AI coach means the product still works without a live API key.
- The PWA setup is practical for iPhone-only testing and early deployment.
- The training, nutrition, mind, money, skills, and progress sections are already coherent.
- The build and test suite pass after dependency repair.

## Highest Priority Fixes

### Phase 1: Production Hygiene

- Replace `next lint` with ESLint CLI.
- Add ESLint config.
- Add CI checks for typecheck, test, lint, and build.
- Add error boundaries for app screens.
- Add validation to `/api/coach`.
- Add rate limiting to `/api/coach`.

### Phase 2: Backend And Accounts

- Implement Supabase auth.
- Create Supabase tables for profile, daily logs, meals, workouts, journals, spending, skills, body metrics, and AI reviews.
- Add row-level security policies.
- Implement the full `SupabaseAdapter`.
- Swap the adapter in `lib/storage/provider.tsx`.
- Add account recovery and cross-device sync.

### Phase 3: Real Personalization

- Expand onboarding.
- Generate training plans based on goals, injuries, equipment, schedule, and experience level.
- Generate nutrition plans based on body stats, goal, food preferences, budget, and prep time.
- Let users choose coaching tone.
- Add adaptive weekly plan rewrites.

### Phase 4: AI Features

- AI plan builder.
- Injury-aware workout modifications.
- Voice logging.
- Daily review summaries.
- Weekly progress interpretation.
- "Reset my day" mode.
- Smart habit recommendations based on missed patterns.

### Phase 5: Monetization

Do not push subscriptions before backend/auth exists.

Suggested structure:

| Tier | Price | Features |
|---|---:|---|
| Free | $0 | Local tracking, basic daily score, seeded plans, mock coach |
| Plus | $7.99-$9.99/mo | Account sync, custom plans, AI daily reviews, weekly summaries |
| Pro | $14.99-$19.99/mo | Adaptive plans, voice logging, photo logs, advanced AI coach, deeper analytics |

What should never be paywalled:

- Basic logging
- Basic progress tracking
- Safety disclaimers
- Pain stop guidance
- Export/delete data controls

## Deployment Readiness

Forge 30 can deploy to Vercel as a Next.js app.

Required/optional environment variable:

```bash
ANTHROPIC_API_KEY=
```

Without that key, the app uses the deterministic mock coach.

## Final Assessment

Forge 30 is further along than a normal prototype. It has a real product loop and a strong technical backbone.

To become a serious public app, the next major move is backend/auth plus true personalization. Once users can log in, sync data, and receive adaptive plans, Forge 30 can become subscription-worthy.
