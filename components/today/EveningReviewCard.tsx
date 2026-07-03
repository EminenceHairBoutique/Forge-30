"use client";

import { useRouter } from "next/navigation";
import { Moon, Sparkles, CalendarPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { vibrate } from "@/lib/utils";

/**
 * Evening Review — shown once the day boundary passes and no review exists
 * yet: the moment "score so far" resolves into the finished day. Generates
 * the coach review and offers tomorrow's plan.
 */
export function EveningReviewCard({ onPlanTomorrow }: { onPlanTomorrow: () => void }) {
  const router = useRouter();

  return (
    <Card className="animate-rise flex flex-col gap-3 border-gold/30 bg-gold/5 p-4">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gold">
        <Moon className="size-4" /> Evening review
      </p>
      <p className="text-sm text-ivory">
        The day is wrapped and the score is final. Two minutes closes the loop: the honest
        review, then tomorrow's #1.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => {
            vibrate(10);
            router.push("/coach?auto=1");
          }}
        >
          <Sparkles className="size-4" /> Run the review
        </Button>
        <Button size="sm" variant="secondary" onClick={onPlanTomorrow}>
          <CalendarPlus className="size-4 text-gold" /> Plan tomorrow
        </Button>
      </div>
    </Card>
  );
}
