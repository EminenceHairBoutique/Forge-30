import type {
  AIReview,
  AssessmentId,
  AssessmentProgress,
  AssessmentResult,
  BloodPressureEntry,
  BloodworkReport,
  BodyMetric,
  CachedFood,
  ConflictDebrief,
  Compound,
  CustomWorkoutPlan,
  ProtocolSettings,
  ProtocolSchedule,
  LabPanel,
  DoseEvent,
  DailyLog,
  DebtItem,
  HealthMarkerEntry,
  ISODate,
  JournalConsent,
  JournalEntry,
  IncidentEntry,
  JournalNote,
  MealEntry,
  MoneySettings,
  OutreachEntry,
  PendingPurchase,
  ReconnectPerson,
  RecurringExpense,
  SavedMeal,
  SavingsGoal,
  RelationshipCheckIn,
  SkillTask,
  SocialReflection,
  SocialSettings,
  SpendingEntry,
  StreakState,
  SundayReview,
  TomorrowPlan,
  UserProfile,
  WorkoutEntry,
  MediaPrefs,
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
  listTomorrowPlans(from: ISODate, to: ISODate): Promise<TomorrowPlan[]>;

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

  // Money planning (E13) — recurring bills, debts, goals, caps, impulse pauses
  listRecurringExpenses(): Promise<RecurringExpense[]>;
  saveRecurringExpense(e: RecurringExpense): Promise<void>;
  deleteRecurringExpense(id: string): Promise<void>;
  listDebts(): Promise<DebtItem[]>;
  saveDebt(d: DebtItem): Promise<void>;
  deleteDebt(id: string): Promise<void>;
  listSavingsGoals(): Promise<SavingsGoal[]>;
  saveSavingsGoal(g: SavingsGoal): Promise<void>;
  deleteSavingsGoal(id: string): Promise<void>;
  getMoneySettings(): Promise<MoneySettings>;
  saveMoneySettings(s: MoneySettings): Promise<void>;
  listPendingPurchases(): Promise<PendingPurchase[]>;
  savePendingPurchase(p: PendingPurchase): Promise<void>;
  deletePendingPurchase(id: string): Promise<void>;

  // Skills
  listSkillTasks(from: ISODate, to: ISODate): Promise<SkillTask[]>;
  saveSkillTask(t: SkillTask): Promise<void>;
  deleteSkillTask(id: string): Promise<void>;
  /** Weeks of the book plan marked read. */
  getCheckedBooks(): Promise<number[]>;
  saveCheckedBooks(weeks: number[]): Promise<void>;

  // Notifications (E9) — last fired date per type, the once-per-day gate.
  getNotificationLog(): Promise<Record<string, ISODate>>;
  saveNotificationLog(log: Record<string, ISODate>): Promise<void>;

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

  // Relationships (E11)
  listRelationshipCheckIns(from: ISODate, to: ISODate): Promise<RelationshipCheckIn[]>;
  saveRelationshipCheckIn(checkIn: RelationshipCheckIn): Promise<void>;
  listConflictDebriefs(): Promise<ConflictDebrief[]>;
  saveConflictDebrief(debrief: ConflictDebrief): Promise<void>;
  /** Dated documentation timeline (large store) — private, exportable. */
  listIncidents(): Promise<IncidentEntry[]>;
  saveIncident(entry: IncidentEntry): Promise<void>;
  deleteIncident(id: string): Promise<void>;

  // Social connection (E12)
  listOutreach(from: ISODate, to: ISODate): Promise<OutreachEntry[]>;
  saveOutreach(entry: OutreachEntry): Promise<void>;
  listReconnect(): Promise<ReconnectPerson[]>;
  saveReconnect(list: ReconnectPerson[]): Promise<void>;
  listSocialReflections(): Promise<SocialReflection[]>;
  saveSocialReflection(r: SocialReflection): Promise<void>;
  getSocialSettings(): Promise<SocialSettings>;
  saveSocialSettings(s: SocialSettings): Promise<void>;

  // Protocols (v3 Phase 6 — prescribed-therapy records; §6.0 rails apply)
  getProtocolSettings(): Promise<ProtocolSettings>;
  saveProtocolSettings(s: ProtocolSettings): Promise<void>;
  listCompounds(): Promise<Compound[]>;
  saveCompound(c: Compound): Promise<void>;
  deleteCompound(id: string): Promise<void>;
  listProtocolSchedules(): Promise<ProtocolSchedule[]>;
  saveProtocolSchedule(s: ProtocolSchedule): Promise<void>;
  deleteProtocolSchedule(id: string): Promise<void>;
  listDoseEvents(from: ISODate, to: ISODate): Promise<DoseEvent[]>;
  saveDoseEvent(d: DoseEvent): Promise<void>;
  deleteDoseEvent(id: string): Promise<void>;
  listLabPanels(): Promise<LabPanel[]>;
  saveLabPanel(p: LabPanel): Promise<void>;
  deleteLabPanel(id: string): Promise<void>;

  // LifeGraph surfacing log (v3 Phase 5 — no pattern repeats within a week)
  getPatternLog(): Promise<Record<string, ISODate>>;
  savePatternLog(log: Record<string, ISODate>): Promise<void>;

  // Food cache + meal photos (v3 Phase 4)
  listFoodCache(): Promise<CachedFood[]>;
  saveFoodCacheItem(item: CachedFood): Promise<void>;
  saveMealPhoto(mealId: string, dataUrl: string): Promise<void>;
  getMealPhoto(mealId: string): Promise<string | null>;

  // -- Media discipline (v3.3 §3.4) -------------------------------------------
  /** Progress photos live in the large store, keyed by metric id. */
  saveBodyPhoto(metricId: string, dataUrl: string): Promise<void>;
  getBodyPhoto(metricId: string): Promise<string | null>;
  getMediaPrefs(): Promise<MediaPrefs>;
  saveMediaPrefs(prefs: MediaPrefs): Promise<void>;
  /** Approximate bytes of media (voice audio + photos) on this device. */
  mediaUsageBytes(): Promise<number>;

  // Assessments (E10 — large store; results and in-flight progress)
  listAssessmentResults(): Promise<AssessmentResult[]>;
  saveAssessmentResult(result: AssessmentResult): Promise<void>;
  getAssessmentProgress(id: AssessmentId): Promise<AssessmentProgress | null>;
  saveAssessmentProgress(progress: AssessmentProgress): Promise<void>;
  clearAssessmentProgress(id: AssessmentId): Promise<void>;

  // Body metrics
  getBodyMetric(date: ISODate): Promise<BodyMetric | null>;
  saveBodyMetric(m: BodyMetric): Promise<void>;
  listBodyMetrics(from: ISODate, to: ISODate): Promise<BodyMetric[]>;

  // AI reviews
  getAIReview(date: ISODate): Promise<AIReview | null>;
  saveAIReview(r: AIReview): Promise<void>;
  listAIReviews(from: ISODate, to: ISODate): Promise<AIReview[]>;
}
