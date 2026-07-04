import { describe, expect, it } from "vitest";
import {
  RED_FLAGS,
  calculateReadinessScore,
  computePersonalRecords,
  generateInjuryModification,
  getPainAwareWorkoutAdjustment,
  injuriesFromPainFlags,
  redFlagGuidance,
  rirFromRpe,
  suggestDeload,
  weeklyVolumeByMuscle,
} from "./trainingRules";
import { checkSafetyCopy } from "./safetyCopy";
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

describe("generateInjuryModification (E8-T general engine)", () => {
  const kneeInjury = {
    id: "u1", bodyArea: "left knee", diagnosis: "", symptoms: "pain under load",
    painScore: 4, aggravatingMovements: ["deep squats"], relievingMovements: [],
    medicalRestrictions: "", onsetDate: null, professionalCare: true, notes: "",
  };

  it("is inactive with no injuries but still carries the pain-load math", () => {
    const mod = generateInjuryModification({ injuries: [], sessionPainScore: 8 });
    expect(mod.active).toBe(false);
    expect(mod.loadReductionPct).toBe(20); // same 7→15/8→20/9+→25 math
  });

  it("suggests same-pattern swaps that avoid the caution tags, with a why", () => {
    const mod = generateInjuryModification({ injuries: [kneeInjury], sessionPainScore: 0 });
    expect(mod.active).toBe(true);
    expect(mod.cautionTags).toContain("knee");
    expect(mod.swaps.length).toBeGreaterThan(0);
    for (const swap of mod.swaps) {
      expect((swap.avoid.cautions ?? [])).toContain("knee");
      if (swap.replaceWith) {
        expect(swap.replaceWith.pattern).toBe(swap.avoid.pattern);
        expect(swap.replaceWith.cautions ?? []).not.toContain("knee");
      }
      expect(swap.why.length).toBeGreaterThan(10); // always explained
    }
  });

  it("never claims treatment and points at professionals — copy is safety-clean", () => {
    const mod = generateInjuryModification({ injuries: [kneeInjury], sessionPainScore: 7 });
    const all = mod.messages.join(" ");
    expect(all).toMatch(/doesn't treat|clinician|PT/i);
    for (const m of mod.messages) {
      expect(checkSafetyCopy(m).violations).toEqual([]);
    }
  });

  it("keeps the v1 pain engine byte-compatible for the seeded case", () => {
    const v1 = getPainAwareWorkoutAdjustment({
      sessionPainScore: 8,
      painFlags: { thoracic: true, rib: true, scapular: true, upperTrapDominant: true, leftArmAggravation: true },
    });
    expect(v1.loadReductionPct).toBe(20);
    expect(v1.suggestedSwapIds).toEqual(["chest-supported-row", "neutral-grip-pulldown"]);
  });
});

describe("red flags (E8-T)", () => {
  it("any red flag escalates to medical evaluation — never train through", () => {
    const g = redFlagGuidance(["Chest pain"]);
    expect(g.escalate).toBe(true);
    expect(g.message).toMatch(/seek medical evaluation/i);
    expect(g.message).toMatch(/do not train through/i);
    expect(checkSafetyCopy(g.message).violations).toEqual([]);
  });

  it("the list covers the spec's red flags", () => {
    const all = RED_FLAGS.join(" ").toLowerCase();
    for (const item of ["severe pain", "numbness", "bowel", "chest pain", "shortness of breath", "swelling", "fever", "trauma", "neurologic"]) {
      expect(all).toContain(item);
    }
    expect(redFlagGuidance([]).escalate).toBe(false);
  });
});

describe("readiness (E8-T)", () => {
  it("full band on good sleep and low stress", () => {
    const r = calculateReadinessScore({ sleepHours: 8, stress: 2, mood: 8, painScore: 0 });
    expect(r.band).toBe("full");
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("reduced band trims the session, minimum band points at the MVW", () => {
    const reduced = calculateReadinessScore({ sleepHours: 5.5, stress: 7, mood: 4, painScore: 3 });
    expect(reduced.band).toBe("reduced");
    const minimum = calculateReadinessScore({ sleepHours: 4, stress: 9, mood: 2, painScore: 6 });
    expect(minimum.band).toBe("minimum");
    expect(minimum.suggestion).toMatch(/Minimum Viable Workout/);
    // Adherence-neutral: planning language, never weakness language.
    expect(minimum.suggestion.toLowerCase()).not.toMatch(/weak|lazy|fail/);
  });

  it("unlogged mood/stress read neutral instead of tanking the score", () => {
    const r = calculateReadinessScore({ sleepHours: 8, stress: 0, mood: 0, painScore: 0 });
    expect(r.band).toBe("full");
  });
});

describe("deload (E8-T)", () => {
  const hardSet = { exerciseId: "x", weight: 100, reps: 8, rpe: 9, painScore: 0, note: "" };
  function session(date: string): WorkoutEntry {
    return {
      id: date, date, splitLabel: "Upper", status: "complete", warmupDone: true,
      exercises: [{ exerciseId: "x", name: "X", muscleGroup: "chest", sets: [hardSet, hardSet] }],
      startedAt: null, completedAt: null, sessionPainScore: 0, note: "",
    };
  }
  const iso = (offset: number) => {
    const d = new Date("2026-03-21T00:00:00");
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };

  it("suggests a deload after 3 hard consistent weeks", () => {
    const workouts = Array.from({ length: 15 }, (_, i) => session(iso(i)));
    const s = suggestDeload(workouts, "2026-03-21");
    expect(s.suggested).toBe(true);
    expect(s.reason).toMatch(/deload week/i);
    expect(s.reason.toLowerCase()).not.toMatch(/overtrain|burnout|fail/); // framing: plan, not verdict
  });

  it("stays quiet for normal training volume or easy weeks", () => {
    expect(suggestDeload(Array.from({ length: 6 }, (_, i) => session(iso(i))), "2026-03-21").suggested).toBe(false);
    const easy = Array.from({ length: 15 }, (_, i) => {
      const s = session(iso(i));
      s.exercises[0]!.sets = s.exercises[0]!.sets.map((x) => ({ ...x, rpe: 6 }));
      return s;
    });
    expect(suggestDeload(easy, "2026-03-21").suggested).toBe(false);
  });
});

describe("rirFromRpe", () => {
  it("is RPE's inverse, clamped", () => {
    expect(rirFromRpe(8)).toBe(2);
    expect(rirFromRpe(10)).toBe(0);
    expect(rirFromRpe(6.5)).toBe(4);
  });
});
