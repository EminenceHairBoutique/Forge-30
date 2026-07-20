import { describe, expect, it } from "vitest";
import {
  accessoryEmphasis,
  adjustedSetCount,
  classifyHybridReadiness,
  completedSetCount,
  DEFAULT_HYBRID_THRESHOLDS,
  epley1RM,
  filterSubstitutions,
  hybridDayForDate,
  mesoAdjustedSets,
  mesocycleWeek,
  newSessionState,
  parseRepRange,
  plannedSets,
  progressionKindFor,
  readinessAdjustment,
  resolveSlotExercise,
  sessionToWorkoutEntry,
  suggestProgression,
  weeklySchedule,
} from "./hybridTraining";
import { HYBRID_EXERCISES, HYBRID_WEEK, hybridExerciseById } from "@/lib/data/hybridProgram";
import { MOBILITY_LIBRARY } from "@/lib/data/mobilityLibrary";
import { BOXING_SESSIONS, ROUND_PRESETS } from "@/lib/data/boxing";
import type { HybridSetLog } from "@/lib/types";

// --- Program data integrity --------------------------------------------------

describe("hybrid program data", () => {
  it("ships the full 7-day week with the specified day structure", () => {
    expect(HYBRID_WEEK).toHaveLength(7);
    const byId = Object.fromEntries(HYBRID_WEEK.map((d) => [d.id, d]));
    expect(byId["upper-a"]!.exerciseIds).toHaveLength(10);
    expect(byId["lower-a"]!.exerciseIds).toHaveLength(6);
    expect(byId["upper-b"]!.exerciseIds).toHaveLength(9);
    expect(byId["lower-b"]!.exerciseIds).toHaveLength(7);
    expect(byId["athletic-boxing"]!.exerciseIds).toHaveLength(10);
    expect(byId["recovery-boxing"]!.kind).toBe("recovery");
    expect(byId["recovery-sunday"]!.kind).toBe("recovery");
  });

  it("every day slot resolves to a catalog exercise with unique ids", () => {
    const ids = HYBRID_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const day of HYBRID_WEEK) {
      for (const id of day.exerciseIds) {
        expect(hybridExerciseById(id), `missing ${id}`).toBeDefined();
      }
    }
  });

  it("every exercise carries explanation, steps, cues, and mistakes", () => {
    for (const ex of HYBRID_EXERCISES) {
      expect(ex.explanation.length, ex.id).toBeGreaterThan(20);
      expect(ex.steps.length, ex.id).toBeGreaterThan(0);
      expect(ex.cues.length, ex.id).toBeGreaterThan(0);
      expect(ex.mistakes.length, ex.id).toBeGreaterThan(0);
    }
  });

  it("substitutions carry the six required fields", () => {
    for (const ex of HYBRID_EXERCISES) {
      for (const s of ex.substitutions) {
        expect(s.whySafer.length, `${ex.id}/${s.id}`).toBeGreaterThan(5);
        expect(s.preservesGoal.length, `${ex.id}/${s.id}`).toBeGreaterThan(3);
        expect(s.injuryNotes.length, `${ex.id}/${s.id}`).toBeGreaterThan(3);
        expect(["regression", "lateral", "progression"]).toContain(s.kind);
        expect(s.difficulty).toBeGreaterThanOrEqual(1);
        expect(s.difficulty).toBeLessThanOrEqual(3);
      }
    }
  });

  it("the specified substitution lists exist (bench 5, deadlift 6, front squat 5, clean pull 5, knee raise 5)", () => {
    expect(hybridExerciseById("bb-bench-press")!.substitutions).toHaveLength(5);
    expect(hybridExerciseById("trap-bar-dl")!.substitutions).toHaveLength(6);
    expect(hybridExerciseById("front-squat")!.substitutions).toHaveLength(5);
    expect(hybridExerciseById("clean-pull")!.substitutions).toHaveLength(5);
    expect(hybridExerciseById("hanging-knee-raise")!.substitutions).toHaveLength(5);
    expect(hybridExerciseById("neutral-grip-pullup")!.substitutions.length).toBeGreaterThanOrEqual(4);
    expect(hybridExerciseById("landmine-press-hk")!.substitutions.length).toBeGreaterThanOrEqual(4);
  });

  it("mobility library ships 19 fully-specified drills across four categories", () => {
    expect(MOBILITY_LIBRARY).toHaveLength(19);
    const cats = new Set(MOBILITY_LIBRARY.map((d) => d.category));
    expect(cats).toEqual(new Set(["thoracic", "scapular", "rotatorCuff", "core"]));
    for (const d of MOBILITY_LIBRARY) {
      expect(d.purpose.length, d.id).toBeGreaterThan(10);
      expect(d.steps.length, d.id).toBeGreaterThan(1);
      expect(d.mistakes.length, d.id).toBeGreaterThan(0);
      expect(d.regression.length, d.id).toBeGreaterThan(0);
      expect(d.progression.length, d.id).toBeGreaterThan(0);
      expect(d.placement.length, d.id).toBeGreaterThan(0);
    }
  });

  it("boxing module ships four session types and the three fixed presets", () => {
    expect(BOXING_SESSIONS.map((s) => s.id)).toEqual(["technical", "speed", "power", "conditioning"]);
    expect(ROUND_PRESETS.map((p) => [p.workSeconds, p.restSeconds])).toEqual([
      [120, 60],
      [180, 60],
      [30, 30],
    ]);
  });
});

// --- Readiness ---------------------------------------------------------------

describe("classifyHybridReadiness", () => {
  it("green when pain 0–2, no flags, normal energy", () => {
    const r = classifyHybridReadiness({ painScore: 2, neuroSymptoms: [], sleepHours: 8, energy: 4, soreness: 2 });
    expect(r.band).toBe("green");
  });

  it("yellow at pain 3–4 or poor sleep / low energy / heavy soreness", () => {
    expect(classifyHybridReadiness({ painScore: 3, neuroSymptoms: [] }).band).toBe("yellow");
    expect(classifyHybridReadiness({ painScore: 4, neuroSymptoms: [] }).band).toBe("yellow");
    expect(classifyHybridReadiness({ painScore: 0, neuroSymptoms: [], sleepHours: 5 }).band).toBe("yellow");
    expect(classifyHybridReadiness({ painScore: 0, neuroSymptoms: [], energy: 1 }).band).toBe("yellow");
    expect(classifyHybridReadiness({ painScore: 0, neuroSymptoms: [], soreness: 5 }).band).toBe("yellow");
  });

  it("orange at pain 5–6 or when the warm-up worsens symptoms", () => {
    expect(classifyHybridReadiness({ painScore: 5, neuroSymptoms: [] }).band).toBe("orange");
    expect(classifyHybridReadiness({ painScore: 6, neuroSymptoms: [] }).band).toBe("orange");
    const r = classifyHybridReadiness({ painScore: 1, neuroSymptoms: [], warmupResponse: "worse" });
    expect(r.band).toBe("orange");
    expect(r.reasons.join(" ")).toMatch(/warm-up/i);
  });

  it("red at pain 7+ or any neurological symptom, with medical-safety guidance", () => {
    const pain = classifyHybridReadiness({ painScore: 7, neuroSymptoms: [] });
    expect(pain.band).toBe("red");
    expect(pain.guidance).toMatch(/do not train/i);
    expect(pain.guidance).toMatch(/medical/i);
    const neuro = classifyHybridReadiness({ painScore: 0, neuroSymptoms: ["Progressive weakness"] });
    expect(neuro.band).toBe("red");
    expect(neuro.reasons[0]).toContain("Progressive weakness");
  });

  it("thresholds are configurable", () => {
    const strict = { yellowPain: 1, orangePain: 2, redPain: 3 };
    expect(classifyHybridReadiness({ painScore: 1, neuroSymptoms: [] }, strict).band).toBe("yellow");
    expect(classifyHybridReadiness({ painScore: 2, neuroSymptoms: [] }, strict).band).toBe("orange");
    expect(classifyHybridReadiness({ painScore: 3, neuroSymptoms: [] }, strict).band).toBe("red");
    // defaults untouched
    expect(DEFAULT_HYBRID_THRESHOLDS).toEqual({ yellowPain: 3, orangePain: 5, redPain: 7 });
  });
});

describe("readiness adjustments", () => {
  it("yellow reduces working sets 20–30% and caps RPE at 7", () => {
    const adj = readinessAdjustment("yellow");
    expect(adj.rpeCap).toBe(7);
    expect(adj.dropExplosive).toBe(true);
    expect(adjustedSetCount(4, "yellow")).toBe(3);
    expect(adjustedSetCount(5, "yellow")).toBe(4);
    expect(adjustedSetCount(3, "yellow")).toBe(2);
    expect(adjustedSetCount(1, "yellow")).toBe(1); // never below one
  });

  it("green leaves volume alone; orange is recovery-only; red stops", () => {
    expect(adjustedSetCount(4, "green")).toBe(4);
    expect(adjustedSetCount(4, "orange")).toBe(0);
    expect(readinessAdjustment("orange").recoveryOnly).toBe(true);
    expect(adjustedSetCount(4, "red")).toBe(0);
    expect(readinessAdjustment("red").stop).toBe(true);
  });
});

// --- Periodization -----------------------------------------------------------

describe("mesocycleWeek", () => {
  it("4-week template ramps RPE 6–7 → 8–9 then deloads 45% volume / 15% intensity", () => {
    const w1 = mesocycleWeek("2026-07-06", "2026-07-08", 4, null);
    expect(w1.week).toBe(1);
    expect(w1.rpeRange).toEqual([6, 7]);
    const w3 = mesocycleWeek("2026-07-06", "2026-07-20", 4, null);
    expect(w3.week).toBe(3);
    expect(w3.rpeRange).toEqual([8, 9]);
    expect(w3.volumeMultiplier).toBeGreaterThan(1);
    const w4 = mesocycleWeek("2026-07-06", "2026-07-27", 4, null);
    expect(w4.isDeload).toBe(true);
    expect(w4.volumeMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(w4.volumeMultiplier).toBeLessThanOrEqual(0.6);
    expect(w4.intensityMultiplier).toBeGreaterThanOrEqual(0.8);
    expect(w4.intensityMultiplier).toBeLessThanOrEqual(0.9);
  });

  it("cycles wrap after the deload, and null start pins week 1", () => {
    const wrapped = mesocycleWeek("2026-07-06", "2026-08-03", 4, null); // week 5 → new cycle
    expect(wrapped.week).toBe(1);
    expect(mesocycleWeek(null, "2026-07-20", 4, null).week).toBe(1);
  });

  it("extends to 5/6/8 weeks with the deload always last", () => {
    for (const len of [5, 6, 8] as const) {
      const last = mesocycleWeek("2026-01-05", "2026-01-05", len, null);
      expect(last.totalWeeks).toBe(len);
      const days = (len - 1) * 7;
      const finalWeek = mesocycleWeek(
        "2026-01-05",
        new Date(new Date("2026-01-05T00:00:00").getTime() + days * 86400000).toISOString().slice(0, 10),
        len,
        null
      );
      expect(finalWeek.week).toBe(len);
      expect(finalWeek.isDeload).toBe(true);
    }
  });

  it("repeat week runs a template week twice and extends the cycle by one", () => {
    // Repeat week 2 of a 4-week cycle: calendar weeks are 1,2,2r,3,4(deload)
    const w2 = mesocycleWeek("2026-07-06", "2026-07-13", 4, 2);
    expect(w2.label).toBe("Build");
    const w2r = mesocycleWeek("2026-07-06", "2026-07-20", 4, 2);
    expect(w2r.isRepeat).toBe(true);
    expect(w2r.label).toBe("Build (repeat)");
    const w4 = mesocycleWeek("2026-07-06", "2026-08-03", 4, 2);
    expect(w4.week).toBe(5);
    expect(w4.totalWeeks).toBe(5);
    expect(w4.isDeload).toBe(true);
  });

  it("meso volume multiplier respects the minimum of one set", () => {
    const deload = mesocycleWeek("2026-07-06", "2026-07-27", 4, null);
    expect(mesoAdjustedSets(4, deload)).toBe(2);
    expect(mesoAdjustedSets(1, deload)).toBe(1);
  });
});

// --- Progression -------------------------------------------------------------

describe("progression", () => {
  const sets = (arr: Array<[number, number, number, number?]>) =>
    arr.map(([weight, reps, rpe, rir]) => ({ weight, reps, rpe, rir }));

  it("classifies kinds: explosive flag wins, pure strength, default double", () => {
    expect(progressionKindFor(hybridExerciseById("mb-chest-pass")!)).toBe("explosive");
    expect(progressionKindFor(hybridExerciseById("front-squat")!)).toBe("strength");
    expect(progressionKindFor(hybridExerciseById("ht-incline-db-press")!)).toBe("double");
  });

  it("double progression: add load only when all sets top the range with reps in reserve", () => {
    const top = suggestProgression("double", "8–12", sets([[50, 12, 8, 2], [50, 12, 8, 1], [50, 12, 7, 2]]));
    expect(top.action).toBe("addLoad");
    const mid = suggestProgression("double", "8–12", sets([[50, 12, 8, 2], [50, 10, 9, 0]]));
    expect(mid.action).toBe("addReps");
  });

  it("strength: backs off after two RPE ≥ 9 sessions; adds load on a rising e1RM at RPE ≤ 8", () => {
    const grind = suggestProgression("strength", "6", sets([[100, 6, 9.5]]), sets([[100, 6, 9]]));
    expect(grind.action).toBe("backOff");
    const rising = suggestProgression("strength", "6", sets([[105, 6, 8]]), sets([[100, 6, 8]]));
    expect(rising.action).toBe("addLoad");
  });

  it("explosive: always quality-first, never fatigue-driven", () => {
    const s = suggestProgression("explosive", "3", sets([[60, 3, 9]]));
    expect(s.action).toBe("qualityFirst");
    expect(s.detail).toMatch(/speed/i);
  });

  it("no history yields a baseline prompt; rep parsing handles ranges, singles, and timed work", () => {
    expect(suggestProgression("double", "8–12", []).action).toBe("baseline");
    expect(parseRepRange("8–12")).toEqual([8, 12]);
    expect(parseRepRange("6-8")).toEqual([6, 8]);
    expect(parseRepRange("5")).toEqual([5, 5]);
    expect(parseRepRange("30–40 m")).toEqual([30, 40]);
    expect(parseRepRange("20 s work / 40 s rest")).toBeNull();
    expect(epley1RM(100, 5)).toBeCloseTo(116.7, 1);
  });
});

// --- Substitutions -----------------------------------------------------------

describe("substitutions", () => {
  it("filters by equipment tier", () => {
    const bench = hybridExerciseById("bb-bench-press")!;
    const atHome = filterSubstitutions(bench.substitutions, "minimal");
    expect(atHome.every((s) => s.equipment === "none" || s.equipment === "minimal")).toBe(true);
    expect(atHome.length).toBeGreaterThan(0);
    const noEquip = filterSubstitutions(bench.substitutions, "none");
    expect(noEquip.map((s) => s.id)).toEqual(["push-up-variation"]);
  });

  it("resolves slots through session subs first, then remembered preferences", () => {
    expect(resolveSlotExercise("bb-bench-press", { "bb-bench-press": "floor-press" }, {})).toEqual({
      exerciseId: "floor-press",
      substituted: true,
    });
    expect(resolveSlotExercise("bb-bench-press", {}, { "bb-bench-press": "ng-db-press" })).toEqual({
      exerciseId: "ng-db-press",
      substituted: true,
    });
    expect(resolveSlotExercise("bb-bench-press", {}, {})).toEqual({
      exerciseId: "bb-bench-press",
      substituted: false,
    });
  });
});

// --- Schedules + emphasis ----------------------------------------------------

describe("schedule variants", () => {
  it("maps 3/4/5/6-day versions with Sunday always recovery", () => {
    for (const days of [3, 4, 5, 6] as const) {
      const sched = weeklySchedule(days);
      expect(Object.keys(sched)).toHaveLength(7);
      expect(sched[6]).toBe("recovery-sunday");
      const strengthDays = Object.values(sched).filter((id) =>
        ["upper-a", "lower-a", "upper-b", "lower-b", "athletic-boxing"].includes(id)
      ).length;
      expect(strengthDays).toBe(days === 6 ? 5 : days); // 6-day includes recovery-boxing Wednesday
    }
    expect(weeklySchedule(6)[2]).toBe("recovery-boxing");
  });

  it("resolves a date to its day (2026-07-20 is a Monday → Upper A)", () => {
    expect(hybridDayForDate("2026-07-20", 6).id).toBe("upper-a");
    expect(hybridDayForDate("2026-07-26", 6).id).toBe("recovery-sunday");
    expect(hybridDayForDate("2026-07-21", 3).id).toBe("recovery-sunday");
  });
});

describe("accessoryEmphasis trap guard", () => {
  it("suppresses neck/trap emphasis when the guard is on, with an explanation", () => {
    const plan = accessoryEmphasis(["lats", "neckTraps"], true);
    expect(plan.emphasized).toEqual(["lats"]);
    expect(plan.suppressed[0]!.priority).toBe("neckTraps");
    expect(plan.suppressed[0]!.reason).toMatch(/trap-dominance/i);
    const open = accessoryEmphasis(["neckTraps"], false);
    expect(open.emphasized).toEqual(["neckTraps"]);
  });
});

// --- Session state + persistence bridge -------------------------------------

describe("session state", () => {
  const NOW = "2026-07-20T10:00:00.000Z";

  const set = (over: Partial<HybridSetLog> = {}): HybridSetLog => ({
    setNumber: 1,
    reps: 8,
    weight: 60,
    rpe: 7,
    painBefore: 0,
    painAfter: 1,
    isWarmup: false,
    failed: false,
    note: "",
    ...over,
  });

  it("plannedSets combines readiness band, meso week, and manual adjustments", () => {
    const bench = hybridExerciseById("bb-bench-press")!;
    const peak = mesocycleWeek("2026-07-06", "2026-07-20", 4, null); // week 3, ×1.1
    expect(plannedSets(bench, "green", peak)).toBe(4);
    expect(plannedSets(bench, "yellow", peak)).toBe(3);
    expect(plannedSets(bench, "orange", peak)).toBe(0);
    expect(plannedSets(bench, "green", peak, 1)).toBe(5);
    expect(plannedSets(bench, "green", peak, -10)).toBe(1); // clamped
  });

  it("freezes a session into a canonical WorkoutEntry (subs, pain, notes, warmups excluded)", () => {
    const state = newSessionState("2026-07-20", "upper-a", "green", NOW);
    state.substitutions["bb-bench-press"] = "floor-press";
    state.setLogs["bb-bench-press"] = [set({ isWarmup: true, weight: 40 }), set({ painAfter: 3 }), set({ setNumber: 2, reps: 6, rpe: 8 })];
    state.setLogs["chest-supported-row"] = [set({ weight: 50 })];
    state.painFlagged.push("bb-bench-press");
    state.stopReasons["ht-cable-fly"] = "shoulder ache at stretch";
    state.aiModifications.push("Reduced pressing volume per coach suggestion");

    const entry = sessionToWorkoutEntry(state, NOW);
    expect(entry.id).toBe("hybrid-2026-07-20-upper-a");
    expect(entry.splitLabel).toBe("Hybrid — Upper A");
    expect(entry.status).toBe("complete");
    expect(entry.sessionPainScore).toBe(3);
    const bench = entry.exercises.find((e) => e.swappedFromId === "bb-bench-press")!;
    expect(bench.exerciseId).toBe("floor-press");
    expect(bench.sets).toHaveLength(2); // warm-up excluded
    expect(entry.note).toContain("Pain-provoking: bb-bench-press");
    expect(entry.note).toContain("Stopped ht-cable-fly");
    expect(entry.note).toContain("AI modification accepted");
    expect(completedSetCount(state)).toBe(3);
  });
});
