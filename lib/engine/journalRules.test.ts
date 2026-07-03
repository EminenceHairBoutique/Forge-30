import { describe, expect, it } from "vitest";
import {
  DEFAULT_JOURNAL_CONSENT,
  JOURNAL_ATTRIBUTION,
  extractThemes,
  notesForConsumer,
  summarizeJournal,
  themesForCoach,
} from "./journalRules";
import { checkSafetyCopy } from "./safetyCopy";
import type { JournalNote } from "@/lib/types";

function note(overrides: Partial<JournalNote> = {}): JournalNote {
  return {
    id: Math.random().toString(36).slice(2),
    date: "2026-07-01",
    kind: "freewrite",
    text: "",
    tags: [],
    private: false,
    createdAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("consent gating — the critical path", () => {
  const notes = [
    note({ text: "work was heavy today" }),
    note({ text: "argument with my partner", private: true }),
    note({ text: "grateful for the gym session" }),
  ];

  it("every consumer is OFF by default and sees nothing", () => {
    for (const consumer of ["coach", "assessments", "lifeGraph"] as const) {
      expect(notesForConsumer(notes, DEFAULT_JOURNAL_CONSENT, consumer)).toEqual([]);
    }
  });

  it("consent is per-consumer: turning on the coach opens nothing else", () => {
    const consent = { ...DEFAULT_JOURNAL_CONSENT, coach: true };
    expect(notesForConsumer(notes, consent, "coach").length).toBe(2);
    expect(notesForConsumer(notes, consent, "assessments")).toEqual([]);
    expect(notesForConsumer(notes, consent, "lifeGraph")).toEqual([]);
  });

  it("the private flag ALWAYS wins, even with every consent on", () => {
    const allOn = { coach: true, assessments: true, lifeGraph: true };
    for (const consumer of ["coach", "assessments", "lifeGraph"] as const) {
      const visible = notesForConsumer(notes, allOn, consumer);
      expect(visible.some((n) => n.private)).toBe(false);
      expect(visible.map((n) => n.text)).not.toContain("argument with my partner");
    }
  });

  it("themesForCoach through the gate: consent off means zero themes", () => {
    const gated = notesForConsumer(notes, DEFAULT_JOURNAL_CONSENT, "coach");
    expect(themesForCoach(gated)).toEqual([]);
  });
});

describe("extractThemes", () => {
  it("maps keywords to themes deterministically", () => {
    expect(extractThemes("Deadline at work, slept badly, worried about rent")).toEqual([
      "work",
      "money",
      "stress",
    ]);
    expect(extractThemes("Grateful for a good workout")).toEqual(["gratitude", "training"]);
  });

  it("matches whole words only — no substring false positives", () => {
    // "workshop" must not fire "work"; "restaurant" must not fire "rest".
    expect(extractThemes("attended a workshop at the restaurant")).toEqual([]);
  });

  it("returns empty for text with no known themes", () => {
    expect(extractThemes("watered the plants")).toEqual([]);
  });
});

describe("summarizeJournal — deterministic reflection", () => {
  it("counts entries, days, themes, tags, and thought records", () => {
    const s = summarizeJournal([
      note({ text: "stressed about work", tags: ["Vent"] }),
      note({ text: "work again, deadline stress", date: "2026-07-02", tags: ["vent"] }),
      note({
        kind: "thoughtRecord",
        date: "2026-07-02",
        situation: "boss email",
        automaticThought: "I'll be fired",
        reframe: "one email is not a verdict",
      }),
    ]);
    expect(s.entryCount).toBe(3);
    expect(s.daysWithEntries).toBe(2);
    expect(s.thoughtRecords).toBe(1);
    expect(s.topThemes[0]).toEqual({ theme: "work", count: 3 });
    expect(s.topTags[0]).toEqual({ tag: "vent", count: 2 }); // case-normalized
  });

  it("is observation-only: every line passes the safety check, empty included", () => {
    const summaries = [
      summarizeJournal([]),
      summarizeJournal([
        note({ text: "anxious about money and my relationship, fight with partner" }),
        note({ text: "still anxious, another argument" }),
      ]),
    ];
    for (const s of summaries) {
      for (const line of s.lines) {
        expect(checkSafetyCopy(line).violations).toEqual([]);
      }
    }
  });

  it("the attribution line itself passes the safety check", () => {
    expect(checkSafetyCopy(JOURNAL_ATTRIBUTION).ok).toBe(true);
  });
});
