import type { ISODate, MealPlanDay, WorkoutDayPlan } from "@/lib/types";
import { getMealPlanForDate } from "@/lib/data/mealPlan";
import { getWorkoutPlanForDate } from "@/lib/data/workoutPlan";

export interface DailyPlan {
  meals: MealPlanDay;
  workout: WorkoutDayPlan;
}

/** The full prescribed plan for a date: meals + training. */
export function getDailyPlan(date: ISODate): DailyPlan {
  return {
    meals: getMealPlanForDate(date),
    workout: getWorkoutPlanForDate(date),
  };
}
