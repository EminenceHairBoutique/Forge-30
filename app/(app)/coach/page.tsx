"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Gauge,
  ThumbsUp,
  TrendingDown,
  Dumbbell,
  UtensilsCrossed,
  Wallet,
  Brain,
  Target,
  RefreshCw,
} from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { toISODate, uid } from "@/lib/utils";
import { buildCoachInput } from "@/lib/engine/coachContext";
import { JOURNAL_ATTRIBUTION } from "@/lib/engine/journalRules";
import { generateMockAIFeedback, type CoachReview } from "@/lib/engine/mockCoach";
import type { AIReview } from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PatternsCard } from "@/components/cards/PatternsCard";

const SECTIONS: { key: keyof CoachReview; label: string; icon: typeof Gauge }[] = [
  { key: "scoreExplanation", label: "Today's score", icon: Gauge },
  { key: "wentWell", label: "What went well", icon: ThumbsUp },
  { key: "slipped", label: "What slipped", icon: TrendingDown },
  { key: "physicalAdjustment", label: "Physical adjustment", icon: Dumbbell },
  { key: "nutritionAdjustment", label: "Nutrition adjustment", icon: UtensilsCrossed },
  { key: "moneyAdjustment", label: "Money adjustment", icon: Wallet },
  { key: "mentalAdjustment", label: "Mental adjustment", icon: Brain },
  // Content supplies the timeframe ("Tomorrow's #1" / "Rest of today's #1").
  { key: "tomorrowPriority", label: "#1 priority", icon: Target },
];

export default function CoachPage() {
  const { adapter, profile, touch } = useStorage();
  const today = toISODate();
  const [review, setReview] = useState<AIReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adapter.getAIReview(today).then((r) => {
      if (cancelled) return;
      setReview(r);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, today]);

  // Deep link from the Evening Review card: /coach?auto=1 generates on arrival.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!loaded || !profile || review || autoRan.current) return;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("auto")) {
      autoRan.current = true;
      window.history.replaceState(null, "", "/coach");
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, profile, review]);

  const generate = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const input = await buildCoachInput(adapter, today, profile);

      // Try the live engine; fall back to the deterministic mock on any error.
      let content: CoachReview | null = null;
      let source: AIReview["source"] = "mock";
      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (res.ok) {
          const data = (await res.json()) as { review?: CoachReview };
          if (data.review?.tomorrowPriority) {
            content = data.review;
            source = "live";
          }
        }
      } catch {
        // Network/route failure — mock below.
      }
      if (!content) content = generateMockAIFeedback(input);

      const saved: AIReview = {
        id: review?.id ?? uid(),
        date: today,
        source,
        // Consented journal themes shaped this review → attribution shows (E6).
        journalInformed: input.journalThemes.length > 0,
        createdAt: new Date().toISOString(),
        ...content,
      };
      await adapter.saveAIReview(saved);
      setReview(saved);
      touch();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="AI Coach"
        subtitle="Honest feedback on what you actually logged."
        action={
          review ? (
            <Badge variant={review.source === "live" ? "gold" : "default"}>
              {review.source === "live" ? "live" : "mock engine"}
            </Badge>
          ) : undefined
        }
      />

      {!review && loaded && (
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <Sparkles className="size-10 text-gold" />
          <p className="text-sm text-muted">
            Log your day, then get the review: what worked, what slipped, and the one thing that
            matters most tomorrow.
          </p>
        </Card>
      )}

      {review && (
        <div className="flex flex-col gap-3">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <Card
              key={key}
              className={
                key === "tomorrowPriority" ? "border-gold/40 bg-gold/5 p-4" : "p-4"
              }
            >
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
                <Icon className="size-3.5 text-gold" /> {label}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ivory">{review[key]}</p>
            </Card>
          ))}
          {review.journalInformed && (
            <p className="text-center text-xs text-muted">{JOURNAL_ATTRIBUTION}</p>
          )}
          <p className="text-center text-xs text-muted">
            Generated {new Date(review.createdAt).toLocaleTimeString()} ·{" "}
            {review.source === "live" ? "Anthropic API" : "deterministic mock engine"}
          </p>
        </div>
      )}

      <Button size="lg" onClick={generate} disabled={loading || !loaded}>
        {loading ? (
          <>
            <RefreshCw className="size-5 animate-spin" /> Reading your day…
          </>
        ) : review ? (
          <>
            <RefreshCw className="size-5" /> Regenerate review
          </>
        ) : (
          <>
            <Sparkles className="size-5" /> Get today's review
          </>
        )}
      </Button>

      {/* Pattern review (E14) — deterministic LifeGraph observations the
          coach's pattern-review mode (E15) will discuss. */}
      <PatternsCard
        title="Pattern review"
        limit={3}
        footnote="Deterministic co-occurrence from your own logs — the coach never sees more than you do here."
      />

      <p className="px-2 text-center text-xs leading-relaxed text-muted">
        Coaching feedback is habit support, not medical, mental-health, legal, or financial
        advice.
      </p>
    </div>
  );
}
