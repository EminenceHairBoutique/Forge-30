import { describe, expect, it } from "vitest";
import { programBuilderDefaults, quickAddFirst, suggestProgram } from "./programs";
import { PROGRAMS, programById } from "@/lib/data/programs";

describe("suggestProgram (§3.1 answers → §3.2 default)", () => {
  it("pain flags or injuries → Comeback 30, regardless of schedule", () => {
    expect(suggestProgram({ painFlags: { thoracic: true } as never, sessionMinutes: 20 })).toBe("comeback30");
    expect(suggestProgram({ injuriesCount: 1, trainingExperience: "advanced" })).toBe("comeback30");
  });

  it("tight schedule → Busy 30", () => {
    expect(suggestProgram({ sessionMinutes: 20, trainingExperience: "intermediate" })).toBe("busy30");
    expect(suggestProgram({ trainingDaysPerWeek: 2, trainingExperience: "advanced" })).toBe("busy30");
  });

  it("beginner (or unanswered) with a workable schedule → First 30", () => {
    expect(suggestProgram({ trainingExperience: "beginner" })).toBe("first30");
    expect(suggestProgram({})).toBe("first30");
  });

  it("experienced with time → custom (current behavior)", () => {
    expect(
      suggestProgram({ trainingExperience: "advanced", sessionMinutes: 60, trainingDaysPerWeek: 5 })
    ).toBe("custom");
  });
});

describe("programBuilderDefaults", () => {
  it("custom/unknown returns the profile schedule untouched", () => {
    expect(
      programBuilderDefaults("custom", {
        trainingDaysPerWeek: 5,
        sessionMinutes: 75,
        trainingExperience: "advanced",
      })
    ).toEqual({ daysPerWeek: 5, sessionMinutes: 75, experience: "advanced" });
    expect(programBuilderDefaults(undefined, {})).toEqual({
      daysPerWeek: 4,
      sessionMinutes: 60,
      experience: "beginner",
    });
  });

  it("Busy 30 caps sessions at 20 minutes", () => {
    const d = programBuilderDefaults("busy30", { sessionMinutes: 60, trainingDaysPerWeek: 6 });
    expect(d.sessionMinutes).toBe(20);
    expect(d.daysPerWeek).toBe(4);
  });

  it("Comeback 30 biases guidance conservative and caps volume", () => {
    const d = programBuilderDefaults("comeback30", {
      sessionMinutes: 90,
      trainingDaysPerWeek: 6,
      trainingExperience: "advanced",
    });
    expect(d.experience).toBe("beginner");
    expect(d.sessionMinutes).toBe(60);
    expect(d.daysPerWeek).toBe(4);
  });

  it("a schedule under the cap passes through", () => {
    const d = programBuilderDefaults("first30", { sessionMinutes: 30, trainingDaysPerWeek: 2 });
    expect(d).toEqual({ daysPerWeek: 2, sessionMinutes: 30, experience: "beginner" });
  });
});

describe("program gallery data", () => {
  it("three programs, each resolvable by id; custom resolves to null", () => {
    expect(PROGRAMS.map((p) => p.id).sort()).toEqual(["busy30", "comeback30", "first30"]);
    for (const p of PROGRAMS) expect(programById(p.id)).toBe(p);
    expect(programById("custom")).toBeNull();
  });

  it("only Busy 30 leads nutrition with quick-adds", () => {
    expect(quickAddFirst("busy30")).toBe(true);
    expect(quickAddFirst("first30")).toBe(false);
    expect(quickAddFirst("custom")).toBe(false);
    expect(quickAddFirst(undefined)).toBe(false);
  });
});
