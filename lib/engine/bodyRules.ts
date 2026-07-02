import type { BodyMetric, DailyLog, UserProfile } from "@/lib/types";
import { calculateWeightTrend } from "./trends";

/**
 * Body-metric auto-adjustment rules (Section 5.4). These surface as Coach
 * recommendations — the app never silently changes targets.
 */
export function getBodyRecommendations(args: {
  /** Trailing ~14 days of metrics (7 is enough for the weight rules). */
  metrics: BodyMetric[];
  /** Trailing 7 days of daily logs. */
  logs: DailyLog[];
  profile: UserProfile;
}): string[] {
  const { metrics, logs, profile } = args;
  const recs: string[] = [];

  const last7 = metrics.slice(-7);
  const trend = calculateWeightTrend(last7);

  if (trend !== null && Math.abs(trend) < 0.5) {
    recs.push("Weight has been flat for a week → add 250 kcal/day (rice + olive oil booster or a shake).");
  }

  if (trend !== null && trend >= 3) {
    const waists = last7.filter((m) => m.waistIn > 0);
    const waistUp =
      waists.length >= 2 && waists[waists.length - 1]!.waistIn > waists[0]!.waistIn;
    if (waistUp) {
      recs.push(
        `Weight is jumping fast (+${trend} lb) and waist is up → pull back 150–250 kcal/day; keep protein at ${profile.proteinTarget}g.`
      );
    }
  }

  const soreness = metrics.filter((m) => m.soreness > 0).slice(-4);
  const highSoreness = soreness.length >= 3 && soreness.every((m) => m.soreness >= 7);
  const highPainDays = logs.filter((l) => l.painScore >= 6).length;
  if (highSoreness || highPainDays >= 3) {
    recs.push("Soreness/pain has stayed high → cut training volume ~20% this week (drop a set per exercise).");
  }

  const proteinMisses = logs.filter(
    (l) => l.calories > 0 && l.protein < profile.proteinTarget * 0.8
  ).length;
  if (proteinMisses >= 3) {
    recs.push("Protein missed 3+ days this week → default to the easy wins: whey shake and Greek yogurt bowl templates.");
  }

  return recs;
}
