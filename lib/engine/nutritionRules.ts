import type { MacroSet } from "@/lib/types";
import { round1 } from "@/lib/utils";

export function calculateMacroTotals(entries: MacroSet[]): MacroSet {
  return entries.reduce<MacroSet>(
    (acc, e) => ({
      calories: Math.round(acc.calories + e.calories),
      protein: round1(acc.protein + e.protein),
      carbs: round1(acc.carbs + e.carbs),
      fats: round1(acc.fats + e.fats),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

export interface NutritionRecommendation {
  /** Remaining macros to hit today's targets (never negative). */
  stillNeed: MacroSet & { waterMl: number };
  /** Ordered, concrete suggestions for closing today's gap. */
  suggestions: string[];
  /** True when the 7-day weight trend is flat → surface "+250 kcal" banner. */
  addCaloriesBanner: boolean;
}

export function getNutritionRecommendation(args: {
  totals: MacroSet;
  waterMl: number;
  calorieTarget: number;
  proteinTarget: number;
  waterTarget: number;
  /** lb change across the trailing 7 days; null when not enough weigh-ins. */
  weightTrend7d: number | null;
}): NutritionRecommendation {
  const { totals, waterMl, calorieTarget, proteinTarget, waterTarget, weightTrend7d } = args;

  const needCalories = Math.max(0, calorieTarget - totals.calories);
  const needProtein = Math.max(0, round1(proteinTarget - totals.protein));
  const needWater = Math.max(0, waterTarget - waterMl);

  const suggestions: string[] = [];
  if (needProtein > 30) {
    suggestions.push(
      `You still need ${Math.round(needProtein)}g protein — a whey shake (whey, banana, peanut butter, milk) covers ~45g.`
    );
  } else if (needProtein > 0) {
    suggestions.push(`${Math.round(needProtein)}g protein to go — a Greek yogurt bowl closes it.`);
  }
  if (needCalories > 400) {
    suggestions.push(
      `Calories are ${needCalories} short. Add rice + olive oil to your next meal or a calorie-dense shake tonight.`
    );
  }
  if (needWater > 0) {
    suggestions.push(`${(needWater / 1000).toFixed(1)}L of water left — front-load it before the evening.`);
  }
  if (suggestions.length === 0) {
    suggestions.push("Targets hit. Keep the last meal clean and stop when the numbers are in.");
  }

  // Rule surfaced in the UI: flat 7-day weight trend on a gain goal → add 250 kcal.
  const addCaloriesBanner = weightTrend7d !== null && Math.abs(weightTrend7d) < 0.5;

  return {
    stillNeed: {
      calories: needCalories,
      protein: needProtein,
      carbs: 0,
      fats: 0,
      waterMl: needWater,
    },
    suggestions,
    addCaloriesBanner,
  };
}
