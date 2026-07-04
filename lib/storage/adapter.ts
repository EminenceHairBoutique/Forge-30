import type {
  AIReview,
  BloodPressureEntry,
  BloodworkReport,
  BodyMetric,
  CustomWorkoutPlan,
  DailyLog,
  HealthMarkerEntry,
  ISODate,
  JournalConsent,
  JournalEntry,
  JournalNote,
  MealEntry,
  SavedMeal,
  SkillTask,
  SpendingEntry,
  StreakState,
  SundayReview,
  TomorrowPlan,
  UserProfile,
  WorkoutEntry,
} from "@/lib/types";
import type { ExportFile } from "./migrations";
import type { Tier } from "@/lib/engine/entitlements";

/**
 * Every read/write in the app goes through this interface. The MVP ships a
 * LocalStorageAdapter; a SupabaseAdapter implementing the same contract is
 * the upgrade path (see lib/storage/supabaseAdapter.ts). UI components must
 * never touch localStorage directly.
 *
 * All methods are async so a remote adapter can drop in without UI changes.
 * Date parameters are local-time ISO dates (`YYYY-MM-DD`); ranges are
 * inclusive on both ends.
 */
export interface StorageAdapter {
  // Profile
  getProfile(): Promise<UserProfile | null>;
  saveProfile(p: UserProfile): Promise<void>;
  resetAll(): Promise<void>;

  // Data lifecycle (backup/restore — see lib/storage/migrations.ts)
  exportAll(): Promise<ExportFile>;
  /** Replaces all stored data with the (validated, migrated) file contents. */
  importAll(file: ExportFile): Promise<void>;

  // Entitlements (local until real subscription state lands — see expansion plan E16)
  getTier(): Promise<Tier>;
  saveTier(tier: Tier): Promise<void>;

  // Daily rituals (E2)
  getTomorrowPlan(date: ISODate): Promise<TomorrowPlan | null>;
  saveTomorrowPlan(plan: TomorrowPlan): Promise<void>;

  // Streaks (E3) — keyed by streak id ("daily", a skill trackId, …)
  getStreak(id: string): Promise<StreakState | null>;
  saveStreak(state: StreakState): Promise<void>;

  // Daily logs
  getDailyLog(date: ISODate): Promise<DailyLog | null>;
  saveDailyLog(log: DailyLog): Promise<void>;
  listDailyLogs(from: ISODate, to: ISODate): Promise<DailyLog[]>;

  // Meals
  listMeals(date: ISODate): Promise<MealEntry[]>;
  listMealsRange(from: ISODate, to: ISODate): Promise<MealEntry[]>;
  saveMeal(meal: MealEntry): Promise<void>;
  deleteMeal(id: string): Promise<void>;
  listSavedMeals(): Promise<SavedMeal[]>;
  saveSavedMeal(meal: SavedMeal): Promise<void>;
  deleteSavedMeal(id: string): Promise<void>;

  // Workouts
  /** User-built weekly plan (E8-T); null = use the seeded rotation. */
  getCustomWorkoutPlan(): Promise<CustomWorkoutPlan | null>;
  saveCustomWorkoutPlan(plan: CustomWorkoutPlan | null): Promise<void>;
  getWorkout(date: ISODate): Promise<WorkoutEntry | null>;
  saveWorkout(w: WorkoutEntry): Promise<void>;
  listWorkouts(from: ISODate, to: ISODate): Promise<WorkoutEntry[]>;
  listAllWorkouts(): Promise<WorkoutEntry[]>;

  // Journal (daily check-in)
  getJournal(date: ISODate): Promise<JournalEntry | null>;
  saveJournal(j: JournalEntry): Promise<void>;
  listJournals(from: ISODate, to: ISODate): Promise<JournalEntry[]>;

  // Journal notes (E6 — free-write/thought-record/voice; large store)
  listJournalNotes(from: ISODate, to: ISODate): Promise<JournalNote[]>;
  saveJournalNote(note: JournalNote): Promise<void>;
  deleteJournalNote(id: string): Promise<void>;
  /** Consent-controlled deletion: wipes every note and every audio blob. */
  deleteAllJournalData(): Promise<void>;
  getJournalConsent(): Promise<JournalConsent>;
  saveJournalConsent(consent: JournalConsent): Promise<void>;
  /** Voice-note audio as a data URL, keyed by the note's audioId. */
  getJournalAudio(audioId: string): Promise<string | null>;
  saveJournalAudio(audioId: string, dataUrl: string): Promise<void>;

  // Spending
  listSpending(date: ISODate): Promise<SpendingEntry[]>;
  listSpendingRange(from: ISODate, to: ISODate): Promise<SpendingEntry[]>;
  saveSpending(s: SpendingEntry): Promise<void>;
  deleteSpending(id: string): Promise<void>;
  getSundayReview(date: ISODate): Promise<SundayReview | null>;
  saveSundayReview(r: SundayReview): Promise<void>;
  listSundayReviews(): Promise<SundayReview[]>;

  // Skills
  listSkillTasks(from: ISODate, to: ISODate): Promise<SkillTask[]>;
  saveSkillTask(t: SkillTask): Promise<void>;
  deleteSkillTask(id: string): Promise<void>;
  /** Weeks of the book plan marked read. */
  getCheckedBooks(): Promise<number[]>;
  saveCheckedBooks(weeks: number[]): Promise<void>;

  // Health (E7)
  listBloodPressure(from: ISODate, to: ISODate): Promise<BloodPressureEntry[]>;
  saveBloodPressure(entry: BloodPressureEntry): Promise<void>;
  deleteBloodPressure(id: string): Promise<void>;
  listHealthMarkers(from: ISODate, to: ISODate): Promise<HealthMarkerEntry[]>;
  saveHealthMarker(entry: HealthMarkerEntry): Promise<void>;
  /** Bloodwork reports live in the large store — panels can be long. */
  listBloodwork(): Promise<BloodworkReport[]>;
  saveBloodwork(report: BloodworkReport): Promise<void>;
  deleteBloodwork(id: string): Promise<void>;

  // Body metrics
  getBodyMetric(date: ISODate): Promise<BodyMetric | null>;
  saveBodyMetric(m: BodyMetric): Promise<void>;
  listBodyMetrics(from: ISODate, to: ISODate): Promise<BodyMetric[]>;

  // AI reviews
  getAIReview(date: ISODate): Promise<AIReview | null>;
  saveAIReview(r: AIReview): Promise<void>;
  listAIReviews(from: ISODate, to: ISODate): Promise<AIReview[]>;
}
