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

/** Notification preferences — consumed by the in-app scheduler (E9). */
export interface NotificationPrefs {
  morningPlan: boolean;
  eveningReview: boolean;
  streakReminder: boolean;
  /** Sunday-evening weekly report nudge. Optional/additive; absent = on. */
  weeklyReport?: boolean;
  /** Quiet hours (v3 Phase 2) — "HH:MM" local; defaults 21:30 → 08:00. */
  quietStart?: string;
  quietEnd?: string;
  /** Protocol dose reminders (v3 Phase 6, discreet copy). Absent = on. */
  protocolReminders?: boolean;
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
  /** Relationships-tab mode (E11); orthogonal to the onboarding status text. */
  relationshipMode?: RelationshipMode;
  socialGoals?: string;
  /** Free text, user-reported; the app never diagnoses. */
  healthConcerns?: string;
  /** Optional; context for the coach, never medical advice. */
  medications?: string;
  trackBloodPressure?: boolean;
  trackFitnessMarkers?: boolean;
  /** Skill tracks shown on the Skills tab (E12); absent = the seeded three. */
  activeSkillTracks?: string[];
  domains?: DomainToggles;
  mvd?: MvdDefinition;
  notifications?: NotificationPrefs;
  injuries?: InjuryProfile[];
  /** Meal-plan template (v3 Phase 4 demotion): absent/"none" = no seeded
   *  plan; "forge30" re-enables the 7-day rotation + grocery list. */
  mealPlanTemplate?: "none" | "forge30";
  // --- v3.3 §3.1 personalization inputs (all optional/additive; each one is
  // consumed by the programs engine or the coach context — no dead fields).
  /** Training days per week the user actually plans to show up for. */
  trainingDaysPerWeek?: 2 | 3 | 4 | 5 | 6;
  /** Minutes per session the schedule really allows. */
  sessionMinutes?: 20 | 30 | 45 | 60 | 75 | 90;
  /** Self-reported sleep quality — coach context, never a diagnosis. */
  sleepQuality?: SleepQuality;
  /** Selected 30-day program (v3.3 §3.2); absent/"custom" = current behavior. */
  program?: ProgramId;
  onboardingComplete: boolean;
}

/** Media preferences (v3.3 §3.4) — on-device only, never synced. */
export interface MediaPrefs {
  /** Opt-in: voice-journal audio joins cloud sync (off by default). */
  syncVoice: boolean;
}

/** UI theme (Starship S0) — dark default, device-only preference. */
export type UiTheme = "dark" | "light";

export type SleepQuality = "rough" | "ok" | "good";

/** 30-day program identities (v3.3 §3.2). */
export type ProgramId = "custom" | "first30" | "comeback30" | "busy30";

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
  /**
   * Protocol side-effect tags (v3 Phase 6) — render ONLY when Protocols is
   * enabled. Patient-record observations, severity 1–5; never interpreted.
   */
  protocolSymptoms?: ProtocolSymptom[];
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

// --- Social connection (E12) ----------------------------------------------------

export type OutreachChannel = "text" | "call" | "inPerson" | "other";

/** One logged reach-out — the unit of social consistency. */
export interface OutreachEntry {
  id: string;
  date: ISODate;
  person: string;
  channel: OutreachChannel;
  note: string;
  createdAt: ISODateTime;
}

/** Someone worth reconnecting with, and when contact last happened. */
export interface ReconnectPerson {
  id: string;
  name: string;
  note: string;
  lastContact: ISODate | null;
}

/** Post-event reflection — two minutes after seeing people. */
export interface SocialReflection {
  id: string;
  date: ISODate;
  event: string;
  /** 1–10 how it felt overall. */
  feltGood: number;
  /** Energized vs. drained is information, not a verdict on the people. */
  drained: boolean;
  remember: string;
  createdAt: ISODateTime;
}

/** Social tab settings (weekly outreach goal drives the weekly streak). */
export interface SocialSettings {
  friendshipGoal: string;
  /** Reach-outs per week that count the week (weekly streak mode, E3). */
  weeklyOutreachTarget: number;
}

// --- Relationships (E11) --------------------------------------------------------

export type RelationshipMode =
  | "singleDating"
  | "relationship"
  | "marriedLongTerm"
  | "complicated"
  | "familyFocus"
  | "friendshipFocus"
  | "socialConfidence";

/** Daily relationship check-in (spec §Relationships). 0 = not answered. */
export interface RelationshipCheckIn {
  id: string;
  date: ISODate;
  mode: RelationshipMode;
  /** 1–10. */
  connection: number;
  /** 1–10. */
  communication: number;
  conflict: boolean;
  repairAttempt: boolean;
  appreciationExpressed: boolean;
  boundaryRespected: boolean;
  /** 1–10. */
  feelingHeard: number;
  /** 1–10 — low values escalate to safety resources, always free. */
  feelingSafe: number;
  note: string;
  createdAt: ISODateTime;
}

/** Conflict debrief — the user's own account, echoed back neutrally. */
export interface ConflictDebrief {
  id: string;
  date: ISODate;
  whatHappened: string;
  whatIFelt: string;
  whatINeeded: string;
  whatTheyMayHaveNeeded: string;
  didWell: string;
  didPoorly: string;
  repairAttempt: string;
  boundaryNeeded: string;
  nextCalmMessage: string;
  createdAt: ISODateTime;
}

/**
 * Timeline/documentation entry (E11) — dated, taggable, exportable. Keeping a
 * dated private record is standard DV-support practice; entries stay on
 * device and export only when the user asks.
 */
export interface IncidentEntry {
  id: string;
  date: ISODate;
  title: string;
  tags: string[];
  notes: string;
  /** Pattern findings carried over from a thread analysis, if any. */
  patternFindings: string[];
  createdAt: ISODateTime;
}

// --- Assessments (E10) ---------------------------------------------------------

export type AssessmentId =
  | "bigFive"
  | "values"
  | "conflictStyle"
  | "communicationStyle"
  | "attachmentStyle"
  // Phase NEXT wave 2 (B workstream)
  | "emotionalIntelligence"
  | "traumaCoping"
  // v3: tunes coach tone/priorities — preferences, never scores of the person.
  | "coachingStyle";

export interface AssessmentTraitScore {
  key: string;
  label: string;
  /** 0–100 within this assessment's own scale — descriptive, never normative. */
  score: number;
  band: "low" | "balanced" | "high";
  /** Educational one-liner for this person's band. */
  summary: string;
}

/**
 * The validity system (E10): disclosed data-quality signals, never an
 * accusation. Confidence is about how much weight to give the result — low
 * confidence means "take this lightly", not "you answered wrong".
 */
export interface AssessmentValidity {
  attentionFailed: number;
  attentionTotal: number;
  /** 0–1: disagreement across mirrored (reverse-coded) pairs. */
  inconsistency: number;
  /** 0–1: fraction of agree-side answers (acquiescence). */
  acquiescence: number;
  /** 0–1: fraction of maximally positive answers (idealization). */
  idealization: number;
  /** Median response under ~1.2s/question. */
  speedFlag: boolean;
  /** 0–100 disclosed weight-to-give-this. */
  confidence: number;
  confidenceLevel: "low" | "medium" | "high";
  /** Neutral, disclosed notes explaining the confidence score. */
  notes: string[];
}

export interface AssessmentResult {
  id: string;
  assessmentId: AssessmentId;
  date: ISODate;
  /** Couples passes (E11): who answered. Absent = self. */
  subject?: "self" | "partner";
  traits: AssessmentTraitScore[];
  /** Rank-kind assessments: item keys in the user's priority order. */
  ranking?: string[];
  validity: AssessmentValidity;
  createdAt: ISODateTime;  /** Sync stamp (v3 Phase 1) — set by the adapter on save, never by components. */
  updatedAt?: ISODateTime;
}

/** Saved mid-assessment state — resume exactly where they left off. */
export interface AssessmentProgress {
  assessmentId: AssessmentId;
  answers: Record<string, number>;
  ranking?: string[];
  timingsMs: number[];
  startedAt: ISODateTime;
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
  createdAt: ISODateTime;  /** Sync stamp (v3 Phase 1) — set by the adapter on save, never by components. */
  updatedAt?: ISODateTime;
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

/** A food picked from search/barcode, cached locally for instant offline repeats (v3 Phase 4). */
export interface CachedFood {
  id: string;
  name: string;
  brand: string;
  /** Macros per 100 g (the log flow scales portions). */
  per100g: { calories: number; protein: number; carbs: number; fats: number };
  lastUsedAt: ISODateTime;
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

// --- Money planning (E13) -------------------------------------------------------

export type RecurringCadence = "weekly" | "monthly" | "yearly";

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  cadence: RecurringCadence;
  category: SpendingCategory;
  /** Essential bills vs. cancellable subscriptions — review fodder. */
  essential: boolean;
}

export interface DebtItem {
  id: string;
  name: string;
  balance: number;
  aprPct: number;
  minimumPayment: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  saved: number;
}

/** Money-planning settings; category caps are monthly, user-set. */
export interface MoneySettings {
  monthlyIncome: number;
  emergencyFundTarget: number;
  emergencyFundSaved: number;
  /** Monthly contribution set aside before safe-to-spend is computed. */
  monthlySavingsContribution: number;
  categoryCaps: Partial<Record<SpendingCategory, number>>;
}

/** Impulse-spending 24-hour pause: park it, decide tomorrow (E13). */
export interface PendingPurchase {
  id: string;
  item: string;
  amount: number;
  createdAt: ISODateTime;
  /** When the pause ends and the app asks "still want it?". */
  decideAfter: ISODateTime;
  status: "waiting" | "bought" | "skipped";
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

export type SkillTrackId =
  | "finance"
  | "regulation"
  | "movement"
  | "nutritionBasics"
  | "communication"
  | "sleepOptimization"
  | "careerBusiness"
  | "socialConfidence"
  | "discipline"
  | "metaLearning";

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
  /**
   * LEGACY (pre-v3.3 §3.4): embedded photo data URL. New photos live in the
   * IndexedDB large store keyed by metric id (adapter.getBodyPhoto); the
   * one-time relocation empties this field and sets hasPhoto.
   */
  photoUrl?: string;
  /** A progress photo exists in the large store for this metric id. */
  hasPhoto?: boolean;
}

// ---------------------------------------------------------------------------
// AI Coach
// ---------------------------------------------------------------------------

/** The coach review shape produced by both the mock and live engines. */
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
  /** E15 additions — optional so pre-E15 persisted reviews stay valid. */
  healthAdjustment?: string;
  relationshipSocialAdjustment?: string;
  /**
   * Adaptive sections (v3 Phase 5): only the 3–6 parts that earned their
   * place, in coach order. Old 8-part reviews simply lack this and render
   * through the legacy field map — both shapes stay valid forever.
   */
  sections?: { key: string; text: string }[];
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Protocols (v3 Phase 6) — prescribed-therapy patient records. Hard rails
// (V3_SPEC §6.0, DECISIONS.md §9): the app records what the user's provider
// prescribed and what the user did — it never recommends, calculates, or
// adjusts anything. All fields are user-entered from their pharmacy label.
// ---------------------------------------------------------------------------

export type CompoundCategory = "trt" | "hgh" | "peptide" | "glp1" | "ancillary";
export type CompoundForm = "injection" | "gel" | "patch" | "pellet" | "oral";

export interface Compound {
  id: string;
  /** As printed on the pharmacy label. */
  name: string;
  category: CompoundCategory;
  form: CompoundForm;
  /** Label concentration, e.g. 200 mg/mL — user-entered, display math only. */
  labelConcentration: number | null;
  concentrationUnit: string;
  /** Vial volume in mL (injectables) — drives the inventory countdown. */
  vialVolumeMl: number | null;
  /** Published half-life in hours; prefilled from the reference table, user-editable. */
  halfLifeHours: number | null;
  expiryDate: ISODate | null;
  /** The prescriber's instructions, verbatim — a record, never a computation input. */
  prescriberNote: string;
  createdAt: ISODateTime;
}

export type SchedulePattern = "daily" | "eod" | "e3_5d" | "weekly" | "custom";

export interface ProtocolSchedule {
  id: string;
  compoundId: string;
  pattern: SchedulePattern;
  /** For weekly/custom: 0=Mon … 6=Sun. e3_5d alternates AM/PM twice weekly. */
  customDays?: number[];
  /** "HH:MM" local, for the reminder. */
  timeOfDay: string;
  /** Dose per administration as prescribed, in doseUnit. */
  dose: number;
  doseUnit: string;
  /** Anchor date the pattern counts from. */
  startDate: ISODate;
  paused: boolean;
  /** Auto-resume date when paused (provider-directed breaks). */
  resumeDate: ISODate | null;
}

export interface DoseEvent {
  id: string;
  compoundId: string;
  scheduleId: string | null;
  dose: number;
  doseUnit: string;
  route: string;
  /** Injection-site id from PROTOCOL_SITES; empty for non-injection forms. */
  site: string;
  timestamp: ISODateTime;
  note: string;
  updatedAt?: ISODateTime;
}

export interface LabMarkerValue {
  name: string;
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
}

export interface LabPanel {
  id: string;
  date: ISODate;
  /** Lab/source name, user-entered. */
  source: string;
  markers: LabMarkerValue[];
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
}

export interface ProtocolSymptom {
  tag: "acne" | "waterRetention" | "nightSweats" | "gi" | "injectionSite";
  /** 1–5 severity, self-reported. */
  severity: number;
}

export interface ProtocolSettings {
  enabled: boolean;
  /** User confirmed the protocol is prescribed and provider-supervised (§6.0.1). */
  prescribedConfirmed: boolean;
  /** Keeps every protocol collection out of cloud sync entirely. */
  localOnly: boolean;
  /** WebAuthn gate on the tab (credential id lives on this device). */
  lockEnabled: boolean;
  lockCredentialId: string | null;
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
  /** Days this week with any logged activity (v3.3 §1.2 cold-start gate). */
  activeDays: number;
  /** Absent until ≥3 active days — no "most missed" verdict on day one. */
  mostMissedHabit?: string;
}
