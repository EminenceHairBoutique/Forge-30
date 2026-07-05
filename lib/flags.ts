/**
 * Feature-flag registry — the single source of truth for what ships dark.
 *
 * Scaffolded-but-unfinished surfaces render only when their flag is on, so
 * unfinished work can merge without leaking into the product. Flags are
 * build-time constants (no per-user targeting yet); flip one here, ship it.
 *
 * Dispositions and blockers per flag live in V2_FABLE_EXPANSION_PLAN.md
 * §Flag registry — flags marked (legal) never flip without counsel review.
 */
/**
 * Surface rule (v3.3 §2.9): a flag-off feature is HIDDEN — no bespoke
 * disabled buttons. The one exception: marketing an imminent Pro feature
 * with the standard "soon" chip (the Health bloodwork/wearables chips are
 * the pattern).
 */
export const FLAGS = {
  /** Voice-journal transcription (needs an AI-key decision). */
  transcription: false,
  /** Bloodwork PDF/photo upload parsing (needs live AI). */
  bloodworkUpload: false,
  /** HealthKit / wearable integrations (needs backend). */
  wearables: false,
  /** Photo meal logging — shipped in v3 Phase 4 (route + AddMeal tab,
   *  graceful 503 → search without a key). Off would hide the photo tab. */
  photoMeal: true,
  /** Barcode food lookup (needs a data source decision). */
  barcode: false,
  /** Screenshot OCR for thread analysis (bundle-size + legal review). */
  ocrThreads: false,
  /** Real-time conversation analysis (legal review required). */
  realtimeAnalysis: false,
  /** Live research mode behavior on /api/research (needs AI key). */
  researchLive: false,
  /** Live-AI narrative for the Psyche Report (mock template ships first). */
  psycheReportLive: false,
  /** AI narration layer over deterministic LifeGraph findings. */
  lifeGraphAI: false,
  /** Light color scheme (deferred unless trivial after token consolidation). */
  lightMode: false,
  /** QA tier switcher in Settings — development builds only. */
  devTierSwitcher: process.env.NODE_ENV === "development",
} as const;

export type FlagName = keyof typeof FLAGS;

export function flagEnabled(flag: FlagName): boolean {
  return FLAGS[flag];
}
