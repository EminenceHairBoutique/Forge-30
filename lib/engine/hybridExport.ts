import type { HybridDay, HybridExercise } from "@/lib/types";
import { toCsv } from "./exportCsv";
import { HYBRID_EXERCISES, HYBRID_WEEK, hybridExerciseById } from "@/lib/data/hybridProgram";
import { MOBILITY_LIBRARY } from "@/lib/data/mobilityLibrary";

/**
 * Hybrid program export + validated import (HT Phase 14, pure).
 * Export: the full program (and mobility library) as CSV with the spec'd
 * columns, or as JSON. Import: a validated CSV parser for admin-authored
 * program templates — imported data is a *template preview*, never silently
 * merged into the seeded program; errors are collected, not thrown.
 */

export const PROGRAM_CSV_COLUMNS = [
  "Day",
  "Category",
  "Exercise",
  "Purpose",
  "Sets",
  "Reps",
  "Duration",
  "Hold time",
  "Tempo",
  "Rest",
  "RPE",
  "Frequency",
  "Equipment",
  "Instructions",
  "Common mistakes",
  "Regression",
  "Progression",
  "Injury cautions",
] as const;

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const isDuration = (reps: string) => /min|m$|\bs\b/.test(reps) && !/×/.test(reps);

function exerciseRow(day: HybridDay, ex: HybridExercise): Record<string, unknown> {
  return {
    Day: WEEKDAY_NAMES[day.weekday] ?? day.label,
    Category: day.kind,
    Exercise: ex.name,
    Purpose: ex.qualities.join(" + "),
    Sets: ex.sets,
    Reps: isDuration(ex.reps) ? "" : ex.reps + (ex.perSide ? " per side" : ""),
    Duration: isDuration(ex.reps) ? ex.reps : "",
    "Hold time": ex.holdSeconds ? `${ex.holdSeconds} s` : "",
    Tempo: ex.tempo ?? "",
    Rest: ex.restSeconds
      ? ex.restSeconds[0] === ex.restSeconds[1]
        ? `${ex.restSeconds[0]} s`
        : `${ex.restSeconds[0]}–${ex.restSeconds[1]} s`
      : "",
    RPE: ex.rpe ?? "",
    Frequency: "weekly",
    Equipment: ex.equipment,
    Instructions: ex.steps.join(" | "),
    "Common mistakes": ex.mistakes.join(" | "),
    Regression: ex.regression ?? "",
    Progression: ex.progression ?? "",
    "Injury cautions": ex.cautions.join(", "),
  };
}

/** The complete weekly program (+ mobility library) as CSV. */
export function programCsv(): string {
  const rows: Array<Record<string, unknown>> = [];
  for (const day of HYBRID_WEEK) {
    for (const id of day.exerciseIds) {
      const ex = hybridExerciseById(id);
      if (ex) rows.push(exerciseRow(day, ex));
    }
  }
  for (const d of MOBILITY_LIBRARY) {
    rows.push({
      Day: "Any",
      Category: "mobility",
      Exercise: d.name,
      Purpose: d.purpose,
      Sets: d.sets,
      Reps: d.reps,
      Duration: "",
      "Hold time": d.holdSeconds ? `${d.holdSeconds} s` : "",
      Tempo: d.tempo ?? "",
      Rest: `${d.restSeconds} s`,
      RPE: "",
      Frequency: d.frequency,
      Equipment: d.equipment,
      Instructions: d.steps.join(" | "),
      "Common mistakes": d.mistakes.join(" | "),
      Regression: d.regression,
      Progression: d.progression,
      "Injury cautions": d.cautions.join(" "),
    });
  }
  return toCsv(rows, [...PROGRAM_CSV_COLUMNS]);
}

/** The complete program + mobility library as structured JSON. */
export function programJson(): string {
  return JSON.stringify(
    {
      app: "forge30",
      kind: "hybrid-program",
      exportedAt: null, // stamped by the caller (engines carry no clocks)
      week: HYBRID_WEEK,
      exercises: HYBRID_EXERCISES,
      mobility: MOBILITY_LIBRARY,
    },
    null,
    2
  );
}

// --- CSV import (admin program templates) -----------------------------------

export interface ImportedProgramRow {
  day: string;
  category: string;
  exercise: string;
  sets: number;
  reps: string;
  rest: string;
  instructions: string;
}

export interface ProgramImportResult {
  ok: boolean;
  rows: ImportedProgramRow[];
  errors: string[];
}

/** RFC-4180-ish CSV line splitter handling quoted fields with commas/quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const REQUIRED_IMPORT_COLUMNS = ["Day", "Category", "Exercise", "Sets", "Reps"] as const;
const VALID_DAYS = new Set([...WEEKDAY_NAMES, "Any"]);
const VALID_CATEGORIES = new Set(["strength", "athletic", "recovery", "mobility", "boxing"]);
const MAX_IMPORT_ROWS = 500;

/**
 * parseProgramCsv — validate an admin-authored template. Never throws;
 * returns every problem found with its line number so the author can fix the
 * file. Sanitization: numeric fields are coerced and bounded, text fields are
 * length-capped, and unknown columns are ignored (never executed or eval'd).
 */
export function parseProgramCsv(text: string): ProgramImportResult {
  const errors: string[] = [];
  const rows: ImportedProgramRow[] = [];

  if (text.length > 512 * 1024) {
    return { ok: false, rows: [], errors: ["File too large (512 KB max)."] };
  }
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, rows: [], errors: ["File needs a header row and at least one exercise row."] };
  }

  const header = splitCsvLine(lines[0]!).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  for (const required of REQUIRED_IMPORT_COLUMNS) {
    if (col(required) === -1) errors.push(`Missing required column "${required}".`);
  }
  if (errors.length > 0) return { ok: false, rows: [], errors };

  if (lines.length - 1 > MAX_IMPORT_ROWS) {
    return { ok: false, rows: [], errors: [`Too many rows (${lines.length - 1}); ${MAX_IMPORT_ROWS} max.`] };
  }

  const cap = (s: string, n = 500) => s.trim().slice(0, n);

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const get = (name: string) => cap(cells[col(name)] ?? "");
    const lineNo = i + 1;

    const day = get("Day");
    const category = get("Category").toLowerCase();
    const exercise = get("Exercise");
    const setsRaw = get("Sets");
    // Duration-based work exports with an empty Reps and a filled Duration —
    // either satisfies the dose requirement.
    const reps = get("Reps") || (col("Duration") >= 0 ? get("Duration") : "");

    if (!VALID_DAYS.has(day)) {
      errors.push(`Line ${lineNo}: unknown Day "${day}" (expected Monday–Sunday or Any).`);
      continue;
    }
    if (category && !VALID_CATEGORIES.has(category)) {
      errors.push(`Line ${lineNo}: unknown Category "${category}" (strength/athletic/recovery/mobility/boxing).`);
      continue;
    }
    if (exercise.length === 0) {
      errors.push(`Line ${lineNo}: Exercise name is empty.`);
      continue;
    }
    // Sets accepts a count ("4"), a range ("2–3"), or either with a unit
    // word ("1–2 rounds"); the low bound is kept.
    const setsMatch = setsRaw.match(/^(\d+)(\s*[–-]\s*\d+)?(\s+[a-zA-Z]+)?$/);
    const sets = setsMatch ? Number(setsMatch[1]) : NaN;
    if (setsRaw !== "" && (!Number.isFinite(sets) || sets < 0 || sets > 20)) {
      errors.push(`Line ${lineNo}: Sets "${setsRaw}" must be a whole number or range within 0–20.`);
      continue;
    }
    if (reps.length === 0) {
      errors.push(`Line ${lineNo}: Reps and Duration are both empty (one is required).`);
      continue;
    }

    rows.push({
      day,
      category: category || "strength",
      exercise,
      sets: setsRaw === "" ? 0 : sets,
      reps,
      rest: get("Rest"),
      instructions: get("Instructions"),
    });
  }

  return { ok: errors.length === 0 && rows.length > 0, rows, errors };
}
