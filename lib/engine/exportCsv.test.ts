import { describe, expect, it } from "vitest";
import { csvField, logsCsv, spendingCsv, toCsv, workoutsCsv } from "./exportCsv";
import type { DailyLog, SpendingEntry, WorkoutEntry } from "@/lib/types";

describe("csv escaping", () => {
  it("quotes fields with commas, quotes, and newlines; doubles quotes", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
    expect(csvField(3.5)).toBe("3.5");
    expect(csvField(false)).toBe("false");
  });

  it("toCsv emits a stable header and one line per row", () => {
    const out = toCsv([{ a: 1, b: "x,y" }, { a: 2 }], ["a", "b"]);
    expect(out).toBe('a,b\n1,"x,y"\n2,\n');
  });
});

describe("collection CSVs", () => {
  it("logsCsv keeps the documented column order", () => {
    const log = { date: "2026-07-05", forgeScore: 71, calories: 2200 } as DailyLog;
    const out = logsCsv([log]);
    expect(out.split("\n")[0]).toBe(
      "date,forgeScore,calories,protein,carbs,fats,waterMl,workoutStatus,steps,sleepHours,mobilityDone,spendingChecked,mood,stress,painScore,skillMinutes,journalDone,calendarState"
    );
    expect(out.split("\n")[1]?.startsWith("2026-07-05,71,2200")).toBe(true);
  });

  it("workoutsCsv flattens to one row per set", () => {
    const w = {
      date: "2026-07-04",
      splitLabel: "Push",
      status: "complete",
      exercises: [
        {
          exerciseId: "bench",
          sets: [
            { exerciseId: "bench", weight: 135, reps: 8, rpe: 8, painScore: 0, note: "" },
            { exerciseId: "bench", weight: 145, reps: 6, rpe: 9, painScore: 0, note: "grindy" },
          ],
        },
      ],
    } as unknown as WorkoutEntry;
    const lines = workoutsCsv([w]).trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("2026-07-04,Push,complete,bench,1,135,8");
    expect(lines[2]).toContain("bench,2,145,6,9,0,grindy");
  });

  it("spendingCsv escapes free-text notes", () => {
    const e = {
      id: "s1",
      date: "2026-07-05",
      amount: 12.5,
      category: "food",
      necessary: false,
      business: false,
      stressPurchase: true,
      note: 'late night, "treat"',
      loggedAt: "2026-07-05T22:10:00.000Z",
    } as SpendingEntry;
    const out = spendingCsv([e]);
    expect(out).toContain('"late night, ""treat"""');
  });
});
