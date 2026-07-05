import type {
  BodyMetric,
  DailyLog,
  MealEntry,
  SpendingEntry,
  WorkoutEntry,
} from "@/lib/types";

/**
 * Per-collection CSV export (v3.3 §3.3) — pure. Columns are explicit and
 * stable so a spreadsheet built against one export still opens the next.
 * RFC-4180-style escaping: fields containing commas, quotes, or newlines
 * are quoted, quotes doubled.
 */

export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.map(csvField).join(",");
  const body = rows.map((r) => columns.map((c) => csvField(r[c])).join(","));
  return [header, ...body].join("\n") + "\n";
}

export function logsCsv(logs: DailyLog[]): string {
  return toCsv(logs as unknown as Array<Record<string, unknown>>, [
    "date",
    "forgeScore",
    "calories",
    "protein",
    "carbs",
    "fats",
    "waterMl",
    "workoutStatus",
    "steps",
    "sleepHours",
    "mobilityDone",
    "spendingChecked",
    "mood",
    "stress",
    "painScore",
    "skillMinutes",
    "journalDone",
    "calendarState",
  ]);
}

export function mealsCsv(meals: MealEntry[]): string {
  return toCsv(meals as unknown as Array<Record<string, unknown>>, [
    "date",
    "slot",
    "name",
    "calories",
    "protein",
    "carbs",
    "fats",
    "loggedAt",
  ]);
}

export function workoutsCsv(workouts: WorkoutEntry[]): string {
  // One row per set — the analyzable grain.
  const rows = workouts.flatMap((w) =>
    w.exercises.flatMap((e) =>
      e.sets.map((s, i) => ({
        date: w.date,
        splitLabel: w.splitLabel,
        status: w.status,
        exerciseId: e.exerciseId,
        setNumber: i + 1,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        painScore: s.painScore,
        note: s.note,
      }))
    )
  );
  return toCsv(rows, [
    "date",
    "splitLabel",
    "status",
    "exerciseId",
    "setNumber",
    "weight",
    "reps",
    "rpe",
    "painScore",
    "note",
  ]);
}

export function spendingCsv(entries: SpendingEntry[]): string {
  return toCsv(entries as unknown as Array<Record<string, unknown>>, [
    "date",
    "amount",
    "category",
    "necessary",
    "stressPurchase",
    "note",
    "loggedAt",
  ]);
}

export function metricsCsv(metrics: BodyMetric[]): string {
  return toCsv(metrics as unknown as Array<Record<string, unknown>>, [
    "date",
    "weightLb",
    "waistIn",
    "chestIn",
    "armsIn",
    "legsIn",
    "energy",
    "soreness",
  ]);
}
