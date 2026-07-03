"use client";

import { Activity, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExpenditureEstimate, WeeklyCheckIn } from "@/lib/engine/expenditure";

/**
 * Adaptive Expenditure card — trend weight, estimated expenditure, and the
 * weekly check-in's target suggestion with the *why*. While calibrating it
 * says so in plain language instead of guessing. Neutral/gold styling only:
 * a moving target is information, not a problem.
 */
export function ExpenditureCard({
  estimate,
  checkIn,
}: {
  estimate: ExpenditureEstimate;
  checkIn: WeeklyCheckIn;
}) {
  const calibrating = estimate.status === "calibrating";

  return (
    <Card className="border-gold/25">
      <CardHeader className="flex-row items-center gap-2">
        <Activity className="size-4 text-gold" />
        <CardTitle>Adaptive expenditure</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-4">
          <div>
            <p className="display-num text-xl text-gold">
              {estimate.trendWeightLb !== null ? estimate.trendWeightLb : "—"}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <Scale className="size-3" /> trend lb
            </p>
          </div>
          <div>
            <p className="display-num text-xl text-gold">
              {estimate.tdee !== null ? estimate.tdee.toLocaleString() : "—"}
            </p>
            <p className="text-xs text-muted">est. kcal/day out</p>
          </div>
          {estimate.weeklyTrendLb !== null && (
            <div>
              <p className="display-num text-xl text-gold">
                {estimate.weeklyTrendLb > 0 ? "+" : ""}
                {estimate.weeklyTrendLb}
              </p>
              <p className="text-xs text-muted">lb / week</p>
            </div>
          )}
        </div>

        <div className="rounded-(--radius-control) border border-gold/30 bg-gold/5 px-3 py-2.5">
          <p className="text-sm font-semibold text-ivory">{checkIn.headline}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{checkIn.why}</p>
        </div>

        {checkIn.proteinAnchorG !== null && (
          <p className="text-xs text-muted">
            Protein anchor: at your trend weight, keep protein at or above{" "}
            <span className="font-semibold text-ivory">{checkIn.proteinAnchorG}g</span>.
          </p>
        )}

        {calibrating && estimate.notes.length > 1 && (
          <ul className="flex flex-col gap-1">
            {estimate.notes.slice(1).map((n) => (
              <li key={n} className="text-xs text-muted">
                · {n}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
