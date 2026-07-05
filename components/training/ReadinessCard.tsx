"use client";

import { BatteryMedium, Feather, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DeloadSuggestion, ReadinessResult } from "@/lib/engine/trainingRules";

/**
 * Readiness + deload strip above today's session (E8-T). Neutral framing
 * always: a low-readiness day gets a lighter plan, not a lecture; a deload
 * is part of the program, not a setback.
 */
export function ReadinessCard({
  readiness,
  deload,
  onLogMvw,
  mvwLogged,
}: {
  readiness: ReadinessResult | null;
  deload: DeloadSuggestion;
  onLogMvw: () => void;
  mvwLogged: boolean;
}) {
  if (!readiness && !deload.suggested) return null;

  return (
    <Card className="flex flex-col gap-2.5 p-4">
      {readiness && (
        <div className="flex items-start gap-3">
          <BatteryMedium className="mt-0.5 size-5 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="microlabel text-muted">
              Readiness {readiness.score}/100
            </p>
            <p className="mt-0.5 text-sm text-ivory">{readiness.suggestion}</p>
            {readiness.band === "minimum" && !mvwLogged && (
              <Button size="sm" className="mt-2" onClick={onLogMvw}>
                <Feather className="size-4" /> Log the Minimum Viable Workout
              </Button>
            )}
          </div>
        </div>
      )}
      {deload.suggested && (
        <div className="flex items-start gap-3 border-t border-line pt-2.5">
          <TrendingDown className="mt-0.5 size-5 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="microlabel text-gold">
              Deload week suggested
            </p>
            <p className="mt-0.5 text-sm text-ivory">{deload.reason}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
