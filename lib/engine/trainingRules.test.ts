import { describe, expect, it } from "vitest";
import {
  computePersonalRecords,
  getPainAwareWorkoutAdjustment,
  injuriesFromPainFlags,
  weeklyVolumeByMuscle,
} from "./trainingRules";
import type { PainFlags, WorkoutEntry } from "@/lib/types";

const allFlags: PainFlags = {
  thoracic: true,
  rib: true,
  scapular: true,
  upperTrapDominant: true,
  leftArmAggravation: true,
};

const noFlags: PainFlags = {
  thoracic: false,
  rib: false,
  scapular: false,
  upperTrapDominant: false,
  leftArmAggravation: false,
};

describe("getPainAwareWorkoutAdjustment", () => {
  it("is inactive at pain 6 or below", () => {
    const r = getPainAwareWorkoutAdjustment({ sessionPainScore: 6, painFlags: allFlags });
    expect(r.active).toBe(false);
    expect(r.loadReductionPct).toBe(0);
    expect(r.appendedDrills).toHaveLength(0);
  });

  it("scales load reduction 15–25% with pain 7→9+", () => {
    expect(getPainAwareWorkoutAdjustment({ sessionPainScore: 7, painFlags: allFlags }).loadReductionPct).toBe(15);
    expect(getPainAwareWorkoutAdjustment({ sessionPainScore: 8, painFlags: allFlags }).loadReductionPct).toBe(20);
    expect(getPainAwareWorkoutAdjustment({ sessionPainScore: 9, painFlags: allFlags }).loadReductionPct).toBe(25);
    expect(getPainAwareWorkoutAdjustment({ sessionPainScore: 10, painFlags: allFlags }).loadReductionPct).toBe(25);
  });

  it("flags overhead pressing and promotes pain-safe pulls", () => {
    const r = getPainAwareWorkoutAdjustment({ sessionPainScore: 8, painFlags: allFlags });
    expect(r.avoidOverheadPressing).toBe(true);
    expect(r.suggestedSwapIds).toContain("chest-supported-row");
    expect(r.suggestedSwapIds).toContain("neutral-grip-pulldown");
  });

  it("appends serratus/dead bug/side plank/breathing drills when active", () => {
    const r = getPainAwareWorkoutAdjustment({ sessionPainScore: 7, painFlags: allFlags });
    const names = r.appendedDrills.map((d) => d.name.toLowerCase()).join(" | ");
    expect(names).toContain("serratus");
    expect(names).toContain("dead bug");
    expect(names).toContain("side plank");
    expect(names).toContain("breathing");
  });

  it("only warns about shrugging for upper-trap-dominant users", () => {
    const withFlag = getPainAwareWorkoutAdjustment({ sessionPainScore: 8, painFlags: allFlags });
    expect(withFlag.messages.some((m) => m.toLowerCase().includes("shrug"))).toBe(true);
    const withoutFlag = getPainAwareWorkoutAdjustment({ sessionPainScore: 8, painFlags: noFlags });
    expect(withoutFlag.messages.some((m) => m.toLowerCase().includes("shrug"))).toBe(false);
  });
});

function workout(date: string, sets: { id: string; weight: number; reps: number }[]): WorkoutEntry {
  return {
    id: date,
    date,
    splitLabel: "Test",
    status: "complete",
    warmupDone: true,
    startedAt: null,
    completedAt: null,
    sessionPainScore: 0,
    note: "",
    exercises: sets.map((s) => ({
      exerciseId: s.id,
      name: s.id,
      muscleGroup: "chest" as const,
      sets: [{ exerciseId: s.id, weight: s.weight, reps: s.reps, rpe: 8, painScore: 0, note: "" }],
    })),
  };
}

describe("computePersonalRecords", () => {
  it("keeps the heaviest set per exercise, ties broken by reps", () => {
    const prs = computePersonalRecords([
      workout("2026-07-01", [{ id: "db-bench", weight: 70, reps: 10 }]),
      workout("2026-07-02", [{ id: "db-bench", weight: 75, reps: 8 }]),
      workout("2026-07-03", [{ id: "db-bench", weight: 75, reps: 9 }]),
    ]);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ weight: 75, reps: 9, date: "2026-07-03" });
  });

  it("ignores empty/zero sets", () => {
    expect(computePersonalRecords([workout("2026-07-01", [{ id: "plank", weight: 0, reps: 0 }])])).toHaveLength(0);
  });
});

describe("weeklyVolumeByMuscle", () => {
  it("counts completed sets per muscle group", () => {
    const v = weeklyVolumeByMuscle([
      workout("2026-07-01", [
        { id: "a", weight: 50, reps: 10 },
        { id: "b", weight: 60, reps: 8 },
      ]),
    ]);
    expect(v.chest).toBe(2);
  });
});

describe("injuriesFromPainFlags (E5 derived view)", () => {
  it("maps each active flag to a structured InjuryProfile with a stable id", () => {
    const injuries = injuriesFromPainFlags(allFlags);
    expect(injuries).toHaveLength(5);
    expect(injuries.map((i) => i.id)).toContain("painflag:thoracic");
    for (const inj of injuries) {
      expect(inj.diagnosis).toBe(""); // user-reported only — never inferred
      expect(inj.aggravatingMovements.length).toBeGreaterThan(0);
    }
  });

  it("returns an empty list when no flags are set (de-personalized default)", () => {
    expect(
      injuriesFromPainFlags({
        thoracic: false,
        rib: false,
        scapular: false,
        upperTrapDominant: false,
        leftArmAggravation: false,
      })
    ).toEqual([]);
  });
});
