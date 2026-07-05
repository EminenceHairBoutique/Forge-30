import { describe, expect, it } from "vitest";
import { acceptSuggestion, detectedSuggestions } from "./healthMerge";

describe("detected-vs-manual merge (v3 Phase 3)", () => {
  it("suggests only where nothing was logged manually", () => {
    const s = detectedSuggestions(
      { sleepHours: 0, steps: 0 },
      { sleepHours: 7.4, steps: 8421 }
    );
    expect(s.map((x) => x.field)).toEqual(["sleepHours", "steps"]);
    expect(s[0]?.value).toBe(7.5); // half-hour rounding
    expect(s[1]?.value).toBe(8421);
  });

  it("NEVER suggests over a manual entry — manual always wins", () => {
    const s = detectedSuggestions(
      { sleepHours: 6, steps: 0 },
      { sleepHours: 7.4, steps: 8421 }
    );
    expect(s.map((x) => x.field)).toEqual(["steps"]);
    expect(
      detectedSuggestions({ sleepHours: 6, steps: 12000 }, { sleepHours: 7.4, steps: 8421 })
    ).toEqual([]);
  });

  it("ignores missing or zero detections (permission denied = quiet manual entry)", () => {
    expect(detectedSuggestions({ sleepHours: 0, steps: 0 }, { sleepHours: null, steps: null })).toEqual([]);
    expect(detectedSuggestions({ sleepHours: 0, steps: 0 }, { sleepHours: 0, steps: 0 })).toEqual([]);
  });

  it("accepting a suggestion patches exactly its own field", () => {
    const [sleep] = detectedSuggestions(
      { sleepHours: 0, steps: 5000 },
      { sleepHours: 8, steps: 9000 }
    );
    expect(acceptSuggestion(sleep!)).toEqual({ sleepHours: 8 });
  });
});
