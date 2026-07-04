import type { AssessmentResult, ISODate, OutreachEntry, SkillTrackId } from "@/lib/types";
import { WEEKLY_CHALLENGES } from "@/lib/data/social";
import { daysBetween, mondayWeekday } from "@/lib/utils";
import { possiblePattern } from "./safetyCopy";

/**
 * Social-connection rules (E12) — pure. Consistency framing throughout:
 * outreach is a habit with a weekly bar (the E3 3-of-7 idea), isolation is a
 * pattern to notice gently, never a character verdict. The isolation signal
 * also feeds LifeGraph (E14) as a cross-domain input.
 */

export interface IsolationSignal {
  /** True when the quiet stretch is long enough to be worth naming. */
  flagged: boolean;
  daysSinceOutreach: number | null;
  line: string | null;
}

/**
 * Loneliness/self-isolation detector: a long gap since any logged outreach,
 * worse when recent mood runs low. Deliberately gentle — the output is an
 * observation plus one low-pressure move, never "you are isolated".
 */
export function isolationSignal(args: {
  outreach: OutreachEntry[];
  today: ISODate;
  /** Mean mood over recent days; null when unlogged. */
  recentMoodAvg: number | null;
  /** Days of quiet before the signal fires (default 10; 7 when mood is low). */
  thresholdDays?: number;
}): IsolationSignal {
  const { outreach, today, recentMoodAvg } = args;
  const last = [...outreach].map((o) => o.date).sort().at(-1) ?? null;
  const days = last ? daysBetween(last, today) : null;
  const lowMood = recentMoodAvg !== null && recentMoodAvg <= 4;
  const threshold = args.thresholdDays ?? (lowMood ? 7 : 10);

  // No outreach ever logged: quiet until there's a baseline to compare to.
  if (days === null) return { flagged: false, daysSinceOutreach: null, line: null };
  if (days < threshold) return { flagged: false, daysSinceOutreach: days, line: null };

  return {
    flagged: true,
    daysSinceOutreach: days,
    line: possiblePattern(
      `it's been ${days} days since a logged reach-out${lowMood ? ", alongside a low-mood stretch" : ""} — quiet weeks compound quietly.`,
      "One low-pressure move below counts fully; connection is maintained in small units."
    ),
  };
}

/** This ISO-week's challenge — deterministic by calendar week. */
export function weeklyChallenge(today: ISODate): string {
  const monday = new Date(`${today}T00:00:00`);
  monday.setDate(monday.getDate() - mondayWeekday(today));
  const week = Math.floor(monday.getTime() / (7 * 86400000));
  return WEEKLY_CHALLENGES[week % WEEKLY_CHALLENGES.length]!;
}

// --- Assessment-fed skill-track recommendations (E12) ---------------------------

export interface TrackRecommendation {
  trackId: SkillTrackId;
  why: string;
}

/**
 * Skill-track recommendations from the user's own E10 results. Each maps a
 * band to a track with the reason stated — a suggestion drawn from their own
 * answers, never a prescription. At most three, deterministic order.
 */
export function recommendTracks(results: AssessmentResult[]): TrackRecommendation[] {
  const latest = new Map<string, AssessmentResult>();
  for (const r of [...results].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if ((r.subject ?? "self") === "self") latest.set(r.assessmentId, r);
  }
  const trait = (aid: string, key: string) =>
    latest.get(aid)?.traits.find((t) => t.key === key);

  const recs: TrackRecommendation[] = [];
  const push = (trackId: SkillTrackId, why: string) => {
    if (!recs.some((r) => r.trackId === trackId)) recs.push({ trackId, why });
  };

  const assertive = trait("communicationStyle", "assertive");
  if (assertive && assertive.band !== "high") {
    push("communication", "your communication results show room to grow the direct-and-fair muscle");
  }
  const avoiding = trait("conflictStyle", "avoiding");
  if (avoiding?.band === "high") {
    push("communication", "your conflict style leans toward avoiding — raising things early is a trainable skill");
  }
  const reactivity = trait("bigFive", "neuroticism");
  if (reactivity?.band === "high") {
    push("regulation", "your Big Five shows a sensitive stress response — regulation reps pay off fastest there");
  }
  const consc = trait("bigFive", "conscientiousness");
  if (consc?.band === "low") {
    push("discipline", "your Big Five suggests structure doesn't come free — the discipline track builds it in small promises");
  }
  const extraversion = trait("bigFive", "extraversion");
  if (extraversion?.band === "low") {
    push("socialConfidence", "social reps in small doses fit an inward-leaning energy profile");
  }
  const anxious = trait("attachmentStyle", "anxiousLean");
  if (anxious?.band === "high") {
    push("regulation", "your attachment results point at the self-steadying skills the regulation track drills");
  }
  const values = latest.get("values");
  if (values?.ranking?.slice(0, 3).includes("health")) {
    push("nutritionBasics", "health sits in your top-3 values — nutrition literacy is its cheapest lever");
  }
  if (values?.ranking?.slice(0, 3).includes("wealth") || values?.ranking?.slice(0, 3).includes("achievement")) {
    push("careerBusiness", "your top values point at compounding professional skill");
  }

  return recs.slice(0, 3);
}
