import type {
  DailyLog,
  DomainToggles,
  MvdDefinition,
  NotificationPrefs,
  UserProfile,
} from "@/lib/types";
import { toISODate } from "@/lib/utils";

/**
 * De-personalized universal defaults (E5). v1 shipped one user's bulking
 * targets (3050 kcal / 170g / "Gain 4–8 lb") and injury flags as app-wide
 * defaults — flagged in the spec's personalization audit. Defaults now assume
 * nothing: moderate targets, maintain goal, no pre-checked injuries.
 * Onboarding's target estimator (lib/engine/targets.ts) personalizes from the
 * user's own stats.
 */
export const DEFAULT_CALORIE_TARGET = 2400;
export const DEFAULT_PROTEIN_TARGET = 140;
export const DEFAULT_WATER_TARGET_ML = 2500;
export const DEFAULT_DAILY_SPENDING_LIMIT = 50;
export const DEFAULT_WEIGHT_GOAL = "Maintain current weight";
export const DEFAULT_SLEEP_TARGET_HOURS = 7.5;
export const PROGRAM_LENGTH_DAYS = 30;

/** All domains on until the user says otherwise. */
export const DEFAULT_DOMAINS: DomainToggles = {
  nutrition: true,
  training: true,
  mind: true,
  money: true,
  skills: true,
  health: true,
  relationships: true,
  social: true,
};

/** Default Minimum Viable Day: one meal + the 2-minute check-in. */
export const DEFAULT_MVD: MvdDefinition = {
  meal: true,
  checkIn: true,
  water: false,
  movement: false,
};

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  morningPlan: true,
  eveningReview: true,
  streakReminder: false,
  weeklyReport: true,
};

export function defaultProfile(): UserProfile {
  return {
    name: "",
    startDate: toISODate(),
    calorieTarget: DEFAULT_CALORIE_TARGET,
    proteinTarget: DEFAULT_PROTEIN_TARGET,
    waterTarget: DEFAULT_WATER_TARGET_ML,
    weightGoal: DEFAULT_WEIGHT_GOAL,
    painFlags: {
      thoracic: false,
      rib: false,
      scapular: false,
      upperTrapDominant: false,
      leftArmAggravation: false,
    },
    dailySpendingLimit: DEFAULT_DAILY_SPENDING_LIMIT,
    sleepTargetHours: DEFAULT_SLEEP_TARGET_HOURS,
    primaryGoal: "generalReset",
    secondaryGoals: [],
    domains: { ...DEFAULT_DOMAINS },
    mvd: { ...DEFAULT_MVD },
    notifications: { ...DEFAULT_NOTIFICATIONS },
    onboardingComplete: false,
  };
}

export function emptyDailyLog(date: string): DailyLog {
  return {
    date,
    forgeScore: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    waterMl: 0,
    workoutStatus: "notStarted",
    steps: 0,
    sleepHours: 0,
    mobilityDone: false,
    spendingChecked: false,
    mood: 0,
    stress: 0,
    painScore: 0,
    skillMinutes: 0,
    journalDone: false,
    calendarState: "missed",
  };
}
