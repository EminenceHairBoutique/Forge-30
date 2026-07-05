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
  DailyLog,
  DoseEvent,
  LabPanel,
  ProtocolSchedule,
  ProtocolSettings,
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
import type { StorageAdapter } from "./adapter";
import { DEFAULT_TIER, isTier, type Tier } from "@/lib/engine/entitlements";
import { createLargeStore } from "./largeStore";
import {
  SCHEMA_VERSION,
  DROPPED_LARGE_COLLECTIONS,
  REMOVED_ASSESSMENT_IDS,
  VERSION_KEY,
  buildExport,
  runMigrations,
  validateExport,
  type CollectionSnapshot,
  type ExportFile,
} from "./migrations";

const PREFIX = "forge30";

const KEYS = {
  profile: `${PREFIX}:profile`,
  dailyLogs: `${PREFIX}:dailyLogs`,
  meals: `${PREFIX}:meals`,
  savedMeals: `${PREFIX}:savedMeals`,
  workouts: `${PREFIX}:workouts`,
  journals: `${PREFIX}:journals`,
  spending: `${PREFIX}:spending`,
  sundayReviews: `${PREFIX}:sundayReviews`,
  skillTasks: `${PREFIX}:skillTasks`,
  books: `${PREFIX}:books`,
  bodyMetrics: `${PREFIX}:bodyMetrics`,
  mediaPrefs: `${PREFIX}:mediaPrefs`,
  aiReviews: `${PREFIX}:aiReviews`,
  entitlements: `${PREFIX}:entitlements`,
  tomorrowPlans: `${PREFIX}:tomorrowPlans`,
  streaks: `${PREFIX}:streaks`,
  journalConsent: `${PREFIX}:journalConsent`,
  bloodPressure: `${PREFIX}:bloodPressure`,
  healthMarkers: `${PREFIX}:healthMarkers`,
  customWorkoutPlan: `${PREFIX}:customWorkoutPlan`,
  notificationLog: `${PREFIX}:notificationLog`,
  relationshipCheckIns: `${PREFIX}:relationshipCheckIns`,
  outreach: `${PREFIX}:outreach`,
  reconnectList: `${PREFIX}:reconnectList`,
  socialReflections: `${PREFIX}:socialReflections`,
  socialSettings: `${PREFIX}:socialSettings`,
  recurringExpenses: `${PREFIX}:recurringExpenses`,
  debts: `${PREFIX}:debts`,
  savingsGoals: `${PREFIX}:savingsGoals`,
  moneySettings: `${PREFIX}:moneySettings`,
  pendingPurchases: `${PREFIX}:pendingPurchases`,
  foodCache: `${PREFIX}:foodCache`,
  patternLog: `${PREFIX}:patternLog`,
  protocolSettings: `${PREFIX}:protocolSettings`,
  compounds: `${PREFIX}:compounds`,
  protocolSchedules: `${PREFIX}:protocolSchedules`,
} as const;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Write-observation hook (v3 Phase 1): the SyncedAdapter registers one
 * observer and hears every persisted mutation from the two choke points —
 * the localStorage `write()` below (whole-collection blobs, rowId null) and
 * the decorated large store (per-record rows). Collections added later are
 * covered automatically; nothing per-feature to wire.
 */
export type WriteObserver = (
  collection: string,
  rowId: string | null,
  value: unknown,
  op: "upsert" | "delete"
) => void;

let writeObserver: WriteObserver | null = null;

export function setWriteObserver(observer: WriteObserver | null): void {
  writeObserver = observer;
}

/**
 * Sync-exclusion registry (v3 Phase 6, §6.0.5 local-only mode). Excluded
 * collections never reach the write observer (so they never enqueue for
 * cloud sync) and the SyncedAdapter's pull path drops their remote rows.
 * `protocolSettings` is ALWAYS excluded — the privacy toggle itself never
 * leaves the device; the other protocol collections join it when the user
 * turns local-only mode on.
 */
export const PROTOCOL_COLLECTIONS = [
  "compounds",
  "protocolSchedules",
  "doseEvents",
  "labPanels",
] as const;

// Media rules (v3.3 §3.4): progress photos never sync (Supabase Storage is
// a future phase); voice audio syncs only with the explicit opt-in below;
// the prefs records themselves stay on-device like protocolSettings.
const ALWAYS_EXCLUDED = new Set<string>(["protocolSettings", "mediaPrefs", "bodyPhotos"]);
let protocolLocalOnly = false;
let voiceSyncOptIn = false;
let syncExcluded = new Set<string>([...ALWAYS_EXCLUDED, "journalAudio"]);
let exclusionsHydrated = false;

function rebuildExclusions(): void {
  syncExcluded = new Set<string>([
    ...ALWAYS_EXCLUDED,
    ...(protocolLocalOnly ? PROTOCOL_COLLECTIONS : []),
    ...(voiceSyncOptIn ? [] : ["journalAudio"]),
  ]);
}

export function setProtocolLocalOnly(localOnly: boolean): void {
  // Hydrate first so setting one dimension never freezes the other at its
  // default while a stricter persisted value exists (§6.0.5 cold start).
  hydrateSyncExclusions();
  protocolLocalOnly = localOnly;
  rebuildExclusions();
}

export function setVoiceSyncOptIn(optIn: boolean): void {
  hydrateSyncExclusions();
  voiceSyncOptIn = optIn;
  rebuildExclusions();
}

/**
 * Self-enforcing hydration (§6.0.5): the exclusion set is loaded from the
 * persisted ProtocolSettings the FIRST time any sync-relevant path asks —
 * write observation, pull-apply, or the first-sign-in migration — so the
 * local-only guarantee never depends on UI mount order. Synchronous read;
 * cheap; runs once per module load and again on every settings save.
 */
export function hydrateSyncExclusions(): void {
  if (exclusionsHydrated || !canUseStorage()) return;
  exclusionsHydrated = true;
  try {
    const raw = window.localStorage.getItem(KEYS.protocolSettings);
    protocolLocalOnly = raw
      ? (JSON.parse(raw) as { localOnly?: boolean }).localOnly === true
      : false;
  } catch {
    protocolLocalOnly = false;
  }
  try {
    const raw = window.localStorage.getItem(KEYS.mediaPrefs);
    voiceSyncOptIn = raw ? (JSON.parse(raw) as { syncVoice?: boolean }).syncVoice === true : false;
  } catch {
    voiceSyncOptIn = false;
  }
  rebuildExclusions();
}

export function isSyncExcluded(collection: string): boolean {
  hydrateSyncExclusions();
  return syncExcluded.has(collection);
}

/** Test hook: clears the hydration cache so fixtures can re-seed storage. */
export function resetSyncExclusionsForTests(): void {
  exclusionsHydrated = false;
  protocolLocalOnly = false;
  voiceSyncOptIn = false;
  syncExcluded = new Set<string>([...ALWAYS_EXCLUDED, "journalAudio"]);
}

const COLLECTION_BY_KEY: Record<string, string> = {};

function notifyWrite(key: string, value: unknown): void {
  if (!writeObserver) return;
  if (Object.keys(COLLECTION_BY_KEY).length === 0) {
    for (const [name, k] of Object.entries(KEYS)) COLLECTION_BY_KEY[k] = name;
  }
  const collection = COLLECTION_BY_KEY[key];
  if (collection && !isSyncExcluded(collection)) {
    writeObserver(collection, null, value, "upsert");
  }
}

/** Reads every existing collection into a snapshot keyed by collection name. */
export function snapshotCollections(): CollectionSnapshot {
  const snapshot: CollectionSnapshot = {};
  if (!canUseStorage()) return snapshot;
  for (const [name, key] of Object.entries(KEYS)) {
    const raw = window.localStorage.getItem(key);
    if (raw === null) continue;
    try {
      snapshot[name] = JSON.parse(raw);
    } catch {
      // Corrupted blob: leave it out of the snapshot rather than crash.
    }
  }
  return snapshot;
}

function writeCollections(collections: CollectionSnapshot): void {
  for (const [name, key] of Object.entries(KEYS)) {
    if (name in collections) write(key, collections[name]);
  }
}

/**
 * Raw collection-blob write by collection name — the sync engine's merge
 * path. Same write() choke point as everything else (observer suppression is
 * the SyncedAdapter's job while merging).
 */
export function writeCollectionBlob(collection: string, value: unknown): void {
  const key = (KEYS as Record<string, string>)[collection];
  if (key) write(key, value);
}

let migrationChecked = false;

/**
 * Lazy, idempotent schema check run before the first storage access (not in
 * the constructor — the adapter is instantiated during render). Pre-versioning
 * installs (data present, no version key) are schema 1 by definition; fresh
 * installs are stamped current. Data from a *newer* schema is left untouched.
 */
function ensureMigrated(): void {
  if (migrationChecked || !canUseStorage()) return;
  migrationChecked = true;
  try {
    const rawVersion = window.localStorage.getItem(VERSION_KEY);
    const hasData = Object.values(KEYS).some((k) => window.localStorage.getItem(k) !== null);
    const parsed = rawVersion === null ? NaN : Number(rawVersion);
    const stored = Number.isInteger(parsed) && parsed >= 1 ? parsed : hasData ? 1 : SCHEMA_VERSION;

    if (stored > SCHEMA_VERSION) {
      // Newer-app data (e.g. synced back from a future build): never touch it.
      console.warn(
        `Forge30: stored data is schema ${stored}, this build supports ${SCHEMA_VERSION}. Leaving data untouched.`
      );
      return;
    }
    if (stored < SCHEMA_VERSION) {
      const { collections } = runMigrations(snapshotCollections(), stored);
      writeCollections(collections);
    }
    window.localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION));
  } catch {
    // Storage failure: run un-migrated rather than crash; next load retries.
    migrationChecked = false;
  }
}

function read<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  ensureMigrated();
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  ensureMigrated();
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    notifyWrite(key, value);
  } catch {
    // Quota exceeded or private-mode failure: data stays in memory for the session.
  }
}

function inRange(date: ISODate, from: ISODate, to: ISODate): boolean {
  return date >= from && date <= to;
}

/**
 * MVP persistence: everything lives in a handful of JSON blobs in
 * localStorage, keyed by record collection. Collections keyed by date use a
 * `Record<ISODate, T>` map; append-style collections use arrays.
 */
/** Large-store decorator: reports per-record puts/deletes to the observer.
 * Explicit delegation (not spread) — the stores are class instances, so
 * their methods live on the prototype. */
function observeLargeStore(store: ReturnType<typeof createLargeStore>): ReturnType<typeof createLargeStore> {
  return {
    get: (collection, id) => store.get(collection, id),
    list: (collection) => store.list(collection),
    clear: (collection) => store.clear(collection),
    exportAll: () => store.exportAll(),
    importAll: (data) => store.importAll(data),
    async put(collection, id, value) {
      await store.put(collection, id, value);
      if (!isSyncExcluded(collection)) writeObserver?.(collection, id, value, "upsert");
    },
    async delete(collection, id) {
      await store.delete(collection, id);
      if (!isSyncExcluded(collection)) writeObserver?.(collection, id, null, "delete");
    },
  };
}

export class LocalStorageAdapter implements StorageAdapter {
  // -- Profile ---------------------------------------------------------------
  async getProfile(): Promise<UserProfile | null> {
    return read<UserProfile | null>(KEYS.profile, null);
  }

  async saveProfile(p: UserProfile): Promise<void> {
    write(KEYS.profile, p);
  }

  async resetAll(): Promise<void> {
    if (!canUseStorage()) return;
    for (const key of Object.values(KEYS)) window.localStorage.removeItem(key);
    window.localStorage.removeItem(VERSION_KEY);
    migrationChecked = false;
    // Large-record collections (journal bodies, audio, assessments) live in
    // IndexedDB — a full reset must not orphan them there.
    await this.large.importAll({});
  }

  // -- Daily rituals -------------------------------------------------------------
  async getTomorrowPlan(date: ISODate): Promise<TomorrowPlan | null> {
    return read<Record<ISODate, TomorrowPlan>>(KEYS.tomorrowPlans, {})[date] ?? null;
  }

  async saveTomorrowPlan(plan: TomorrowPlan): Promise<void> {
    const all = read<Record<ISODate, TomorrowPlan>>(KEYS.tomorrowPlans, {});
    all[plan.date] = plan;
    write(KEYS.tomorrowPlans, all);
  }

  async listTomorrowPlans(from: ISODate, to: ISODate): Promise<TomorrowPlan[]> {
    return Object.values(read<Record<ISODate, TomorrowPlan>>(KEYS.tomorrowPlans, {}))
      .filter((p) => inRange(p.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // -- Streaks -------------------------------------------------------------------
  async getStreak(id: string): Promise<StreakState | null> {
    return read<Record<string, StreakState>>(KEYS.streaks, {})[id] ?? null;
  }

  async saveStreak(state: StreakState): Promise<void> {
    const all = read<Record<string, StreakState>>(KEYS.streaks, {});
    all[state.id] = state;
    write(KEYS.streaks, all);
  }

  // -- Entitlements ------------------------------------------------------------
  async getTier(): Promise<Tier> {
    const stored = read<{ tier?: unknown }>(KEYS.entitlements, {});
    return isTier(stored.tier) ? stored.tier : DEFAULT_TIER;
  }

  async saveTier(tier: Tier): Promise<void> {
    write(KEYS.entitlements, { tier });
  }

  // -- Data lifecycle ----------------------------------------------------------
  /** Large-record backend (IndexedDB, localStorage fallback) — see largeStore.ts. */
  protected large = observeLargeStore(createLargeStore());
  private largeCleaned = false;

  /**
   * One-shot prune of large-store data whose feature was removed (v3 §A3):
   * dropped collections are cleared and results of removed assessments are
   * deleted. Idempotent and cheap on already-clean stores, so it simply runs
   * once per adapter instance before the first large-store read.
   */
  private async cleanupRemovedLarge(): Promise<void> {
    if (this.largeCleaned) return;
    this.largeCleaned = true;
    try {
      for (const collection of DROPPED_LARGE_COLLECTIONS) {
        await this.large.clear(collection);
      }
      const removed: readonly string[] = REMOVED_ASSESSMENT_IDS;
      const results = await this.large.list<AssessmentResult>("assessmentResults");
      for (const [id, r] of Object.entries(results)) {
        if (removed.includes(r.assessmentId)) {
          await this.large.delete("assessmentResults", id);
        }
      }
    } catch {
      // Cleanup is best-effort; a failure just retries on the next instance.
      this.largeCleaned = false;
    }
  }

  async exportAll(): Promise<ExportFile> {
    ensureMigrated();
    return buildExport(snapshotCollections(), new Date().toISOString(), await this.large.exportAll());
  }

  async importAll(file: ExportFile): Promise<void> {
    const valid = validateExport(file);
    const { collections } = runMigrations(valid.collections, valid.schemaVersion);
    if (!canUseStorage()) return;
    // Write the new data first, then remove only the keys absent from the
    // file — if a quota failure interrupts mid-import, the previous data is
    // still largely in place instead of already wiped.
    writeCollections(collections);
    for (const [name, key] of Object.entries(KEYS)) {
      if (!(name in collections)) window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION));
    migrationChecked = true;
    const incomingLarge = { ...(valid.large ?? {}) };
    for (const collection of DROPPED_LARGE_COLLECTIONS) delete incomingLarge[collection];
    const removedIds: readonly string[] = REMOVED_ASSESSMENT_IDS;
    if (incomingLarge.assessmentResults) {
      incomingLarge.assessmentResults = Object.fromEntries(
        Object.entries(incomingLarge.assessmentResults).filter(
          ([, r]) => !removedIds.includes((r as AssessmentResult).assessmentId)
        )
      );
    }
    await this.large.importAll(incomingLarge);
  }

  // -- Daily logs --------------------------------------------------------------
  async getDailyLog(date: ISODate): Promise<DailyLog | null> {
    return read<Record<ISODate, DailyLog>>(KEYS.dailyLogs, {})[date] ?? null;
  }

  async saveDailyLog(log: DailyLog): Promise<void> {
    const all = read<Record<ISODate, DailyLog>>(KEYS.dailyLogs, {});
    all[log.date] = log;
    write(KEYS.dailyLogs, all);
  }

  async listDailyLogs(from: ISODate, to: ISODate): Promise<DailyLog[]> {
    return Object.values(read<Record<ISODate, DailyLog>>(KEYS.dailyLogs, {}))
      .filter((l) => inRange(l.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // -- Meals -------------------------------------------------------------------
  async listMeals(date: ISODate): Promise<MealEntry[]> {
    return read<MealEntry[]>(KEYS.meals, []).filter((m) => m.date === date);
  }

  async listMealsRange(from: ISODate, to: ISODate): Promise<MealEntry[]> {
    return read<MealEntry[]>(KEYS.meals, []).filter((m) => inRange(m.date, from, to));
  }

  async saveMeal(meal: MealEntry): Promise<void> {
    const all = read<MealEntry[]>(KEYS.meals, []);
    const i = all.findIndex((m) => m.id === meal.id);
    if (i >= 0) all[i] = meal;
    else all.push(meal);
    write(KEYS.meals, all);
  }

  async deleteMeal(id: string): Promise<void> {
    write(
      KEYS.meals,
      read<MealEntry[]>(KEYS.meals, []).filter((m) => m.id !== id)
    );
  }

  async listSavedMeals(): Promise<SavedMeal[]> {
    return read<SavedMeal[]>(KEYS.savedMeals, []);
  }

  async saveSavedMeal(meal: SavedMeal): Promise<void> {
    const all = read<SavedMeal[]>(KEYS.savedMeals, []);
    const i = all.findIndex((m) => m.id === meal.id);
    if (i >= 0) all[i] = meal;
    else all.push(meal);
    write(KEYS.savedMeals, all);
  }

  async deleteSavedMeal(id: string): Promise<void> {
    write(
      KEYS.savedMeals,
      read<SavedMeal[]>(KEYS.savedMeals, []).filter((m) => m.id !== id)
    );
  }

  // -- Workouts ------------------------------------------------------------------
  async getWorkout(date: ISODate): Promise<WorkoutEntry | null> {
    return read<Record<ISODate, WorkoutEntry>>(KEYS.workouts, {})[date] ?? null;
  }

  async saveWorkout(w: WorkoutEntry): Promise<void> {
    const all = read<Record<ISODate, WorkoutEntry>>(KEYS.workouts, {});
    all[w.date] = w;
    write(KEYS.workouts, all);
  }

  async listWorkouts(from: ISODate, to: ISODate): Promise<WorkoutEntry[]> {
    return Object.values(read<Record<ISODate, WorkoutEntry>>(KEYS.workouts, {}))
      .filter((w) => inRange(w.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async listAllWorkouts(): Promise<WorkoutEntry[]> {
    return Object.values(read<Record<ISODate, WorkoutEntry>>(KEYS.workouts, {})).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  // -- Custom workout plan (E8-T) --------------------------------------------------
  async getCustomWorkoutPlan(): Promise<CustomWorkoutPlan | null> {
    return read<CustomWorkoutPlan | null>(KEYS.customWorkoutPlan, null);
  }

  async saveCustomWorkoutPlan(plan: CustomWorkoutPlan | null): Promise<void> {
    if (plan === null) {
      if (canUseStorage()) window.localStorage.removeItem(KEYS.customWorkoutPlan);
      return;
    }
    write(KEYS.customWorkoutPlan, plan);
  }

  // -- Journal ---------------------------------------------------------------------
  async getJournal(date: ISODate): Promise<JournalEntry | null> {
    return read<Record<ISODate, JournalEntry>>(KEYS.journals, {})[date] ?? null;
  }

  async saveJournal(j: JournalEntry): Promise<void> {
    const all = read<Record<ISODate, JournalEntry>>(KEYS.journals, {});
    all[j.date] = j;
    write(KEYS.journals, all);
  }

  async listJournals(from: ISODate, to: ISODate): Promise<JournalEntry[]> {
    return Object.values(read<Record<ISODate, JournalEntry>>(KEYS.journals, {}))
      .filter((j) => inRange(j.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // -- Journal notes (E6 — large store: bodies can be long, audio is heavy) -------
  async listJournalNotes(from: ISODate, to: ISODate): Promise<JournalNote[]> {
    const all = await this.large.list<JournalNote>("journalNotes");
    return Object.values(all)
      .filter((n) => inRange(n.date, from, to))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveJournalNote(note: JournalNote): Promise<void> {
    await this.large.put("journalNotes", note.id, { ...note, updatedAt: new Date().toISOString() });
  }

  async deleteJournalNote(id: string): Promise<void> {
    const note = await this.large.get<JournalNote>("journalNotes", id);
    if (note?.audioId) await this.large.delete("journalAudio", note.audioId);
    await this.large.delete("journalNotes", id);
  }

  async deleteAllJournalData(): Promise<void> {
    await this.large.clear("journalNotes");
    await this.large.clear("journalAudio");
  }

  async getJournalConsent(): Promise<JournalConsent> {
    const stored = read<Partial<JournalConsent>>(KEYS.journalConsent, {});
    // Default OFF for every consumer — absent keys never grant access.
    return {
      coach: stored.coach === true,
      assessments: stored.assessments === true,
      lifeGraph: stored.lifeGraph === true,
    };
  }

  async saveJournalConsent(consent: JournalConsent): Promise<void> {
    write(KEYS.journalConsent, consent);
  }

  async getJournalAudio(audioId: string): Promise<string | null> {
    return (await this.large.get<string>("journalAudio", audioId)) ?? null;
  }

  async saveJournalAudio(audioId: string, dataUrl: string): Promise<void> {
    await this.large.put("journalAudio", audioId, dataUrl);
  }

  // -- Spending ------------------------------------------------------------------------
  async listSpending(date: ISODate): Promise<SpendingEntry[]> {
    return read<SpendingEntry[]>(KEYS.spending, []).filter((s) => s.date === date);
  }

  async listSpendingRange(from: ISODate, to: ISODate): Promise<SpendingEntry[]> {
    return read<SpendingEntry[]>(KEYS.spending, []).filter((s) => inRange(s.date, from, to));
  }

  async saveSpending(s: SpendingEntry): Promise<void> {
    const all = read<SpendingEntry[]>(KEYS.spending, []);
    const i = all.findIndex((e) => e.id === s.id);
    if (i >= 0) all[i] = s;
    else all.push(s);
    write(KEYS.spending, all);
  }

  async deleteSpending(id: string): Promise<void> {
    write(
      KEYS.spending,
      read<SpendingEntry[]>(KEYS.spending, []).filter((s) => s.id !== id)
    );
  }

  async getSundayReview(date: ISODate): Promise<SundayReview | null> {
    return read<SundayReview[]>(KEYS.sundayReviews, []).find((r) => r.date === date) ?? null;
  }

  async saveSundayReview(r: SundayReview): Promise<void> {
    const all = read<SundayReview[]>(KEYS.sundayReviews, []);
    const i = all.findIndex((e) => e.date === r.date);
    if (i >= 0) all[i] = r;
    else all.push(r);
    write(KEYS.sundayReviews, all);
  }

  async listSundayReviews(): Promise<SundayReview[]> {
    return read<SundayReview[]>(KEYS.sundayReviews, []).sort((a, b) => a.date.localeCompare(b.date));
  }

  // -- Money planning (E13) ----------------------------------------------------------
  async listRecurringExpenses(): Promise<RecurringExpense[]> {
    return read<RecurringExpense[]>(KEYS.recurringExpenses, []);
  }

  async saveRecurringExpense(e: RecurringExpense): Promise<void> {
    const all = read<RecurringExpense[]>(KEYS.recurringExpenses, []).filter((x) => x.id !== e.id);
    all.push(e);
    write(KEYS.recurringExpenses, all);
  }

  async deleteRecurringExpense(id: string): Promise<void> {
    write(
      KEYS.recurringExpenses,
      read<RecurringExpense[]>(KEYS.recurringExpenses, []).filter((x) => x.id !== id)
    );
  }

  async listDebts(): Promise<DebtItem[]> {
    return read<DebtItem[]>(KEYS.debts, []);
  }

  async saveDebt(d: DebtItem): Promise<void> {
    const all = read<DebtItem[]>(KEYS.debts, []).filter((x) => x.id !== d.id);
    all.push(d);
    write(KEYS.debts, all);
  }

  async deleteDebt(id: string): Promise<void> {
    write(KEYS.debts, read<DebtItem[]>(KEYS.debts, []).filter((x) => x.id !== id));
  }

  async listSavingsGoals(): Promise<SavingsGoal[]> {
    return read<SavingsGoal[]>(KEYS.savingsGoals, []);
  }

  async saveSavingsGoal(g: SavingsGoal): Promise<void> {
    const all = read<SavingsGoal[]>(KEYS.savingsGoals, []).filter((x) => x.id !== g.id);
    all.push(g);
    write(KEYS.savingsGoals, all);
  }

  async deleteSavingsGoal(id: string): Promise<void> {
    write(KEYS.savingsGoals, read<SavingsGoal[]>(KEYS.savingsGoals, []).filter((x) => x.id !== id));
  }

  async getMoneySettings(): Promise<MoneySettings> {
    return read<MoneySettings>(KEYS.moneySettings, {
      monthlyIncome: 0,
      emergencyFundTarget: 0,
      emergencyFundSaved: 0,
      monthlySavingsContribution: 0,
      categoryCaps: {},
    });
  }

  async saveMoneySettings(s: MoneySettings): Promise<void> {
    write(KEYS.moneySettings, s);
  }

  async listPendingPurchases(): Promise<PendingPurchase[]> {
    return read<PendingPurchase[]>(KEYS.pendingPurchases, []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  }

  async savePendingPurchase(p: PendingPurchase): Promise<void> {
    const all = read<PendingPurchase[]>(KEYS.pendingPurchases, []).filter((x) => x.id !== p.id);
    all.push(p);
    write(KEYS.pendingPurchases, all);
  }

  async deletePendingPurchase(id: string): Promise<void> {
    write(
      KEYS.pendingPurchases,
      read<PendingPurchase[]>(KEYS.pendingPurchases, []).filter((x) => x.id !== id)
    );
  }

  // -- Skills ------------------------------------------------------------------------------
  async listSkillTasks(from: ISODate, to: ISODate): Promise<SkillTask[]> {
    return read<SkillTask[]>(KEYS.skillTasks, []).filter((t) => inRange(t.date, from, to));
  }

  async saveSkillTask(t: SkillTask): Promise<void> {
    const all = read<SkillTask[]>(KEYS.skillTasks, []);
    const i = all.findIndex((e) => e.id === t.id);
    if (i >= 0) all[i] = t;
    else all.push(t);
    write(KEYS.skillTasks, all);
  }

  async deleteSkillTask(id: string): Promise<void> {
    write(
      KEYS.skillTasks,
      read<SkillTask[]>(KEYS.skillTasks, []).filter((t) => t.id !== id)
    );
  }

  async getCheckedBooks(): Promise<number[]> {
    return read<number[]>(KEYS.books, []);
  }

  async saveCheckedBooks(weeks: number[]): Promise<void> {
    write(KEYS.books, weeks);
  }

  // -- Notifications (E9) ----------------------------------------------------------
  async getNotificationLog(): Promise<Record<string, ISODate>> {
    return read<Record<string, ISODate>>(KEYS.notificationLog, {});
  }

  async saveNotificationLog(log: Record<string, ISODate>): Promise<void> {
    write(KEYS.notificationLog, log);
  }

  // -- Health (E7) ---------------------------------------------------------------
  async listBloodPressure(from: ISODate, to: ISODate): Promise<BloodPressureEntry[]> {
    return read<BloodPressureEntry[]>(KEYS.bloodPressure, [])
      .filter((e) => inRange(e.date, from, to))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }

  async saveBloodPressure(entry: BloodPressureEntry): Promise<void> {
    const all = read<BloodPressureEntry[]>(KEYS.bloodPressure, []).filter((e) => e.id !== entry.id);
    all.push(entry);
    write(KEYS.bloodPressure, all);
  }

  async deleteBloodPressure(id: string): Promise<void> {
    write(KEYS.bloodPressure, read<BloodPressureEntry[]>(KEYS.bloodPressure, []).filter((e) => e.id !== id));
  }

  async listHealthMarkers(from: ISODate, to: ISODate): Promise<HealthMarkerEntry[]> {
    return read<HealthMarkerEntry[]>(KEYS.healthMarkers, [])
      .filter((e) => inRange(e.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async saveHealthMarker(entry: HealthMarkerEntry): Promise<void> {
    const all = read<HealthMarkerEntry[]>(KEYS.healthMarkers, []).filter((e) => e.id !== entry.id);
    all.push(entry);
    write(KEYS.healthMarkers, all);
  }

  async listBloodwork(): Promise<BloodworkReport[]> {
    const all = await this.large.list<BloodworkReport>("bloodwork");
    return Object.values(all).sort((a, b) => b.date.localeCompare(a.date));
  }

  async saveBloodwork(report: BloodworkReport): Promise<void> {
    await this.large.put("bloodwork", report.id, report);
  }

  async deleteBloodwork(id: string): Promise<void> {
    await this.large.delete("bloodwork", id);
  }

  // -- Relationships (E11) ---------------------------------------------------------
  async listRelationshipCheckIns(from: ISODate, to: ISODate): Promise<RelationshipCheckIn[]> {
    return read<RelationshipCheckIn[]>(KEYS.relationshipCheckIns, [])
      .filter((c) => inRange(c.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async saveRelationshipCheckIn(checkIn: RelationshipCheckIn): Promise<void> {
    const all = read<RelationshipCheckIn[]>(KEYS.relationshipCheckIns, []).filter(
      (c) => c.date !== checkIn.date
    );
    all.push(checkIn);
    write(KEYS.relationshipCheckIns, all);
  }

  async listConflictDebriefs(): Promise<ConflictDebrief[]> {
    const all = await this.large.list<ConflictDebrief>("conflictDebriefs");
    return Object.values(all).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveConflictDebrief(debrief: ConflictDebrief): Promise<void> {
    await this.large.put("conflictDebriefs", debrief.id, debrief);
  }

  async listIncidents(): Promise<IncidentEntry[]> {
    const all = await this.large.list<IncidentEntry>("incidents");
    return Object.values(all).sort((a, b) => b.date.localeCompare(a.date));
  }

  async saveIncident(entry: IncidentEntry): Promise<void> {
    await this.large.put("incidents", entry.id, entry);
  }

  async deleteIncident(id: string): Promise<void> {
    await this.large.delete("incidents", id);
  }

  // -- Social connection (E12) -----------------------------------------------------
  async listOutreach(from: ISODate, to: ISODate): Promise<OutreachEntry[]> {
    return read<OutreachEntry[]>(KEYS.outreach, [])
      .filter((o) => inRange(o.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async saveOutreach(entry: OutreachEntry): Promise<void> {
    const all = read<OutreachEntry[]>(KEYS.outreach, []);
    all.push(entry);
    write(KEYS.outreach, all);
  }

  async listReconnect(): Promise<ReconnectPerson[]> {
    return read<ReconnectPerson[]>(KEYS.reconnectList, []);
  }

  async saveReconnect(list: ReconnectPerson[]): Promise<void> {
    write(KEYS.reconnectList, list);
  }

  async listSocialReflections(): Promise<SocialReflection[]> {
    return read<SocialReflection[]>(KEYS.socialReflections, []).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  async saveSocialReflection(r: SocialReflection): Promise<void> {
    const all = read<SocialReflection[]>(KEYS.socialReflections, []);
    all.push(r);
    write(KEYS.socialReflections, all);
  }

  async getSocialSettings(): Promise<SocialSettings> {
    return read<SocialSettings>(KEYS.socialSettings, {
      friendshipGoal: "",
      weeklyOutreachTarget: 3,
    });
  }

  async saveSocialSettings(s: SocialSettings): Promise<void> {
    write(KEYS.socialSettings, s);
  }

  // -- Protocols (v3 Phase 6 — prescribed-therapy records) ----------------------------
  async getProtocolSettings(): Promise<ProtocolSettings> {
    const s = read<ProtocolSettings | null>(KEYS.protocolSettings, null);
    const settings =
      s ?? { enabled: false, prescribedConfirmed: false, localOnly: false, lockEnabled: false, lockCredentialId: null };
    setProtocolLocalOnly(settings.localOnly);
    return settings;
  }

  async saveProtocolSettings(s: ProtocolSettings): Promise<void> {
    setProtocolLocalOnly(s.localOnly);
    write(KEYS.protocolSettings, s);
  }

  async listCompounds(): Promise<Compound[]> {
    return read<Compound[]>(KEYS.compounds, []);
  }

  async saveCompound(c: Compound): Promise<void> {
    const list = read<Compound[]>(KEYS.compounds, []).filter((x) => x.id !== c.id);
    write(KEYS.compounds, [...list, c]);
  }

  async deleteCompound(id: string): Promise<void> {
    write(KEYS.compounds, read<Compound[]>(KEYS.compounds, []).filter((x) => x.id !== id));
    // Schedules for a deleted compound go with it; dose history stays (a record).
    write(
      KEYS.protocolSchedules,
      read<ProtocolSchedule[]>(KEYS.protocolSchedules, []).filter((x) => x.compoundId !== id)
    );
  }

  async listProtocolSchedules(): Promise<ProtocolSchedule[]> {
    return read<ProtocolSchedule[]>(KEYS.protocolSchedules, []);
  }

  async saveProtocolSchedule(s: ProtocolSchedule): Promise<void> {
    const list = read<ProtocolSchedule[]>(KEYS.protocolSchedules, []).filter((x) => x.id !== s.id);
    write(KEYS.protocolSchedules, [...list, s]);
  }

  async deleteProtocolSchedule(id: string): Promise<void> {
    write(
      KEYS.protocolSchedules,
      read<ProtocolSchedule[]>(KEYS.protocolSchedules, []).filter((x) => x.id !== id)
    );
  }

  async listDoseEvents(from: ISODate, to: ISODate): Promise<DoseEvent[]> {
    const all = await this.large.list<DoseEvent>("doseEvents");
    return Object.values(all)
      .filter((d) => {
        const day = d.timestamp.slice(0, 10);
        return day >= from && day <= to;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async saveDoseEvent(d: DoseEvent): Promise<void> {
    await this.large.put("doseEvents", d.id, { ...d, updatedAt: new Date().toISOString() });
  }

  async deleteDoseEvent(id: string): Promise<void> {
    await this.large.delete("doseEvents", id);
  }

  async listLabPanels(): Promise<LabPanel[]> {
    const all = await this.large.list<LabPanel>("labPanels");
    return Object.values(all).sort((a, b) => b.date.localeCompare(a.date));
  }

  async saveLabPanel(p: LabPanel): Promise<void> {
    await this.large.put("labPanels", p.id, { ...p, updatedAt: new Date().toISOString() });
  }

  async deleteLabPanel(id: string): Promise<void> {
    await this.large.delete("labPanels", id);
  }

  // -- LifeGraph surfacing log (v3 Phase 5) -------------------------------------------
  async getPatternLog(): Promise<Record<string, ISODate>> {
    return read<Record<string, ISODate>>(KEYS.patternLog, {});
  }

  async savePatternLog(log: Record<string, ISODate>): Promise<void> {
    write(KEYS.patternLog, log);
  }

  // -- Food cache + meal photos (v3 Phase 4) -----------------------------------------
  async listFoodCache(): Promise<CachedFood[]> {
    return read<CachedFood[]>(KEYS.foodCache, []);
  }

  async saveFoodCacheItem(item: CachedFood): Promise<void> {
    const list = read<CachedFood[]>(KEYS.foodCache, []).filter((f) => f.id !== item.id);
    // Most-recent first, capped so repeats stay instant without growing forever.
    write(KEYS.foodCache, [item, ...list].slice(0, 50));
  }

  // -- Media discipline (v3.3 §3.4) ---------------------------------------------

  async saveBodyPhoto(metricId: string, dataUrl: string): Promise<void> {
    await this.cleanupRemovedLarge();
    await this.large.put("bodyPhotos", metricId, dataUrl);
  }

  async getBodyPhoto(metricId: string): Promise<string | null> {
    await this.relocateEmbeddedBodyPhotos();
    return (await this.large.get<string>("bodyPhotos", metricId)) ?? null;
  }

  async getMediaPrefs(): Promise<MediaPrefs> {
    const stored = read<Partial<MediaPrefs>>(KEYS.mediaPrefs, {});
    return { syncVoice: stored.syncVoice === true };
  }

  async saveMediaPrefs(prefs: MediaPrefs): Promise<void> {
    write(KEYS.mediaPrefs, prefs);
    setVoiceSyncOptIn(prefs.syncVoice);
  }

  async mediaUsageBytes(): Promise<number> {
    let total = 0;
    for (const collection of ["journalAudio", "mealPhotos", "bodyPhotos"]) {
      const records = await this.large.list<unknown>(collection);
      for (const value of Object.values(records)) {
        if (typeof value === "string") {
          // Data URLs are base64: ~3 bytes per 4 characters.
          total += Math.round(value.length * 0.75);
        }
      }
    }
    return total;
  }

  /**
   * One-time §3.4 relocation: pre-v3.3 body metrics embedded the photo data
   * URL in the metric record (localStorage). Move each into the large
   * store, blank the legacy field, and mark hasPhoto. Idempotent — a moved
   * record has no photoUrl left to move.
   */
  private photosRelocated = false;

  private async relocateEmbeddedBodyPhotos(): Promise<void> {
    if (this.photosRelocated || !canUseStorage()) return;
    this.photosRelocated = true;
    try {
      const all = read<Record<string, BodyMetric>>(KEYS.bodyMetrics, {});
      let changed = false;
      for (const metric of Object.values(all)) {
        if (metric.photoUrl) {
          await this.large.put("bodyPhotos", metric.id, metric.photoUrl);
          metric.photoUrl = "";
          metric.hasPhoto = true;
          changed = true;
        }
      }
      if (changed) write(KEYS.bodyMetrics, all);
    } catch {
      this.photosRelocated = false;
    }
  }

  async saveMealPhoto(mealId: string, dataUrl: string): Promise<void> {
    await this.large.put("mealPhotos", mealId, dataUrl);
  }

  async getMealPhoto(mealId: string): Promise<string | null> {
    return (await this.large.get<string>("mealPhotos", mealId)) ?? null;
  }

  // -- Assessments (E10) -----------------------------------------------------------
  async listAssessmentResults(): Promise<AssessmentResult[]> {
    await this.cleanupRemovedLarge();
    const all = await this.large.list<AssessmentResult>("assessmentResults");
    return Object.values(all).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveAssessmentResult(result: AssessmentResult): Promise<void> {
    await this.large.put("assessmentResults", result.id, {
      ...result,
      updatedAt: new Date().toISOString(),
    });
  }

  async getAssessmentProgress(id: AssessmentId): Promise<AssessmentProgress | null> {
    return (await this.large.get<AssessmentProgress>("assessmentProgress", id)) ?? null;
  }

  async saveAssessmentProgress(progress: AssessmentProgress): Promise<void> {
    await this.large.put("assessmentProgress", progress.assessmentId, progress);
  }

  async clearAssessmentProgress(id: AssessmentId): Promise<void> {
    await this.large.delete("assessmentProgress", id);
  }

  // -- Body metrics ------------------------------------------------------------------------
  async getBodyMetric(date: ISODate): Promise<BodyMetric | null> {
    await this.relocateEmbeddedBodyPhotos();
    return read<Record<ISODate, BodyMetric>>(KEYS.bodyMetrics, {})[date] ?? null;
  }

  async saveBodyMetric(m: BodyMetric): Promise<void> {
    const all = read<Record<ISODate, BodyMetric>>(KEYS.bodyMetrics, {});
    all[m.date] = m;
    write(KEYS.bodyMetrics, all);
  }

  async listBodyMetrics(from: ISODate, to: ISODate): Promise<BodyMetric[]> {
    await this.relocateEmbeddedBodyPhotos();
    return Object.values(read<Record<ISODate, BodyMetric>>(KEYS.bodyMetrics, {}))
      .filter((m) => inRange(m.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // -- AI reviews --------------------------------------------------------------------------
  async getAIReview(date: ISODate): Promise<AIReview | null> {
    return read<Record<ISODate, AIReview>>(KEYS.aiReviews, {})[date] ?? null;
  }

  async saveAIReview(r: AIReview): Promise<void> {
    const all = read<Record<ISODate, AIReview>>(KEYS.aiReviews, {});
    all[r.date] = r;
    write(KEYS.aiReviews, all);
  }

  async listAIReviews(from: ISODate, to: ISODate): Promise<AIReview[]> {
    return Object.values(read<Record<ISODate, AIReview>>(KEYS.aiReviews, {}))
      .filter((r) => inRange(r.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
