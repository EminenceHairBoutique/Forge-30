import { describe, expect, it } from "vitest";
import {
  parseProgramCsv,
  PROGRAM_CSV_COLUMNS,
  programCsv,
  programJson,
  splitCsvLine,
} from "./hybridExport";
import { HYBRID_WEEK } from "@/lib/data/hybridProgram";
import { MOBILITY_LIBRARY } from "@/lib/data/mobilityLibrary";

describe("program CSV export", () => {
  it("exports every program slot plus the mobility library with the spec'd columns", () => {
    const csv = programCsv();
    const lines = csv.trim().split("\n");
    const slotCount = HYBRID_WEEK.reduce((n, d) => n + d.exerciseIds.length, 0);
    // Header + one row per slot + one per mobility drill. Quoted newlines don't
    // exist in this dataset, so line-counting is safe.
    expect(lines.length).toBe(1 + slotCount + MOBILITY_LIBRARY.length);
    expect(splitCsvLine(lines[0]!)).toEqual([...PROGRAM_CSV_COLUMNS]);
    expect(csv).toContain("Barbell Bench Press");
    expect(csv).toContain("Foam-Roller Thoracic Extension");
    // RFC-4180: fields with commas are quoted.
    const bench = lines.find((l) => l.includes("Barbell Bench Press"))!;
    expect(splitCsvLine(bench)).toHaveLength(PROGRAM_CSV_COLUMNS.length);
  });

  it("exports valid JSON with the week, catalog, and mobility library", () => {
    const parsed = JSON.parse(programJson()) as {
      kind: string;
      week: unknown[];
      exercises: unknown[];
      mobility: unknown[];
    };
    expect(parsed.kind).toBe("hybrid-program");
    expect(parsed.week).toHaveLength(7);
    expect(parsed.mobility).toHaveLength(19);
    expect(parsed.exercises.length).toBeGreaterThan(40);
  });

  it("round-trips: the exported CSV re-imports cleanly", () => {
    const result = parseProgramCsv(programCsv());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.rows.length).toBeGreaterThan(50);
  });
});

describe("program CSV import validation", () => {
  const HEADER = "Day,Category,Exercise,Sets,Reps,Rest,Instructions";

  it("accepts a minimal valid template", () => {
    const result = parseProgramCsv(`${HEADER}\nMonday,strength,Incline Press,3,8–12,90 s,Press up and in`);
    expect(result.ok).toBe(true);
    expect(result.rows[0]).toMatchObject({ day: "Monday", exercise: "Incline Press", sets: 3 });
  });

  it("reports missing required columns by name", () => {
    const result = parseProgramCsv("Day,Exercise\nMonday,Bench");
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/"Category"/);
    expect(result.errors.join(" ")).toMatch(/"Sets"/);
    expect(result.errors.join(" ")).toMatch(/"Reps"/);
  });

  it("reports row problems with line numbers and keeps the good rows", () => {
    const result = parseProgramCsv(
      [
        HEADER,
        "Funday,strength,Bench,3,8", // bad day
        "Monday,cardio-blast,Bench,3,8", // bad category
        "Monday,strength,,3,8", // empty name
        "Monday,strength,Bench,ninety,8", // bad sets
        "Monday,strength,Bench,3,", // empty reps (no Duration column value either)
        "Tuesday,strength,Good Row,4,6–8",
      ].join("\n")
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(5);
    expect(result.errors[0]).toMatch(/Line 2: unknown Day "Funday"/);
    expect(result.errors[3]).toMatch(/Line 5: Sets "ninety"/);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.exercise).toBe("Good Row");
  });

  it("handles quoted fields with embedded commas and quotes", () => {
    const result = parseProgramCsv(
      `${HEADER}\nMonday,strength,"Bench, close grip",3,8,"90 s","Lower slow, press ""hard"""`
    );
    expect(result.ok).toBe(true);
    expect(result.rows[0]!.exercise).toBe("Bench, close grip");
    expect(result.rows[0]!.instructions).toBe('Lower slow, press "hard"');
  });

  it("rejects empty, oversized, and header-only files with useful messages", () => {
    expect(parseProgramCsv("").ok).toBe(false);
    expect(parseProgramCsv(HEADER).errors[0]).toMatch(/at least one exercise row/);
    expect(parseProgramCsv("x".repeat(600 * 1024)).errors[0]).toMatch(/too large/i);
    const manyRows = [HEADER, ...Array.from({ length: 501 }, () => "Monday,strength,Bench,3,8")].join("\n");
    expect(parseProgramCsv(manyRows).errors[0]).toMatch(/Too many rows/);
  });
});
