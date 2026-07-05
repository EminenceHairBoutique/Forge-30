/**
 * Feature-flag registry — the single source of truth for what ships dark.
 *
 * v3.3 Phase 4: flags are env-derived (`NEXT_PUBLIC_FLAG_*`), current values
 * as defaults, so flips are ops (set the env var, redeploy) rather than code
 * changes. Each flag references its env var statically — Next.js inlines
 * NEXT_PUBLIC_* only at literal call sites. Fail-closed: any value other
 * than exactly "true"/"1" resolves to the compiled default or false.
 *
 * Dispositions and blockers per flag live in V2_FABLE_EXPANSION_PLAN.md
 * §Flag registry — flags marked (legal) never flip without counsel review.
 *
 * Surface rule (v3.3 §2.9): a flag-off feature is HIDDEN — no bespoke
 * disabled buttons. The one exception: marketing an imminent Pro feature
 * with the standard "soon" chip (the Health bloodwork/wearables chips are
 * the pattern).
 */

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

export const FLAGS = {
  /** Voice-journal transcription (route ships fail-closed — DECISIONS §14). */
  transcription: envFlag(process.env.NEXT_PUBLIC_FLAG_TRANSCRIPTION, false),
  /** Bloodwork photo upload parsing (Pro; /api/health/labs). */
  bloodworkUpload: envFlag(process.env.NEXT_PUBLIC_FLAG_BLOODWORK_UPLOAD, false),
  /** HealthKit / wearable integrations (needs the native build). */
  wearables: envFlag(process.env.NEXT_PUBLIC_FLAG_WEARABLES, false),
  /** Photo meal logging — shipped in v3 Phase 4 (route + AddMeal tab,
   *  graceful 503 → search without a key). Off hides the photo tab. */
  photoMeal: envFlag(process.env.NEXT_PUBLIC_FLAG_PHOTO_MEAL, true),
  /** Barcode food lookup (native scanner path is live; this gates extras). */
  barcode: envFlag(process.env.NEXT_PUBLIC_FLAG_BARCODE, false),
  /** Screenshot OCR for thread analysis (bundle-size + legal review). */
  ocrThreads: envFlag(process.env.NEXT_PUBLIC_FLAG_OCR_THREADS, false),
  /** Real-time conversation analysis (legal review required). */
  realtimeAnalysis: envFlag(process.env.NEXT_PUBLIC_FLAG_REALTIME_ANALYSIS, false),
  /** Live research mode behavior on /api/research (Elite; needs AI key). */
  researchLive: envFlag(process.env.NEXT_PUBLIC_FLAG_RESEARCH_LIVE, false),
  /** Live-AI narrative for the Psyche Report (mock template ships first). */
  psycheReportLive: envFlag(process.env.NEXT_PUBLIC_FLAG_PSYCHE_REPORT_LIVE, false),
  /** AI narration over deterministic LifeGraph findings (Pro; never invents). */
  lifeGraphAI: envFlag(process.env.NEXT_PUBLIC_FLAG_LIFEGRAPH_AI, false),
  /** Light color scheme (deferred unless trivial after token consolidation). */
  lightMode: envFlag(process.env.NEXT_PUBLIC_FLAG_LIGHT_MODE, false),
  /** QA tier switcher in Settings — development builds only. */
  devTierSwitcher: process.env.NODE_ENV === "development",
} as const;

export type FlagName = keyof typeof FLAGS;

export function flagEnabled(flag: FlagName): boolean {
  return FLAGS[flag];
}
