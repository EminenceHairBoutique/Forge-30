"use client";

import { Waypoints } from "lucide-react";
import { usePatterns } from "@/lib/hooks/usePatterns";
import { JOURNAL_ATTRIBUTION } from "@/lib/engine/journalRules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The LifeGraph surface (E14). Renders nothing until enough data crosses the
 * engine's sample-size guard — silence beats a false pattern. Observations
 * only, one suggested experiment each; neutral gold, never warning/danger.
 */
export function PatternsCard({
  title = "Patterns",
  limit = 2,
  footnote,
}: {
  title?: string;
  limit?: number;
  footnote?: string;
}) {
  const { patterns } = usePatterns();
  if (patterns.length === 0) return null;

  const shown = patterns.slice(0, limit);
  const journalInformed = shown.some((p) => p.journalInformed);

  return (
    <Card className="border-gold/25 bg-gold/5">
      <CardHeader className="flex-row items-center gap-2">
        <Waypoints className="size-4 shrink-0 text-gold" />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {shown.map((p) => (
          <div key={p.id} className="flex flex-col gap-0.5">
            <p className="text-sm leading-relaxed text-ivory">{p.line}</p>
            <p className="text-[11px] text-muted">
              {p.hits} of {p.qualifyingDays} days · last {p.window} days · co-occurrence, not
              causation
            </p>
          </div>
        ))}
        {journalInformed && <p className="text-[11px] text-muted">{JOURNAL_ATTRIBUTION}</p>}
        {footnote && <p className="text-[11px] text-muted">{footnote}</p>}
      </CardContent>
    </Card>
  );
}
