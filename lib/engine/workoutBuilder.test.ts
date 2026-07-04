import { describe, expect, it } from "vitest";
import { buildWorkoutWeek, cautionTagsForInjuries, experienceGuidance, type BuilderInputs } from "./workoutBuilder";
import type { InjuryProfile } from "@/lib/types";

function injury(overrides: Partial<InjuryProfile> = {}): InjuryProfile {
  return {
    id: "i1",
    bodyArea: "",
    diagnosis: "",
    symptoms: "",
    painScore: 0,
    aggravatingMovements: [],
    relievingMovements: [],
    medicalRestrictions: "",
    onsetDate: null,
    professionalCare: false,
    notes: "",
    ...overrides,
  };
}

const base: BuilderInputs = {
  goal: "gainMuscle",
  daysPerWeek: 4,
  sessionMinutes: 60,
  equipment: "fullGym",
  experience: "intermediate",
  injuries: [],
  dislikedIds: [],
  likedIds: [],
};

describe("cautionTagsForInjuries", () => {
  it("maps the user's own words to caution tags", () => {
    expect(cautionTagsForInjuries([injury({ bodyArea: "left shoulder" })])).toEqual(
      expect.arrayContaining(["shoulder", "overhead"])
    );
    expect(
      cautionTagsForInjuries([injury({ aggravatingMovements: ["running", "jumping"] })])
    ).toContain("high-impact");
    expect(cautionTagsForInjuries([injury({ medicalRestrictions: "no spinal compression per PT" })]))
      .toContain("spinal-load");
  });

  it("no injuries → no tags", () => {
    expect(cautionTagsForInjuries([])).toEqual([]);
  });
});

describe("buildWorkoutWeek", () => {
  it("is deterministic: same inputs, identical week", () => {
    expect(buildWorkoutWeek(base)).toEqual(buildWorkoutWeek(base));
  });

  it("builds the requested number of training days, rest elsewhere", () => {
    for (const days of [2, 3, 4, 5, 6] as const) {
      const week = buildWorkoutWeek({ ...base, daysPerWeek: days });
      expect(week.days).toHaveLength(7);
      expect(week.days.filter((d) => !d.isRest)).toHaveLength(days);
    }
  });

  it("sizes sessions to the time available", () => {
    const short = buildWorkoutWeek({ ...base, sessionMinutes: 30 });
    const long = buildWorkoutWeek({ ...base, sessionMinutes: 75 });
    const count = (w: typeof short) => w.days.find((d) => !d.isRest)!.exercises.length;
    expect(count(short)).toBeLessThanOrEqual(4);
    expect(count(long)).toBeGreaterThan(count(short));
  });

  it("respects the equipment tier: no-equipment users get bodyweight-only plans", () => {
    const week = buildWorkoutWeek({ ...base, equipment: "none" });
    for (const day of week.days) {
      for (const ex of day.exercises) {
        expect(ex.equipment ?? "fullGym", ex.name).toBe("none");
      }
    }
    // And the week is still populated — the library extension covers this tier.
    expect(week.days.filter((d) => !d.isRest).every((d) => d.exercises.length >= 3)).toBe(true);
  });

  it("beginners never get difficulty-3 movements", () => {
    const week = buildWorkoutWeek({ ...base, experience: "beginner" });
    for (const day of week.days) {
      for (const ex of day.exercises) {
        expect(ex.difficulty ?? 1, ex.name).toBeLessThan(3);
      }
    }
  });

  it("excludes exercises matching injury caution tags and says why in the notes", () => {
    const week = buildWorkoutWeek({
      ...base,
      injuries: [injury({ bodyArea: "right knee", aggravatingMovements: ["squatting deep"] })],
    });
    for (const day of week.days) {
      for (const ex of day.exercises) {
        expect(ex.cautions ?? [], ex.name).not.toContain("knee");
      }
    }
    expect(week.notes.join(" ")).toMatch(/knee/i);
    // Hinge/other lower-body work still fills the gap — never an empty day.
    expect(week.days.filter((d) => !d.isRest).every((d) => d.exercises.length >= 4)).toBe(true);
  });

  it("honors dislikes and prefers likes", () => {
    const disliked = buildWorkoutWeek({ ...base, dislikedIds: ["db-bench"] });
    for (const day of disliked.days) {
      expect(day.exercises.map((e) => e.id)).not.toContain("db-bench");
    }
    const liked = buildWorkoutWeek({ ...base, likedIds: ["push-ups"] });
    const firstPushDay = liked.days.find((d) => d.exercises.some((e) => e.pattern === "push"))!;
    const firstPush = firstPushDay.exercises.find((e) => e.pattern === "push")!;
    expect(firstPush.id).toBe("push-ups");
  });

  it("never repeats an exercise within a day and varies repeat days", () => {
    const week = buildWorkoutWeek({ ...base, daysPerWeek: 4 });
    for (const day of week.days) {
      const ids = day.exercises.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    // The two Upper days should not be identical.
    const uppers = week.days.filter((d) => d.label === "Upper Body");
    expect(uppers).toHaveLength(2);
    expect(uppers[0]!.exercises.map((e) => e.id)).not.toEqual(uppers[1]!.exercises.map((e) => e.id));
  });

  it("RIR guidance rides along by experience", () => {
    expect(experienceGuidance("beginner")).toMatch(/RIR 3–4/);
    expect(buildWorkoutWeek(base).notes[0]).toMatch(/RIR/);
  });
});
