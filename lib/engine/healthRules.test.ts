import { describe, expect, it } from "vitest";
import {
  bpGuidance,
  calculateHealthScore,
  categorizeBloodPressure,
  doctorQuestions,
  markerStatus,
  parseBloodworkText,
  summarizeBloodwork,
  type HealthScoreInputs,
} from "./healthRules";
import { checkSafetyCopy } from "./safetyCopy";
import type { BloodworkReport } from "@/lib/types";

describe("categorizeBloodPressure — every AHA boundary", () => {
  it("normal: <120 AND <80", () => {
    expect(categorizeBloodPressure(119, 79)).toBe("normal");
    expect(categorizeBloodPressure(100, 60)).toBe("normal");
  });

  it("elevated: 120–129 AND <80", () => {
    expect(categorizeBloodPressure(120, 79)).toBe("elevated");
    expect(categorizeBloodPressure(129, 79)).toBe("elevated");
  });

  it("stage 1: 130–139 OR 80–89 — either side triggers it", () => {
    expect(categorizeBloodPressure(130, 79)).toBe("stage1");
    expect(categorizeBloodPressure(139, 79)).toBe("stage1");
    expect(categorizeBloodPressure(119, 80)).toBe("stage1"); // diastolic alone
    expect(categorizeBloodPressure(125, 89)).toBe("stage1");
  });

  it("stage 2: ≥140 OR ≥90", () => {
    expect(categorizeBloodPressure(140, 79)).toBe("stage2");
    expect(categorizeBloodPressure(119, 90)).toBe("stage2");
    expect(categorizeBloodPressure(160, 100)).toBe("stage2");
    // Exactly 180/120 is stage 2 — crisis is strictly greater-than.
    expect(categorizeBloodPressure(180, 120)).toBe("stage2");
  });

  it("crisis: >180 and/or >120 — either side, always wins", () => {
    expect(categorizeBloodPressure(181, 70)).toBe("crisis");
    expect(categorizeBloodPressure(110, 121)).toBe("crisis");
    expect(categorizeBloodPressure(200, 130)).toBe("crisis");
  });
});

describe("bpGuidance — crisis flow", () => {
  it("crisis + emergency symptoms is an unambiguous call-now", () => {
    const g = bpGuidance("crisis", true);
    expect(g.severity).toBe("emergency");
    expect(g.headline.toLowerCase()).toContain("emergency");
    expect(g.body.toLowerCase()).toContain("immediately");
  });

  it("crisis without symptoms: re-measure, then urgent care — still emergency severity", () => {
    const g = bpGuidance("crisis", false);
    expect(g.severity).toBe("emergency");
    expect(g.body).toMatch(/measure again/i);
    expect(g.body).toMatch(/emergency services/i);
  });

  it("never diagnoses hypertension at any tier", () => {
    for (const cat of ["normal", "elevated", "stage1", "stage2", "crisis"] as const) {
      for (const symptoms of [false, true]) {
        const g = bpGuidance(cat, symptoms);
        const text = `${g.headline} ${g.body}`;
        // Disclaiming diagnosis ("not a diagnosis") is required; claiming one is not.
        expect(text.toLowerCase()).not.toMatch(/you have hypertension|diagnosed with|this is hypertension/);
        expect(checkSafetyCopy(text).violations).toEqual([]);
      }
    }
  });

  it("elevated stays informational — no alarm tone for a context-sensitive reading", () => {
    expect(bpGuidance("elevated").severity).toBe("info");
    expect(bpGuidance("stage1").severity).toBe("warning");
  });
});

describe("parseBloodworkText", () => {
  it("parses the common lab line shapes", () => {
    const markers = parseBloodworkText(
      [
        "Glucose 92 mg/dL (70-99)",
        "HDL: 55 mg/dL 40-60",
        "A1c 5.4 %",
        "Vitamin D, 25-OH: 41 ng/mL [30-100]",
        "Ferritin 210 ng/mL H",
      ].join("\n")
    );
    expect(markers).toHaveLength(5);
    expect(markers[0]).toMatchObject({ name: "Glucose", value: 92, unit: "mg/dL", refLow: 70, refHigh: 99 });
    expect(markers[1]).toMatchObject({ name: "HDL", value: 55, refLow: 40, refHigh: 60 });
    expect(markers[4]).toMatchObject({ name: "Ferritin", labFlag: "H" });
  });

  it("lab-provided ranges beat the dictionary; dictionary fills gaps", () => {
    const [custom, fallback] = parseBloodworkText("Glucose 92 mg/dL (65-110)\nGlucose 92");
    expect(custom).toMatchObject({ refLow: 65, refHigh: 110 });
    expect(fallback).toMatchObject({ refLow: 70, refHigh: 99, unit: "mg/dL" }); // dictionary
  });

  it("canonicalizes aliases and keeps unknown names as typed", () => {
    const [known, unknown] = parseBloodworkText("hba1c 5.2 %\nMystery Marker X 42 units (10-50)");
    expect(known?.name).toBe("A1c");
    expect(unknown?.name).toBe("Mystery Marker X");
    expect(unknown?.refHigh).toBe(50);
  });

  it("skips blank and non-numeric lines instead of failing the paste", () => {
    expect(parseBloodworkText("LIPID PANEL\n\nLDL 96 mg/dL (0-99)\nSee notes below")).toHaveLength(1);
  });
});

function report(markers: BloodworkReport["markers"]): BloodworkReport {
  return { id: "r1", date: "2026-07-01", labName: "Test Lab", markers, notes: "", createdAt: "2026-07-01T09:00:00.000Z" };
}

describe("bloodwork summary + doctor questions", () => {
  const mixed = report([
    { name: "Glucose", value: 92, unit: "mg/dL", refLow: 70, refHigh: 99 },
    { name: "LDL", value: 131, unit: "mg/dL", refLow: null, refHigh: 100 },
    { name: "Ferritin", value: 12, unit: "ng/mL", refLow: 30, refHigh: 400 },
    { name: "Mystery", value: 5, unit: "x", refLow: null, refHigh: null },
  ]);

  it("classifies markers against their own ranges", () => {
    expect(markerStatus(mixed.markers[0]!)).toBe("inRange");
    expect(markerStatus(mixed.markers[1]!)).toBe("aboveRange");
    expect(markerStatus(mixed.markers[2]!)).toBe("belowRange");
    expect(markerStatus(mixed.markers[3]!)).toBe("noRange");
  });

  it("summary states uncertainty, explains relations, never diagnoses", () => {
    const s = summarizeBloodwork(mixed);
    expect(s.lines[0]).toContain("1 of 4");
    const all = s.lines.join(" ");
    expect(all).toContain("not a diagnosis");
    expect(all).toContain("cardiovascular risk context"); // LDL relatesTo
    for (const line of s.lines) {
      expect(checkSafetyCopy(line).violations).toEqual([]);
    }
  });

  it("generates clinician questions from out-of-range markers", () => {
    const qs = doctorQuestions(mixed);
    expect(qs.some((q) => q.includes("LDL"))).toBe(true);
    expect(qs.some((q) => q.includes("Ferritin"))).toBe(true);
    expect(qs[qs.length - 1]).toMatch(/re-testing/);
    for (const q of qs) expect(checkSafetyCopy(q).violations).toEqual([]);
  });

  it("all-in-range reports still get a useful question set", () => {
    const qs = doctorQuestions(report([{ name: "Glucose", value: 90, unit: "mg/dL", refLow: 70, refHigh: 99 }]));
    expect(qs.length).toBeGreaterThan(0);
  });
});

describe("calculateHealthScore — renormalizing composite", () => {
  const nothing: HealthScoreInputs = {
    avgSteps: null,
    avgCardioMinutes: null,
    avgSleepHours: null,
    bpCategory: null,
    glucoseStatus: null,
    lipidStatus: null,
    nutritionAdherence: null,
    restingHR: null,
  };

  it("is null when nothing is tracked — no fake precision", () => {
    expect(calculateHealthScore(nothing).score).toBeNull();
  });

  it("renormalizes over tracked inputs: perfect partial data scores 100", () => {
    const r = calculateHealthScore({
      ...nothing,
      avgSteps: 10000,
      avgSleepHours: 8,
    });
    expect(r.score).toBe(100);
    const tracked = r.components.filter((c) => c.tracked);
    expect(tracked.map((c) => c.key).sort()).toEqual(["movement", "sleep"]);
    expect(tracked.reduce((s, c) => s + c.max, 0)).toBe(100);
  });

  it("never punishes untracked inputs (no BP cuff ≠ lower score)", () => {
    const withoutBp = calculateHealthScore({ ...nothing, avgSteps: 8000, avgSleepHours: 7.5 });
    const withNormalBp = calculateHealthScore({
      ...nothing,
      avgSteps: 8000,
      avgSleepHours: 7.5,
      bpCategory: "normal",
    });
    expect(withoutBp.score).toBe(100);
    expect(withNormalBp.score).toBe(100);
  });

  it("degrades with the BP category and out-of-range labs", () => {
    const base: HealthScoreInputs = {
      ...nothing,
      avgSteps: 8000,
      avgSleepHours: 7.5,
      bpCategory: "normal",
      glucoseStatus: "inRange",
      lipidStatus: "inRange",
      nutritionAdherence: 1,
      restingHR: 50,
    };
    const perfect = calculateHealthScore(base).score!;
    const worse = calculateHealthScore({ ...base, bpCategory: "stage2", lipidStatus: "aboveRange" }).score!;
    expect(perfect).toBe(100);
    expect(worse).toBeLessThan(perfect - 10);
  });
});
