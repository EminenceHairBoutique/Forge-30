import type {
  Biomarker,
  BloodPressureEntry,
  BloodworkReport,
  DailyLog,
  HealthMarkerEntry,
} from "@/lib/types";
import { findBiomarker } from "@/lib/data/biomarkers";
import { clamp } from "@/lib/utils";

/**
 * Health rules (E7) — AHA blood-pressure categories with the crisis flow,
 * the bloodwork paste parser, the educational bloodwork summary, and the
 * explainable Health Score. All pure; all copy educational, never diagnostic.
 *
 * This is one of the few places warning/danger colors are legitimate: BP
 * stage 2 and crisis are genuine safety signals (adherence-neutral rule).
 */

// --- Blood pressure -------------------------------------------------------------

export type BpCategory = "normal" | "elevated" | "stage1" | "stage2" | "crisis";

/**
 * AHA categories: normal <120 AND <80 · elevated 120–129 AND <80 ·
 * stage 1 130–139 OR 80–89 · stage 2 ≥140 OR ≥90 · crisis >180 AND/OR >120.
 * Higher category always wins when systolic/diastolic disagree.
 */
export function categorizeBloodPressure(systolic: number, diastolic: number): BpCategory {
  if (systolic > 180 || diastolic > 120) return "crisis";
  if (systolic >= 140 || diastolic >= 90) return "stage2";
  if (systolic >= 130 || diastolic >= 80) return "stage1";
  if (systolic >= 120) return "elevated";
  return "normal";
}

export const BP_CATEGORY_LABEL: Record<BpCategory, string> = {
  normal: "Normal",
  elevated: "Elevated",
  stage1: "Stage 1 range",
  stage2: "Stage 2 range",
  crisis: "Crisis range",
};

/** Emergency symptoms that turn a crisis reading into a call-now situation. */
export const EMERGENCY_SYMPTOMS = [
  "Chest pain",
  "Shortness of breath",
  "Back pain",
  "Numbness or weakness",
  "Vision changes",
  "Trouble speaking",
] as const;

export interface BpGuidance {
  /** Severity for UI tone: info (neutral) · warning · emergency. */
  severity: "info" | "warning" | "emergency";
  headline: string;
  body: string;
}

/**
 * Category guidance. Never diagnoses hypertension — categories describe the
 * *reading*, and every elevated tier points at technique + a clinician.
 * Crisis with emergency symptoms is an unambiguous "call emergency services".
 */
export function bpGuidance(category: BpCategory, hasEmergencySymptoms = false): BpGuidance {
  if (category === "crisis" && hasEmergencySymptoms) {
    return {
      severity: "emergency",
      headline: "Call emergency services now",
      body: "A reading in the crisis range together with symptoms like chest pain, shortness of breath, numbness, vision changes, or trouble speaking needs emergency care immediately. Do not wait and do not re-measure first.",
    };
  }
  switch (category) {
    case "crisis":
      return {
        severity: "emergency",
        headline: "Crisis-range reading",
        body: "Rest quietly for 5 minutes and measure again. If it stays above 180/120, contact your clinician or urgent care right away. If chest pain, shortness of breath, back pain, numbness, weakness, vision changes, or trouble speaking appear, call emergency services immediately.",
      };
    case "stage2":
      return {
        severity: "warning",
        headline: "Stage 2 range reading",
        body: "One reading is a data point, not a diagnosis. Sit quietly 5 minutes, feet flat, arm supported, and re-measure. Readings in this range that repeat across days are worth discussing with a clinician soon.",
      };
    case "stage1":
      return {
        severity: "warning",
        headline: "Stage 1 range reading",
        body: "Worth tracking, not alarming. Measure at consistent times (seated, rested, no caffeine within 30 minutes), and bring a week of readings to a clinician — patterns beat single numbers.",
      };
    case "elevated":
      return {
        severity: "info",
        headline: "Slightly elevated",
        body: "A reading a notch above normal. Context matters — caffeine, stress, and a full bladder all push readings up. Keep logging with context and watch the trend.",
      };
    default:
      return {
        severity: "info",
        headline: "Normal range",
        body: "In the normal range. Consistent technique keeps the trend meaningful: same time, seated, arm supported.",
      };
  }
}

// --- Bloodwork paste parser ------------------------------------------------------

/**
 * Parses pasted lab text, one marker per line. Recognized shapes:
 *   "Glucose 92 mg/dL (70-99)" · "HDL: 55 mg/dL 40-60" · "A1c 5.4 %"
 *   "Vitamin D, 25-OH: 41 ng/mL [30-100]"
 * The lab's own range is kept when present; otherwise the dictionary range
 * fills in. Unrecognized names still parse (name kept as typed) so no lab's
 * naming breaks entry. Lines with no numeric value are skipped.
 */
export function parseBloodworkText(text: string): Biomarker[] {
  const out: Biomarker[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Range anywhere on the line: (70-99), [30-100], or trailing "40-60".
    const rangeMatch = line.match(/[([]?\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*[)\]]?\s*$/);
    const refLow = rangeMatch ? Number(rangeMatch[1]) : null;
    const refHigh = rangeMatch ? Number(rangeMatch[2]) : null;
    const core = rangeMatch ? line.slice(0, rangeMatch.index).trim() : line;

    // "<name>[:] <value> [unit] [flag]"
    const m = core.match(
      /^(.+?)[:,]?\s+(-?\d+(?:\.\d+)?)\s*([A-Za-z%/()^0-9.]*)?\s*(H|L|HIGH|LOW)?\s*$/i
    );
    if (!m) continue;
    const [, rawName, rawValue, rawUnit, rawFlag] = m;
    const name = rawName!.replace(/[:,]\s*$/, "").trim();
    if (!name || !/[a-zA-Z]/.test(name)) continue;

    const def = findBiomarker(name);
    out.push({
      name: def?.name ?? name,
      value: Number(rawValue),
      unit: rawUnit?.trim() || def?.unit || "",
      refLow: refLow ?? def?.refLow ?? null,
      refHigh: refHigh ?? def?.refHigh ?? null,
      ...(rawFlag ? { labFlag: rawFlag.toUpperCase() } : {}),
    });
  }
  return out;
}

// --- Bloodwork summary + doctor questions ---------------------------------------

export type MarkerStatus = "inRange" | "belowRange" | "aboveRange" | "noRange";

export function markerStatus(m: Biomarker): MarkerStatus {
  if (m.refLow === null && m.refHigh === null) return "noRange";
  if (m.refLow !== null && m.value < m.refLow) return "belowRange";
  if (m.refHigh !== null && m.value > m.refHigh) return "aboveRange";
  return "inRange";
}

export interface BloodworkSummary {
  inRange: Biomarker[];
  outOfRange: { marker: Biomarker; status: MarkerStatus; relatesTo: string | null }[];
  noRange: Biomarker[];
  /** Educational, uncertainty-stated lines. Never diagnosis, never treatment. */
  lines: string[];
}

export function summarizeBloodwork(report: BloodworkReport): BloodworkSummary {
  const inRange: Biomarker[] = [];
  const noRange: Biomarker[] = [];
  const outOfRange: BloodworkSummary["outOfRange"] = [];

  for (const m of report.markers) {
    const status = markerStatus(m);
    if (status === "inRange") inRange.push(m);
    else if (status === "noRange") noRange.push(m);
    else outOfRange.push({ marker: m, status, relatesTo: findBiomarker(m.name)?.relatesTo ?? null });
  }

  const lines: string[] = [];
  if (report.markers.length === 0) {
    lines.push("No markers in this report yet.");
  } else {
    lines.push(
      `${inRange.length} of ${report.markers.length} markers are inside their reference range.`
    );
    for (const { marker, status, relatesTo } of outOfRange.slice(0, 6)) {
      const dir = status === "aboveRange" ? "above" : "below";
      lines.push(
        `${marker.name} is ${dir} the reference range (${marker.value} ${marker.unit})${
          relatesTo ? ` — this marker generally relates to ${relatesTo}` : ""
        }. Ranges vary by lab and individual context; this is not a diagnosis.`
      );
    }
    if (outOfRange.length > 0) {
      lines.push(
        "Out-of-range values are common and often benign, but they're exactly what a clinician visit is for — bring this report."
      );
    }
  }
  return { inRange, outOfRange, noRange, lines };
}

/** Doctor-visit questions generated from the out-of-range markers. */
export function doctorQuestions(report: BloodworkReport): string[] {
  const { outOfRange } = summarizeBloodwork(report);
  const qs = outOfRange
    .slice(0, 5)
    .map(
      ({ marker, status }) =>
        `My ${marker.name} came back ${status === "aboveRange" ? "above" : "below"} the lab's range at ${marker.value} ${marker.unit} — is that meaningful for me, and does it need follow-up?`
    );
  if (qs.length === 0 && report.markers.length > 0) {
    qs.push("Everything was in range — is there anything here you'd still keep an eye on for someone with my goals?");
  }
  if (report.markers.length > 0) {
    qs.push("Which of these markers are worth re-testing, and on what timeline?");
  }
  return qs;
}

// --- Health Score -----------------------------------------------------------------

export interface HealthScoreInputs {
  /** Mean daily steps over the window; null = not tracked. */
  avgSteps: number | null;
  /** Mean cardio minutes per day; null = not tracked. */
  avgCardioMinutes: number | null;
  /** Mean sleep hours; null = not tracked. */
  avgSleepHours: number | null;
  /** Latest BP category; null = no readings. */
  bpCategory: BpCategory | null;
  /** Latest A1c / fasting glucose status from bloodwork; null = none. */
  glucoseStatus: MarkerStatus | null;
  /** Worst lipid status from bloodwork (LDL/trigs/ApoB); null = none. */
  lipidStatus: MarkerStatus | null;
  /** 0–1 adherence to calorie+protein targets over the window; null = none. */
  nutritionAdherence: number | null;
  /** Mean resting HR; null = not tracked. */
  restingHR: number | null;
}

export interface HealthScoreComponent {
  key: string;
  label: string;
  points: number;
  max: number;
  /** False when this input isn't tracked — excluded and renormalized. */
  tracked: boolean;
}

export interface HealthScoreResult {
  /** 0–100 over the tracked components, or null when nothing is tracked. */
  score: number | null;
  components: HealthScoreComponent[];
}

/**
 * Assembles HealthScoreInputs from raw collections (pure — the page passes
 * what it fetched). Days without a logged value don't drag averages down;
 * an input with zero data stays null and renormalizes away.
 */
export function buildHealthScoreInputs(data: {
  logs: DailyLog[];
  bp: BloodPressureEntry[];
  markers: HealthMarkerEntry[];
  reports: BloodworkReport[];
  calorieTarget: number;
  proteinTarget: number;
}): HealthScoreInputs {
  const { logs, bp, markers, reports, calorieTarget, proteinTarget } = data;

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const steps = mean(logs.filter((l) => l.steps > 0).map((l) => l.steps));
  const sleep = mean(logs.filter((l) => l.sleepHours > 0).map((l) => l.sleepHours));
  const cardio = mean(
    markers
      .filter((m) => m.cardioMinutes !== null || m.zone2Minutes !== null)
      .map((m) => (m.cardioMinutes ?? 0) + (m.zone2Minutes ?? 0))
  );
  const rhr = mean(markers.filter((m) => m.restingHR !== null).map((m) => m.restingHR!));

  const latestBp = [...bp].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  ).at(-1);

  // Latest report's glucose/lipid marker statuses (worst of the group).
  const latest = [...reports].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const worst = (names: string[]): MarkerStatus | null => {
    const found = latest?.markers.filter((m) => names.includes(m.name)) ?? [];
    if (found.length === 0) return null;
    const statuses = found.map(markerStatus).filter((s) => s !== "noRange");
    if (statuses.length === 0) return null;
    return statuses.some((s) => s !== "inRange") ? "aboveRange" : "inRange";
  };

  // Days with any food logged, scored on how close they got to both targets.
  const fedDays = logs.filter((l) => l.calories > 0);
  const nutrition =
    fedDays.length === 0 || calorieTarget <= 0 || proteinTarget <= 0
      ? null
      : mean(
          fedDays.map(
            (l) =>
              (clamp(l.calories / calorieTarget, 0, 1) + clamp(l.protein / proteinTarget, 0, 1)) / 2
          )
        );

  return {
    avgSteps: steps,
    avgCardioMinutes: cardio,
    avgSleepHours: sleep,
    bpCategory: latestBp ? categorizeBloodPressure(latestBp.systolic, latestBp.diastolic) : null,
    glucoseStatus: worst(["Glucose", "A1c", "Fasting Insulin"]),
    lipidStatus: worst(["LDL", "Triglycerides", "ApoB", "Total Cholesterol"]),
    nutritionAdherence: nutrition,
    restingHR: rhr,
  };
}

/** Fraction [0,1] each tracked input earns. */
function healthFractions(i: HealthScoreInputs): { key: string; label: string; weight: number; fraction: number | null }[] {
  const movement =
    i.avgSteps === null && i.avgCardioMinutes === null
      ? null
      : Math.max(
          i.avgSteps !== null ? clamp(i.avgSteps / 8000, 0, 1) : 0,
          i.avgCardioMinutes !== null ? clamp(i.avgCardioMinutes / 30, 0, 1) : 0
        );
  const sleep = i.avgSleepHours === null ? null : clamp((i.avgSleepHours - 5) / 2.5, 0, 1);
  const bp =
    i.bpCategory === null
      ? null
      : { normal: 1, elevated: 0.75, stage1: 0.5, stage2: 0.25, crisis: 0 }[i.bpCategory];
  const statusFraction = (s: MarkerStatus | null) =>
    s === null ? null : s === "inRange" ? 1 : s === "noRange" ? null : 0.35;
  const recovery = i.restingHR === null ? null : clamp((80 - i.restingHR) / 30, 0, 1);

  return [
    { key: "movement", label: "Movement", weight: 20, fraction: movement },
    { key: "sleep", label: "Sleep", weight: 20, fraction: sleep },
    { key: "bp", label: "Blood pressure", weight: 15, fraction: bp },
    { key: "glucose", label: "Glucose markers", weight: 10, fraction: statusFraction(i.glucoseStatus) },
    { key: "lipids", label: "Lipid markers", weight: 10, fraction: statusFraction(i.lipidStatus) },
    { key: "nutrition", label: "Nutrition quality", weight: 15, fraction: i.nutritionAdherence === null ? null : clamp(i.nutritionAdherence, 0, 1) },
    { key: "recovery", label: "Recovery (resting HR)", weight: 10, fraction: recovery },
  ];
}

/**
 * Educational composite over whatever is actually tracked: untracked inputs
 * are excluded and the remaining weights renormalize to 100, so the score
 * never punishes not owning a BP cuff. Null when nothing is tracked at all.
 * Explained component-by-component via the ScoreRing pattern; never
 * diagnostic.
 */
export function calculateHealthScore(inputs: HealthScoreInputs): HealthScoreResult {
  const parts = healthFractions(inputs);
  const trackedWeight = parts.reduce((sum, p) => sum + (p.fraction !== null ? p.weight : 0), 0);

  // Score sums exact fractions and rounds once — per-component rounding is
  // display-only, so a fully perfect partial day always lands on exactly 100.
  let exact = 0;
  const components: HealthScoreComponent[] = parts.map((p) => {
    const tracked = p.fraction !== null;
    const max = tracked ? (p.weight / trackedWeight) * 100 : 0;
    if (tracked) exact += p.fraction! * max;
    return {
      key: p.key,
      label: p.label,
      points: tracked ? Math.round(p.fraction! * max) : 0,
      max: Math.round(max),
      tracked,
    };
  });

  if (trackedWeight === 0) return { score: null, components };
  return { score: clamp(Math.round(exact), 0, 100), components };
}
