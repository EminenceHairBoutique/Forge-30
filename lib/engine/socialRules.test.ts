import { describe, expect, it } from "vitest";
import { isolationSignal, recommendTracks, weeklyChallenge } from "./socialRules";
import { checkSafetyCopy } from "./safetyCopy";
import { SKILL_TRACKS } from "@/lib/data/skills";
import { LOW_PRESSURE_SUGGESTIONS } from "@/lib/data/social";
import type { AssessmentResult, OutreachEntry } from "@/lib/types";

function outreach(date: string): OutreachEntry {
  return { id: date, date, person: "A", channel: "text", note: "", createdAt: `${date}T10:00:00.000Z` };
}

describe("isolationSignal", () => {
  it("stays quiet with recent outreach or no baseline at all", () => {
    expect(isolationSignal({ outreach: [outreach("2026-07-01")], today: "2026-07-05", recentMoodAvg: 6 }).flagged).toBe(false);
    expect(isolationSignal({ outreach: [], today: "2026-07-05", recentMoodAvg: 3 }).flagged).toBe(false);
  });

  it("flags a long quiet stretch, earlier when mood runs low", () => {
    const normal = isolationSignal({ outreach: [outreach("2026-06-20")], today: "2026-07-01", recentMoodAvg: 7 });
    expect(normal.flagged).toBe(true);
    expect(normal.daysSinceOutreach).toBe(11);
    // 8 quiet days: not flagged at normal mood, flagged at low mood.
    expect(isolationSignal({ outreach: [outreach("2026-06-23")], today: "2026-07-01", recentMoodAvg: 7 }).flagged).toBe(false);
    expect(isolationSignal({ outreach: [outreach("2026-06-23")], today: "2026-07-01", recentMoodAvg: 3 }).flagged).toBe(true);
  });

  it("the line is gentle: Possible-pattern register, no verdicts", () => {
    const s = isolationSignal({ outreach: [outreach("2026-06-01")], today: "2026-07-01", recentMoodAvg: 3 });
    expect(s.line).toMatch(/^Possible pattern:/);
    expect(s.line!.toLowerCase()).not.toMatch(/lonely person|isolated person|antisocial|failure/);
    expect(checkSafetyCopy(s.line!).violations).toEqual([]);
  });
});

describe("weeklyChallenge", () => {
  it("is stable within a week and changes across weeks", () => {
    expect(weeklyChallenge("2026-07-06")).toBe(weeklyChallenge("2026-07-12")); // same Mon–Sun week
    expect(weeklyChallenge("2026-07-06")).not.toBe(weeklyChallenge("2026-07-13"));
  });
});

describe("recommendTracks", () => {
  function result(assessmentId: string, traits: Record<string, { score: number; band: "low" | "balanced" | "high" }>, ranking?: string[]): AssessmentResult {
    return {
      id: Math.random().toString(36).slice(2),
      assessmentId: assessmentId as AssessmentResult["assessmentId"],
      date: "2026-07-01",
      traits: Object.entries(traits).map(([key, v]) => ({ key, label: key, score: v.score, band: v.band, summary: "" })),
      ...(ranking ? { ranking } : {}),
      validity: { attentionFailed: 0, attentionTotal: 0, inconsistency: 0, acquiescence: 0, idealization: 0, speedFlag: false, confidence: 90, confidenceLevel: "high", notes: [] },
      createdAt: `2026-07-01T10:00:00.000Z`,
    };
  }

  it("maps bands to tracks with the reason stated, max three, only real tracks", () => {
    const recs = recommendTracks([
      result("bigFive", {
        neuroticism: { score: 80, band: "high" },
        conscientiousness: { score: 20, band: "low" },
        extraversion: { score: 20, band: "low" },
      }),
      result("communicationStyle", { assertive: { score: 30, band: "low" } }),
      result("values", {}, ["health", "freedom", "growth"]),
    ]);
    expect(recs.length).toBe(3);
    const ids = new Set(SKILL_TRACKS.map((t) => t.id));
    for (const r of recs) {
      expect(ids.has(r.trackId), r.trackId).toBe(true);
      expect(r.why.length).toBeGreaterThan(10);
      expect(checkSafetyCopy(r.why).violations).toEqual([]);
    }
  });

  it("no results → no recommendations; partner results ignored", () => {
    expect(recommendTracks([])).toEqual([]);
    const partnerOnly = { ...result("bigFive", { neuroticism: { score: 80, band: "high" } }), subject: "partner" as const };
    expect(recommendTracks([partnerOnly])).toEqual([]);
  });
});

describe("seeded social content", () => {
  it("low-pressure suggestions are safety-clean", () => {
    for (const s of LOW_PRESSURE_SUGGESTIONS) {
      expect(checkSafetyCopy(s).violations).toEqual([]);
    }
  });
});
