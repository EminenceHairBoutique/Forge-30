import type { ISODate, MealPlanDay } from "@/lib/types";
import { mondayWeekday } from "@/lib/utils";

/**
 * Default 7-day meal plan, repeated ×4 across the 30 days. Macros are
 * realistic estimates sized so M1 + M2 + the standard whey-shake add-on
 * (~705 kcal / 46g protein, see quickAdds.ts) lands near 3050 kcal / 170g
 * protein. Every meal targets 40–70g protein.
 */
export const MEAL_PLAN: MealPlanDay[] = [
  {
    weekday: 0,
    label: "Monday",
    meals: [
      {
        slot: "meal1",
        name: "Chicken rice bowl",
        ingredients: ["chicken thigh/breast", "jasmine rice", "broccoli", "olive oil"],
        calories: 1150,
        protein: 65,
        carbs: 120,
        fats: 38,
      },
      {
        slot: "meal2",
        name: "Beef pasta",
        ingredients: ["lean ground beef", "pasta", "marinara", "spinach"],
        calories: 1200,
        protein: 62,
        carbs: 118,
        fats: 42,
      },
    ],
  },
  {
    weekday: 1,
    label: "Tuesday",
    meals: [
      {
        slot: "meal1",
        name: "Turkey egg breakfast bowl",
        ingredients: ["ground turkey", "eggs", "potatoes", "peppers"],
        calories: 1100,
        protein: 62,
        carbs: 95,
        fats: 44,
      },
      {
        slot: "meal2",
        name: "Salmon rice plate",
        ingredients: ["salmon", "rice", "asparagus", "avocado"],
        calories: 1250,
        protein: 60,
        carbs: 110,
        fats: 55,
      },
    ],
  },
  {
    weekday: 2,
    label: "Wednesday",
    meals: [
      {
        slot: "meal1",
        name: "Steak burrito bowl",
        ingredients: ["steak", "rice", "beans", "corn", "salsa"],
        calories: 1200,
        protein: 66,
        carbs: 125,
        fats: 40,
      },
      {
        slot: "meal2",
        name: "Chicken teriyaki",
        ingredients: ["chicken", "rice", "green beans", "teriyaki sauce"],
        calories: 1150,
        protein: 64,
        carbs: 135,
        fats: 30,
      },
    ],
  },
  {
    weekday: 3,
    label: "Thursday",
    meals: [
      {
        slot: "meal1",
        name: "Greek chicken wrap",
        ingredients: ["chicken", "pita", "tzatziki", "cucumber", "rice (side)"],
        calories: 1150,
        protein: 63,
        carbs: 115,
        fats: 40,
      },
      {
        slot: "meal2",
        name: "Turkey meatballs",
        ingredients: ["ground turkey", "pasta", "marinara", "parmesan"],
        calories: 1200,
        protein: 64,
        carbs: 120,
        fats: 40,
      },
    ],
  },
  {
    weekday: 4,
    label: "Friday",
    meals: [
      {
        slot: "meal1",
        name: "Shrimp fried rice",
        ingredients: ["shrimp", "eggs", "rice", "peas", "carrots"],
        calories: 1100,
        protein: 58,
        carbs: 130,
        fats: 34,
      },
      {
        slot: "meal2",
        name: "Beef sweet potato plate",
        ingredients: ["beef", "sweet potato", "salad"],
        calories: 1250,
        protein: 66,
        carbs: 105,
        fats: 50,
      },
    ],
  },
  {
    weekday: 5,
    label: "Saturday",
    meals: [
      {
        slot: "meal1",
        name: "Chicken pesto pasta",
        ingredients: ["chicken", "pasta", "pesto"],
        calories: 1250,
        protein: 65,
        carbs: 120,
        fats: 48,
      },
      {
        slot: "meal2",
        name: "Salmon or tuna rice bowl",
        ingredients: ["salmon or tuna", "rice", "cucumber", "avocado"],
        calories: 1100,
        protein: 60,
        carbs: 110,
        fats: 38,
      },
    ],
  },
  {
    weekday: 6,
    label: "Sunday",
    meals: [
      {
        slot: "meal1",
        name: "Steak, eggs & potatoes",
        ingredients: ["steak", "eggs", "potatoes"],
        calories: 1250,
        protein: 68,
        carbs: 90,
        fats: 60,
      },
      {
        slot: "meal2",
        name: "Chicken shawarma bowl",
        ingredients: ["chicken", "rice", "hummus", "salad"],
        calories: 1100,
        protein: 62,
        carbs: 115,
        fats: 35,
      },
    ],
  },
];

export function getMealPlanForDate(date: ISODate): MealPlanDay {
  return MEAL_PLAN[mondayWeekday(date)] ?? MEAL_PLAN[0]!;
}

/** Daily meal prep checklist (Section 5.2). */
export const PREP_CHECKLIST = [
  { id: "proteins", label: "Cook two proteins", sublabel: "e.g., chicken + beef" },
  { id: "carbs", label: "One large carb batch", sublabel: "rice / potatoes / pasta / sweet potato" },
  { id: "veg", label: "Prep two vegetables", sublabel: "" },
  {
    id: "sauce",
    label: "Add an adherence sauce",
    sublabel: "teriyaki, tzatziki, pesto, marinara, salsa, hot honey, garlic yogurt",
  },
  { id: "protein-check", label: "Each meal targets 40–70g protein", sublabel: "" },
] as const;

/** Deduplicated grocery list derived from the active week's meal plan. */
export function generateGroceryList(): { item: string; usedIn: string[] }[] {
  const map = new Map<string, Set<string>>();
  for (const day of MEAL_PLAN) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = ing.toLowerCase();
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(meal.name);
      }
    }
  }
  return [...map.entries()]
    .map(([item, meals]) => ({ item, usedIn: [...meals] }))
    .sort((a, b) => a.item.localeCompare(b.item));
}
