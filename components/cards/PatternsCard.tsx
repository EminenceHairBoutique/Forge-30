"use client";

import { useState } from "react";
import { Sparkles, Waypoints } from "lucide-react";
import { usePatterns } from "@/lib/hooks/usePatterns";
import { JOURNAL_ATTRIBUTION } from "@/lib/engine/journalRules";
import { flagEnabled } from "@/lib/flags";
import { apiUrl, authHeaders } from "@/lib/api";
import { useTier } from "@/lib/hooks/useTier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * The LifeGraph surface (E14). Renders nothing until enough data crosses the
 * engine's sample-size guard — silence beats a false pattern. Observations
 * only, one suggested experiment each; neutral gold, never warning/danger.
 *
 * v3.3 Phase 4: behind FLAG(lifeGraphAI) + Pro, an optional AI read narrates
 * the deterministic findings above — narration only, never new patterns; the
 * deterministic lines stay free-visible either way.
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
  const { can } = useTier();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrating, setNarrating] = useState(false);
  if (patterns.length === 0) return null;

  const shown = patterns.slice(0, limit);
  const journalInformed = shown.some((p) => p.journalInformed);
  const aiRead = flagEnabled("lifeGraphAI") && can("lifeGraph");

  const narrate = async () => {
    setNarrating(true);
    try {
      const res = await fetch(apiUrl("/api/lifegraph/narrate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ patterns: shown.map((p) => p.line) }),
      });
      const data = (await res.json()) as { narrative?: string };
      // Any failure stays silent — the deterministic lines above ARE the finding.
      if (res.ok && data.narrative) setNarrative(data.narrative);
    } catch {
      // Deterministic patterns remain; narration is garnish.
    } finally {
      setNarrating(false);
    }
  };

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
        {aiRead &&
          (narrative ? (
            <p className="rounded-(--radius-control) bg-elevated px-3 py-2 text-sm leading-relaxed text-ivory">
              {narrative}
            </p>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              disabled={narrating}
              onClick={() => void narrate()}
            >
              <Sparkles className="size-4 text-gold" />
              {narrating ? "Reading…" : "AI read of these patterns"}
            </Button>
          ))}
        {journalInformed && <p className="text-[11px] text-muted">{JOURNAL_ATTRIBUTION}</p>}
        {footnote && <p className="text-[11px] text-muted">{footnote}</p>}
      </CardContent>
    </Card>
  );
}
