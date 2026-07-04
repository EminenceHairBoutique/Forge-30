/**
 * Forge30 core domain types.
 *
 * Every piece of persisted state in the app is described here. All storage
 * goes through the StorageAdapter interface (lib/storage/adapter.ts) so the
 * persistence layer can be swapped (localStorage today, Supabase later)
 * without touching UI code.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** ISO date string, always `YYYY-MM-DD` (local time). */
export type ISODate = string;

/** ISO timestamp string, e.g. `2026-07-02T14:30:00.000Z`. */
export type ISODateTime = string;

export type CalendarState =
  | "complete"
  | "partial"
  | "missed"
  | "recovery"
  | "highStress"
  | "highPain";

export type WorkoutStatus = "notStarted" | "inProgress" | "complete" | "rest" | "skipped";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface PainFlags {
  thoracic: boolean;
  rib: boolean;
  scapular: boolean;
  upperTrapDominant: boolean;
  leftArmAggravation: boolean;
}

// --- Universal profile vocabulary (E5) ---------------------------------------

export type Sex = "male" | "female" | "other" | "unspecified";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";

export type TrainingExperience = "beginner" | "intermediate" | "advanced";

export type EquipmentAccess = "none" | "minimal" | "homeGym" | "fullGym";

export type DietPreference =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "other";

/** The v2 goal menu (spec §Onboarding). */
export type GoalId =
  | "gainMuscle"
  | "loseFat"
  | "recomposition"
  | "maintain"
  | "healthMarkers"
  | "bloodPressure"
  | "strength"
  | "cardio"
  | "sleep"
  | "stress"
  | "relationship"
  | "dating"
  | "friendships"
  | "finances"
  | "discipline"
  | "skills"
  | "generalReset";

/**
 * Which life domains the app tracks for this user. Turning one off hides its
 * surfaces and hands its Forge Score weight to the rest (renormalization —
 * see forgeScore.ts). Health/relationships/social gate v2 tabs as they land.
 */
export interface DomainToggles {
  nutrition: boolean;
  training: boolean;
  mind: boolean;
  money: boolean;
  skills: boolean;
  health: boolean;
  relationships: boolean;
  social: boolean;
}

/**
 * The user's own Minimum Viable Day. At least one part must be on — an empty
 * MVD would be trivially met and hollow out the streak; the engine falls back
 * to the default (meal + check-in) if everything is unchecked.
 */
export interface MvdDefinition {
  /** Log at least one meal. */
  meal: boolean;
  /** Do the 2-minute mind check-in. */
  checkIn: boolean;
  /** Log any water. */
  water: boolean;
  /** Any movement: a workout, a rest-day walk, any steps. */
  movement: boolean;
}

/** Stored now, consumed by push/reminders in E9. */
export interface NotificationPrefs {
  morningPlan: boolean;
  eveningReview: boolean;
  streakReminder: boolean;
}

/**
 * Structured injury description (E5) — generalizes PainFlags. Until the
 * training engine flips over (E8-T), PainFlags stays the authoritative input
 * and injuries can be derived from it; both live on the profile.
 */
export interface InjuryProfile {
  id: string;
  /** e.g. "thoracic spine", "left shoulder". */
  bodyArea: string;
  /** Professional diagnosis if one exists — user-reported, never inferred. */
  diagnosis: string;
  symptoms: string;
  /** 0–10 typical pain. */
  painScore: number;
  aggravatingMovements: string[];
  relievingMovements: string[];
  medicalRestrictions: string;
  onsetDate: ISODate | null;
  /** Currently receiving professional care for it. */
  professionalCare: boolean;
  notes: string;
}

export interface UserProfile {
  name: string;
  /** Day 1 of the 30-day program. */
  startDate: ISODate;
  /** Daily calorie target (kcal). Default 3050. */
  calorieTarget: number;
  /** Daily protein target (grams). Default 170. */
  proteinTarget: number;
  /** Daily water target (ml). */
  waterTarget: number;
  weightGoal: string;
  painFlags: PainFlags;
  /** Daily discretionary spending limit in dollars. */
  dailySpendingLimit: number;
  /**
   * Hour (0–23) when the day's score stops "building" and becomes a verdict.
   * Optional/additive — absent on pre-v2 profiles; default 20 (8 PM).
   */
  dayBoundaryHour?: number;
  /**
   * User-adjustable Forge Score weights (E3). Absent on pre-v2 profiles ⇒ the
   * engine's DEFAULT_WEIGHTS. Renormalized to 100 when a domain is disabled.
   */
  scoreWeights?: ForgeScoreWeights;

  // --- Universal profile (E5). All optional/additive; schema v2's migration
  // fills the structured trio (domains/mvd/notifications) with defaults.
  age?: number | null;
  sex?: Sex;
  heightIn?: number | null;
  /** Starting body weight (lb) from onboarding; trend weight supersedes it. */
  weightLb?: number | null;
  goalWeightLb?: number | null;
  primaryGoal?: GoalId;
  secondaryGoals?: GoalId[];
  activityLevel?: ActivityLevel;
  trainingExperience?: TrainingExperience;
  equipment?: EquipmentAccess;
  dietPreference?: DietPreference;
  /** Free text: allergies, dislikes, religious restrictions. */
  dietaryRestrictions?: string;
  sleepTargetHours?: number;
  /** Free text: what the money domain is working toward. */
  budgetGoal?: string;
  relationshipStatus?: string;
  socialGoals?: string;
  /** Free text, user-reported; the app never diagnoses. */
  healthConcerns?: string;
  /** Optional; context for the coach, never medical advice. */
  medications?: string;
  trackBloodPressure?: boolean;
  trackFitnessMarkers?: boolean;
  domains?: DomainToggles;
  mvd?: MvdDefinition;
  notifications?: NotificationPrefs;
  injuries?: InjuryProfile[];
  onboardingComplete: boolean;
}

// ---------------------------------------------------------------------------
// Daily log — the single source of truth for "how did today go"
// ---------------------------------------------------------------------------

export interface DailyLog {
  date: ISODate;
  forgeScore: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  waterMl: number;
  workoutStatus: WorkoutStatus;
  steps: number;
  sleepHours: number;
  mobilityDone: boolean;
  spendingChecked: boolean;
  /** 1–10, 0 = not logged. */
  mood: number;
  /** 1–10, 0 = not logged. */
  stress: number;
  /** 0–10 worst pain experienced today. */
  painScore: number;
  skillMinutes: number;
  journalDone: boolean;
  calendarState: CalendarState;
  /** Ids of checked meal-prep checklist items (see PREP_CHECKLIST). */
  prepChecklist?: string[];
  /**
   * Hard Day mode: targets collapse to the Minimum Viable Day and coach tone
   * switches to recovery framing. Never reduces streaks, never shames.
   */
  hardDay?: boolean;
  /** Morning Plan card dismissed for this date. */
  morningPlanSeen?: boolean;
}

/**
 * Per-component Forge Score weights (E3). Keys mirror `ScoreComponent["key"]`
 * in `lib/engine/forgeScore.ts`. Default set sums to 100; renormalized to 100
 * whenever a domain is disabled.
 */
export interface ForgeScoreWeights {
  calories: number;
  protein: number;
  water: number;
  workout: number;
  mobility: number;
  sleep: number;
  spending: number;
  mind: number;
  skill: number;
}

/**
 * Persisted streak (E3) — the app-wide Minimum Viable Day streak, a skill
 * track's streak, etc. Everything but `celebratedMilestones` is re-derived
 * from the history of met days by `computeStreak`; the celebration list is the
 * one piece of genuine user state (which milestone cards have been dismissed).
 * Consistency, never quality — a streak never shames and hard days don't break
 * it.
 */
export interface StreakState {
  /** "daily" for the app-wide MVD streak, or a skill trackId, etc. */
  id: string;
  current: number;
  longest: number;
  /** Freezes banked (0–maxFreezes). */
  freezes: number;
  lastMetDate: ISODate | null;
  /** Today isn't met yet but the run is alive — log to keep it. */
  atRisk: boolean;
  metToday: boolean;
  /** Inside the 48h earn-back window after a recent break. */
  inRepairWindow: boolean;
  /** A milestone reached but not yet celebrated, else null. */
  pendingMilestone: number | null;
  /** Milestone thresholds whose card the user has already seen/dismissed. */
  celebratedMilestones: number[];
}

// --- Health tab (E7) ----------------------------------------------------------

export type BodyPosition = "seated" | "standing" | "lying";
export type CuffLocation = "leftArm" | "rightArm" | "wrist";

/** One blood-pressure reading with measurement context (spec §Health). */
export interface BloodPressureEntry {
  id: string;
  date: ISODate;
  /** Local time "HH:MM". */
  time: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  position: BodyPosition;
  cuffLocation: CuffLocation;
  /** Context that commonly skews readings. */
  caffeine: boolean;
  exercise: boolean;
  stress: boolean;
  notes: string;
  createdAt: ISODateTime;
}

/** One lab value. Lab-provided reference range always beats the dictionary. */
export interface Biomarker {
  /** Canonical dictionary name when recognized, else as entered. */
  name: string;
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  /** The lab's own flag (H/L/etc.), verbatim, if present. */
  labFlag?: string;
  notes?: string;
}

/** A bloodwork panel (large store — reports can be long). */
export interface BloodworkReport {
  id: string;
  date: ISODate;
  labName: string;
  markers: Biomarker[];
  notes: string;
  createdAt: ISODateTime;
}

/** Fitness/recovery markers beyond BodyMetric (spec §Health §Fitness markers). */
export interface HealthMarkerEntry {
  id: string;
  date: ISODate;
  restingHR: number | null;
  hrv: number | null;
  cardioMinutes: number | null;
  zone2Minutes: number | null;
  gripStrengthLb: number | null;
  pushUps: number | null;
  plankSec: number | null;
  mileTimeSec: number | null;
  bodyFatPct: number | null;
  createdAt: ISODateTime;
}

// --- Journal system (E6) ------------------------------------------------------

export type JournalKind = "freewrite" | "thoughtRecord" | "voice";

/**
 * A journal note — free-write, CBT thought record, or voice note. Stored in
 * the IndexedDB large store (bodies can be long; audio is heavy). Distinct
 * from the daily `JournalEntry` check-in, which stays the structured
 * mood/stress ritual; either one satisfies the MVD's check-in half.
 */
export interface JournalNote {
  id: string;
  date: ISODate;
  kind: JournalKind;
  /** Free-write body / voice-note caption. */
  text: string;
  /** User-chosen tags plus any accepted suggestions. */
  tags: string[];
  /**
   * Private flag — this entry NEVER leaves the journal: excluded from the
   * coach, assessments, and LifeGraph even when those consents are on.
   * Always wins over every consent toggle.
   */
  private: boolean;
  // CBT thought record fields (kind === "thoughtRecord").
  situation?: string;
  automaticThought?: string;
  emotion?: string;
  /** 0–10 intensity of the emotion at the time. */
  emotionIntensity?: number;
  evidenceFor?: string;
  evidenceAgainst?: string;
  reframe?: string;
  // Voice note fields (kind === "voice").
  /** Record id in the large store's journalAudio collection (data URL). */
  audioId?: string;
  durationSec?: number;
  createdAt: ISODateTime;
}

/**
 * Journal consent — which consumers may read non-private entries. Default
 * OFF for every consumer: the journal is private until the user says
 * otherwise, and per-entry `private` still excludes an entry even when a
 * consumer is on. Every journal-informed output carries an attribution line.
 */
export interface JournalConsent {
  coach: boolean;
  assessments: boolean;
  lifeGraph: boolean;
}

/** Tonight's intention for tomorrow — feeds the next Morning Plan (E2). */
export interface TomorrowPlan {
  /** The date the plan is FOR (tomorrow at creation time). */
  date: ISODate;
  /** One focus line, e.g. "protein before 2pm". */
  focus: string;
  /** Planned meal names the user intends (from the rotation or their own). */
  intendedMeals: string[];
  /** Intended discretionary cap for the day; null = no intention set. */
  spendingIntention: number | null;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export interface MacroSet {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export type MealSlot = "meal1" | "meal2" | "addon";

export interface MealEntry extends MacroSet {
  id: string;
  date: ISODate;
  slot: MealSlot;
  name: string;
  loggedAt: ISODateTime;
}

export interface QuickAddFood extends MacroSet {
  id: string;
  name: string;
  description: string;
}

/** A saved custom recipe (name + macros). */
export interface SavedMeal extends MacroSet {
  id: string;
  name: string;
  createdAt: ISODateTime;
}

export interface PlannedMeal extends MacroSet {
  slot: "meal1" | "meal2";
  name: string;
  ingredients: string[];
}

export interface MealPlanDay {
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  label: string;
  meals: PlannedMeal[];
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "fullBody";

/** Movement pattern taxonomy for the workout builder (E8-T). */
export type MovementPattern =
  | "push"
  | "pull"
  | "squat"
  | "hinge"
  | "carry"
  | "core"
  | "cardio"
  | "mobility";

/**
 * Injury-caution tags: an exercise carrying a tag is excluded/swapped when an
 * injury profile maps to that tag (see cautionTagsForInjuries).
 */
export type CautionTag =
  | "overhead"
  | "spinal-load"
  | "shoulder"
  | "elbow"
  | "knee"
  | "hip"
  | "wrist"
  | "high-impact";

export interface ExerciseDef {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  /** Prescription shown in the logger, e.g. "4×8–12". */
  prescription: string;
  perSide?: boolean;
  /** True for heavy overhead pressing — flagged when pain is high. */
  overheadPressing?: boolean;
  /** Suggested pain-safe swap exercise ids. */
  swaps?: string[];
  // --- Library tags (E8-T) — optional so seeded v1 entries stay valid.
  pattern?: MovementPattern;
  /** Minimum equipment tier required (matches EquipmentAccess ordering). */
  equipment?: EquipmentAccess;
  /** 1 = anyone, 2 = some experience, 3 = advanced technique. */
  difficulty?: 1 | 2 | 3;
  unilateral?: boolean;
  category?: "strength" | "cardio" | "mobility" | "prehab";
  cautions?: CautionTag[];
}

export interface ExerciseSet {
  exerciseId: string;
  weight: number;
  reps: number;
  rpe: number;
  /** Reps in reserve — RPE's inverse, optional alongside it (E8-T). */
  rir?: number;
  /** 0–10 pain during this set. */
  painScore: number;
  note: string;
}

export interface LoggedExercise {
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  sets: ExerciseSet[];
  /** Set when the user swapped this in for a prescribed movement. */
  swappedFromId?: string;
}

export interface WorkoutEntry {
  id: string;
  date: ISODate;
  /** Which day of the split, e.g. "Upper Push + Shoulders". */
  splitLabel: string;
  status: WorkoutStatus;
  warmupDone: boolean;
  exercises: LoggedExercise[];
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  /** Max pain score logged across all sets. */
  sessionPainScore: number;
  note: string;
}

export interface WorkoutDayPlan {
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  label: string;
  isRest: boolean;
  exercises: ExerciseDef[];
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: ISODate;
}

/**
 * A user-built weekly plan from the workout builder (E8-T). When present it
 * replaces the seeded rotation everywhere a day's workout is shown.
 */
export interface CustomWorkoutPlan {
  id: string;
  name: string;
  /** 7 entries, index 0 = Monday (same shape as the seeded plan). */
  days: WorkoutDayPlan[];
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Mind / journal
// ---------------------------------------------------------------------------

export interface JournalEntry {
  id: string;
  date: ISODate;
  mood: number;
  stress: number;
  anxietyAnger: number;
  relationshipStress: boolean;
  mainTrigger: string;
  whatIControlled: string;
  whatToLetGo: string;
  boundaryPracticed: string;
  resetDone: boolean;
  windDownDone: boolean;
  thoughtDump: string;
  nightReflection: string;
  loggedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export type SpendingCategory =
  | "food"
  | "bills"
  | "transport"
  | "business"
  | "health"
  | "entertainment"
  | "shopping"
  | "subscriptions"
  | "debt"
  | "other";

export interface SpendingEntry {
  id: string;
  date: ISODate;
  amount: number;
  category: SpendingCategory;
  necessary: boolean;
  business: boolean;
  stressPurchase: boolean;
  note: string;
  loggedAt: ISODateTime;
}

export interface SundayReview {
  id: string;
  /** Date of the Sunday the review was done. */
  date: ISODate;
  incomeExpected: number;
  billsDue: number;
  foodBudget: number;
  debtPayment: number;
  businessBudget: number;
  emergencyBuffer: number;
  thingToCut: string;
  thingToSell: string;
  tomorrowLimit: number;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export type SkillTrackId = "finance" | "regulation" | "movement";

export interface SkillTask {
  id: string;
  trackId: SkillTrackId;
  date: ISODate;
  taskLabel: string;
  minutes: number;
  note: string;
  completedAt: ISODateTime;
}

export interface SkillTrackDef {
  id: SkillTrackId;
  name: string;
  description: string;
  dailyTasks: string[];
  weeklyMilestones: string[];
}

export interface BookPlanItem {
  week: number;
  title: string;
  author: string;
  optional?: boolean;
}

// ---------------------------------------------------------------------------
// Body metrics
// ---------------------------------------------------------------------------

export interface BodyMetric {
  id: string;
  date: ISODate;
  /** Morning weight in lb; 0 = not logged. */
  weightLb: number;
  waistIn: number;
  chestIn: number;
  armsIn: number;
  legsIn: number;
  /** 1–10 subjective energy. */
  energy: number;
  /** 1–10 subjective soreness. */
  soreness: number;
  /** Local object URL / data URL of progress photo (MVP only). */
  photoUrl: string;
}

// ---------------------------------------------------------------------------
// AI Coach
// ---------------------------------------------------------------------------

/** The exact 8-part output shape produced by both the mock and live engines. */
export interface AIReview {
  id: string;
  date: ISODate;
  source: "mock" | "live";
  /**
   * True when journal themes (consented, non-private) informed this review —
   * drives the persistent attribution line in the UI (E6).
   */
  journalInformed?: boolean;
  scoreExplanation: string;
  wentWell: string;
  slipped: string;
  physicalAdjustment: string;
  nutritionAdjustment: string;
  moneyAdjustment: string;
  mentalAdjustment: string;
  tomorrowPriority: string;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Weekly summary
// ---------------------------------------------------------------------------

export interface WeeklySummary {
  weekStart: ISODate;
  weekEnd: ISODate;
  avgCalories: number;
  avgProtein: number;
  /** lb change first→last logged weight this week; null if <2 weigh-ins. */
  weightTrendLb: number | null;
  workoutCompletionPct: number;
  prCount: number;
  spendingTotal: number;
  unnecessarySpendingTotal: number;
  avgStress: number;
  avgSleep: number;
  avgForgeScore: number;
  mostMissedHabit: string;
}
