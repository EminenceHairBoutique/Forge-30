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
}

export interface ExerciseSet {
  exerciseId: string;
  weight: number;
  reps: number;
  rpe: number;
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
