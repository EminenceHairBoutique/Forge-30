import type {
  AIReview,
  BodyMetric,
  DailyLog,
  ISODate,
  JournalEntry,
  MealEntry,
  SavedMeal,
  SkillTask,
  SpendingEntry,
  SundayReview,
  UserProfile,
  WorkoutEntry,
} from "@/lib/types";

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
  getWorkout(date: ISODate): Promise<WorkoutEntry | null>;
  saveWorkout(w: WorkoutEntry): Promise<void>;
  listWorkouts(from: ISODate, to: ISODate): Promise<WorkoutEntry[]>;
  listAllWorkouts(): Promise<WorkoutEntry[]>;

  // Journal
  getJournal(date: ISODate): Promise<JournalEntry | null>;
  saveJournal(j: JournalEntry): Promise<void>;
  listJournals(from: ISODate, to: ISODate): Promise<JournalEntry[]>;

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

  // Body metrics
  getBodyMetric(date: ISODate): Promise<BodyMetric | null>;
  saveBodyMetric(m: BodyMetric): Promise<void>;
  listBodyMetrics(from: ISODate, to: ISODate): Promise<BodyMetric[]>;

  // AI reviews
  getAIReview(date: ISODate): Promise<AIReview | null>;
  saveAIReview(r: AIReview): Promise<void>;
  listAIReviews(from: ISODate, to: ISODate): Promise<AIReview[]>;
}
