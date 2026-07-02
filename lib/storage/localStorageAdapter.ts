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
import type { StorageAdapter } from "./adapter";

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
  aiReviews: `${PREFIX}:aiReviews`,
} as const;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
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

  // -- Body metrics ------------------------------------------------------------------------
  async getBodyMetric(date: ISODate): Promise<BodyMetric | null> {
    return read<Record<ISODate, BodyMetric>>(KEYS.bodyMetrics, {})[date] ?? null;
  }

  async saveBodyMetric(m: BodyMetric): Promise<void> {
    const all = read<Record<ISODate, BodyMetric>>(KEYS.bodyMetrics, {});
    all[m.date] = m;
    write(KEYS.bodyMetrics, all);
  }

  async listBodyMetrics(from: ISODate, to: ISODate): Promise<BodyMetric[]> {
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
