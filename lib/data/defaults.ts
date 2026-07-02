import type { DailyLog, UserProfile } from "@/lib/types";
import { toISODate } from "@/lib/utils";

export const DEFAULT_CALORIE_TARGET = 3050;
export const DEFAULT_PROTEIN_TARGET = 170;
export const DEFAULT_WATER_TARGET_ML = 3000;
export const DEFAULT_DAILY_SPENDING_LIMIT = 50;
export const DEFAULT_WEIGHT_GOAL = "Gain 4–8 lb (lean-mass focus)";
export const PROGRAM_LENGTH_DAYS = 30;

export function defaultProfile(): UserProfile {
  return {
    name: "",
    startDate: toISODate(),
    calorieTarget: DEFAULT_CALORIE_TARGET,
    proteinTarget: DEFAULT_PROTEIN_TARGET,
    waterTarget: DEFAULT_WATER_TARGET_ML,
    weightGoal: DEFAULT_WEIGHT_GOAL,
    painFlags: {
      thoracic: true,
      rib: true,
      scapular: true,
      upperTrapDominant: true,
      leftArmAggravation: true,
    },
    dailySpendingLimit: DEFAULT_DAILY_SPENDING_LIMIT,
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
