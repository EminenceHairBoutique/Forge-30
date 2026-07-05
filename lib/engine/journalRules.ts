import type { JournalConsent, JournalNote } from "@/lib/types";

/**
 * Journal rules (E6) — consent gating, theme extraction, and the
 * deterministic reflection summary. All pure.
 *
 * The privacy model has exactly two layers and one rule:
 *  1. Per-consumer consent (coach / assessments / lifeGraph), default OFF.
 *  2. Per-entry `private` flag.
 * The rule: `private` ALWAYS wins. A consumer sees an entry only when its
 * consent is on AND the entry is not private. Everything downstream reads the
 * journal exclusively through `notesForConsumer` so the gate can't be bypassed
 * by accident.
 */

export type JournalConsumer = keyof JournalConsent;

/** The journal is private by default — every consumer opt-in, none pre-checked. */
export const DEFAULT_JOURNAL_CONSENT: JournalConsent = {
  coach: false,
  assessments: false,
  lifeGraph: false,
};

/**
 * Attribution line required on every journal-informed output (E6). Shown
 * whenever consented journal content shaped what the user is reading.
 */
export const JOURNAL_ATTRIBUTION =
  "Informed by your journal — you control this in Mind → Journal privacy.";

/** THE consent gate. The only sanctioned way to read the journal for a consumer. */
export function notesForConsumer(
  notes: JournalNote[],
  consent: JournalConsent,
  consumer: JournalConsumer
): JournalNote[] {
  if (!consent[consumer]) return [];
  return notes.filter((n) => !n.private);
}

// --- Theme extraction ---------------------------------------------------------

/** Deterministic keyword → theme table. Lowercase substring match on words. */
const THEME_KEYWORDS: Record<string, string[]> = {
  work: ["work", "job", "boss", "deadline", "meeting", "coworker", "shift", "career"],
  sleep: ["sleep", "tired", "exhausted", "insomnia", "nap", "rest"],
  family: ["family", "mom", "dad", "mother", "father", "kids", "son", "daughter", "brother", "sister"],
  money: ["money", "spend", "spending", "broke", "debt", "bill", "bills", "budget", "rent"],
  health: ["pain", "injury", "sick", "doctor", "headache", "health"],
  relationship: ["partner", "wife", "husband", "girlfriend", "boyfriend", "relationship", "argument", "fight"],
  friends: ["friend", "friends", "lonely", "alone", "isolated", "social"],
  stress: ["stress", "stressed", "anxious", "anxiety", "overwhelmed", "worried", "panic"],
  gratitude: ["grateful", "gratitude", "thankful", "appreciate", "proud"],
  training: ["workout", "gym", "training", "lift", "run", "exercise"],
  food: ["food", "eating", "meal", "hungry", "craving", "appetite"],
};

/** Text a note contributes to theme matching (thought records include all parts). */
function noteText(note: JournalNote): string {
  return [
    note.text,
    note.situation,
    note.automaticThought,
    note.emotion,
    note.evidenceFor,
    note.evidenceAgainst,
    note.reframe,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Themes present in a piece of text, in table order. Deterministic. */
export function extractThemes(text: string): string[] {
  const words = new Set(text.toLowerCase().split(/[^a-z']+/).filter(Boolean));
  const found: string[] = [];
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some((k) => words.has(k))) found.push(theme);
  }
  return found;
}

// --- Deterministic reflection summary ------------------------------------------

export interface JournalSummary {
  entryCount: number;
  /** Days with at least one entry. */
  daysWithEntries: number;
  /** Themes by frequency (count = notes mentioning the theme), descending. */
  topThemes: { theme: string; count: number }[];
  /** Tags by frequency, descending. */
  topTags: { tag: string; count: number }[];
  /** Count of CBT thought records in the window. */
  thoughtRecords: number;
  /** Neutral, observation-only lines for the reflection card. */
  lines: string[];
}

/**
 * The mock-mode weekly reflection: pure counting, no interpretation. Lines
 * are observations ("stress came up in 4 of 6 entries"), never verdicts or
 * diagnoses — the register the safety module enforces. Live AI (flagged, E15)
 * may enhance this; it never replaces it.
 */
export function summarizeJournal(notes: JournalNote[]): JournalSummary {
  const themeCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const days = new Set<string>();
  let thoughtRecords = 0;

  for (const note of notes) {
    days.add(note.date);
    if (note.kind === "thoughtRecord") thoughtRecords += 1;
    for (const theme of extractThemes(noteText(note))) {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }
    for (const tag of note.tags) {
      const t = tag.trim().toLowerCase();
      if (t) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }

  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;
  const topThemes = [...themeCounts.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort(byCount)
    .slice(0, 5);
  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort(byCount)
    .slice(0, 5);

  const lines: string[] = [];
  if (notes.length === 0) {
    lines.push("No entries this week. The page is there whenever you want it.");
  } else {
    lines.push(
      `${notes.length} entr${notes.length === 1 ? "y" : "ies"} across ${days.size} day${days.size === 1 ? "" : "s"}.`
    );
    const first = topThemes[0];
    if (first && first.count > 1) {
      lines.push(
        `"${first.theme}" came up in ${first.count} entries — worth noticing, nothing more.`
      );
    }
    if (thoughtRecords > 0) {
      lines.push(
        `${thoughtRecords} thought record${thoughtRecords === 1 ? "" : "s"} worked through — that's the skill doing its job.`
      );
    }
  }

  return {
    entryCount: notes.length,
    daysWithEntries: days.size,
    topThemes,
    topTags,
    thoughtRecords,
    lines,
  };
}

/** Top theme names for the coach input — the only journal data the coach sees. */
export function themesForCoach(notes: JournalNote[], limit = 3): string[] {
  return summarizeJournal(notes).topThemes.slice(0, limit).map((t) => t.theme);
}
