import type { DailyLog } from "@/lib/types";

/**
 * Detected-vs-manual merge policy (v3 Phase 3, pure). The hard rule, encoded:
 * passive data pre-fills, the user confirms. A detected value becomes a
 * SUGGESTION only where the log has no manual entry (0 = not logged, by the
 * DailyLog convention). A manual value is never overwritten — not silently,
 * not at all; accepting a suggestion is an explicit tap that writes through
 * the normal daily-log path.
 */

export interface DetectedSuggestion {
  field: "sleepHours" | "steps";
  label: string;
  /** The detected value, already rounded for display. */
  value: number;
  unit: string;
}

export function detectedSuggestions(
  log: Pick<DailyLog, "sleepHours" | "steps">,
  detected: { sleepHours: number | null; steps: number | null }
): DetectedSuggestion[] {
  const out: DetectedSuggestion[] = [];
  if (detected.sleepHours !== null && detected.sleepHours > 0 && log.sleepHours === 0) {
    out.push({
      field: "sleepHours",
      label: "Sleep detected",
      value: Math.round(detected.sleepHours * 2) / 2,
      unit: "h",
    });
  }
  if (detected.steps !== null && detected.steps > 0 && log.steps === 0) {
    out.push({ field: "steps", label: "Steps detected", value: Math.round(detected.steps), unit: "" });
  }
  return out;
}

/** The patch an accepted suggestion writes — nothing but its own field. */
export function acceptSuggestion(s: DetectedSuggestion): Partial<DailyLog> {
  return { [s.field]: s.value };
}
