import type { BodyMetric, ISODate, SpendingEntry } from "@/lib/types";
import { round1 } from "@/lib/utils";

/**
 * Weight change (lb) across a window of body metrics: last logged weight
 * minus first. Returns null with fewer than 2 weigh-ins — no trend exists.
 *
 * This raw delta stays as the fallback path (spec §0.1); the Adaptive
 * Expenditure Engine uses `calculateSmoothedWeightTrend` below.
 */
export function calculateWeightTrend(metrics: BodyMetric[]): number | null {
  const weighed = metrics
    .filter((m) => m.weightLb > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (weighed.length < 2) return null;
  return round1(weighed[weighed.length - 1]!.weightLb - weighed[0]!.weightLb);
}

export interface TrendWeightPoint {
  date: ISODate;
  /** The raw scale reading (lb). */
  weightLb: number;
  /** EWMA-smoothed trend weight (lb) — the number the expenditure math uses. */
  trendLb: number;
}

/**
 * Exponentially-weighted moving average over the weigh-in series — the
 * scale-noise filter under the Adaptive Expenditure Engine. Each weigh-in
 * pulls the trend `alpha` of the way toward the new reading, so day-to-day
 * water swings damp out while a real direction still shows within a week.
 * Returns one point per weigh-in, in date order; the last point's `trendLb`
 * is the current trend weight.
 */
export function calculateSmoothedWeightTrend(
  metrics: BodyMetric[],
  alpha = 0.3
): TrendWeightPoint[] {
  const weighed = metrics
    .filter((m) => m.weightLb > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendWeightPoint[] = [];
  let trend: number | null = null;
  for (const m of weighed) {
    trend = trend === null ? m.weightLb : trend + alpha * (m.weightLb - trend);
    out.push({ date: m.date, weightLb: m.weightLb, trendLb: round1(trend) });
  }
  return out;
}

export interface SpendingBreakdown {
  total: number;
  necessary: number;
  unnecessary: number;
  business: number;
  personal: number;
  stressPurchaseCount: number;
  byCategory: { category: string; total: number }[];
}

export function calculateSpendingBreakdown(entries: SpendingEntry[]): SpendingBreakdown {
  const byCategory = new Map<string, number>();
  let total = 0;
  let necessary = 0;
  let business = 0;
  let stressPurchaseCount = 0;

  for (const e of entries) {
    total += e.amount;
    if (e.necessary) necessary += e.amount;
    if (e.business) business += e.amount;
    if (e.stressPurchase) stressPurchaseCount += 1;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  return {
    total: round1(total),
    necessary: round1(necessary),
    unnecessary: round1(total - necessary),
    business: round1(business),
    personal: round1(total - business),
    stressPurchaseCount,
    byCategory: [...byCategory.entries()]
      .map(([category, catTotal]) => ({ category, total: round1(catTotal) }))
      .sort((a, b) => b.total - a.total),
  };
}
