import { describe, expect, it } from "vitest";
import {
  NOT_LEGAL_ADVICE,
  SPOKEN_NOTICE,
  getRecordingRequirement,
} from "./recordingLaw";
import { RECORDING_JURISDICTIONS } from "@/lib/data/recordingLaw";
import { checkSafetyCopy } from "./safetyCopy";

describe("protective default (the load-bearing rule)", () => {
  it("unset jurisdiction ⇒ all-party flow with the spoken-notice step", () => {
    const r = getRecordingRequirement(undefined);
    expect(r.effectiveRegime).toBe("all-party");
    expect(r.steps).toEqual(["confirm-jurisdiction", "acknowledge", "spoken-notice", "record"]);
  });

  it("unknown and unrecognized codes ⇒ all-party", () => {
    expect(getRecordingRequirement("UNSET").effectiveRegime).toBe("all-party");
    expect(getRecordingRequirement("INTL").effectiveRegime).toBe("all-party");
    expect(getRecordingRequirement("NOT-A-CODE").effectiveRegime).toBe("all-party");
  });

  it("mixed jurisdictions ⇒ all-party (never resolved optimistically)", () => {
    for (const code of ["CT", "MI", "NV", "OR", "DE", "VT"]) {
      expect(getRecordingRequirement(code).effectiveRegime, code).toBe("all-party");
    }
  });

  it("traveling forces all-party even from a one-party jurisdiction", () => {
    expect(getRecordingRequirement("TX").effectiveRegime).toBe("one-party");
    expect(getRecordingRequirement("TX", { traveling: true }).effectiveRegime).toBe("all-party");
  });

  it("one-party unlocks ONLY via an affirmative known one-party selection", () => {
    const r = getRecordingRequirement("NY");
    expect(r.effectiveRegime).toBe("one-party");
    expect(r.steps).toEqual(["confirm-jurisdiction", "acknowledge", "record"]);
    // Even then the note keeps everyone-consent as the recommended default.
    expect(r.note.toLowerCase()).toContain("consent from everyone is still");
  });

  it("all-party states enforce all-party with the spoken notice", () => {
    for (const code of ["CA", "FL", "IL", "MD", "MA", "MT", "NH", "PA", "WA"]) {
      const r = getRecordingRequirement(code);
      expect(r.effectiveRegime, code).toBe("all-party");
      expect(r.steps).toContain("spoken-notice");
    }
  });

  it("recording is always the last step — consent always precedes capture", () => {
    for (const j of RECORDING_JURISDICTIONS) {
      const steps = getRecordingRequirement(j.code).steps;
      expect(steps[steps.length - 1]).toBe("record");
      expect(steps.indexOf("acknowledge")).toBeLessThan(steps.indexOf("record"));
    }
  });
});

describe("dataset + copy discipline", () => {
  it("every entry carries a lastReviewed date and a not-legal-advice note", () => {
    expect(RECORDING_JURISDICTIONS.length).toBeGreaterThanOrEqual(50);
    for (const j of RECORDING_JURISDICTIONS) {
      expect(j.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(j.note.toLowerCase()).toContain("not legal advice");
    }
  });

  it("every requirement note and the spoken notice pass safetyCopy (incl. no-covert-recording)", () => {
    const texts = [
      SPOKEN_NOTICE,
      NOT_LEGAL_ADVICE,
      ...RECORDING_JURISDICTIONS.map((j) => j.note),
      ...["CA", "TX", "UNSET", "INTL"].flatMap((c) => [
        getRecordingRequirement(c).note,
        getRecordingRequirement(c, { traveling: true }).note,
      ]),
    ];
    for (const t of texts) {
      expect(checkSafetyCopy(t).violations, t.slice(0, 50)).toEqual([]);
      // Nothing anywhere suggests recording without consent.
      expect(t.toLowerCase()).not.toMatch(/secretly|covertly|without (them|him|her) knowing/);
    }
  });

  it("the spoken notice puts consent on the recording itself", () => {
    expect(SPOKEN_NOTICE).toBe("This conversation is being recorded with everyone's consent.");
  });
});
