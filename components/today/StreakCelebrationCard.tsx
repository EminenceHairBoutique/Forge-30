"use client";

import { useState } from "react";
import { Flame, Share2, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { vibrate } from "@/lib/utils";

const MILESTONE_COPY: Record<number, string> = {
  7: "One full week of showing up. The habit is real now.",
  14: "Two weeks straight. This is who you are becoming.",
  21: "Three weeks — the stretch where most people quit. You didn't.",
  30: "Thirty days. A full cycle of consistency, earned one day at a time.",
};

/**
 * Milestone celebration (7/14/21/30 days). User-initiated share only — nothing
 * leaves the device unless they tap Share. Dismissing marks the milestone seen
 * so it never re-fires. Pure celebration, never pressure.
 */
export function StreakCelebrationCard({
  milestone,
  onDismiss,
}: {
  milestone: number;
  onDismiss: () => void;
}) {
  const [shared, setShared] = useState(false);
  const message = `${milestone}-day streak on Forge30 — ${MILESTONE_COPY[milestone] ?? "consistency compounding."}`;

  const share = async () => {
    vibrate(10);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: message });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setShared(true);
        setTimeout(() => setShared(false), 1600);
      }
    } catch {
      // User cancelled the share sheet, or neither API is available — no-op.
    }
  };

  return (
    <Card className="animate-rise relative flex flex-col items-center gap-3 border-gold/40 bg-gold/10 p-5 text-center">
      <button
        type="button"
        aria-label="Dismiss celebration"
        onClick={onDismiss}
        className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full text-muted active:text-ivory"
      >
        <X className="size-4" />
      </button>
      <div className="flex size-14 items-center justify-center rounded-full bg-gold/15">
        <Flame className="size-7 text-gold" />
      </div>
      <div>
        <p className="text-2xl font-extrabold tracking-tight text-ivory">{milestone}-day streak</p>
        <p className="mt-1 text-sm text-muted">{MILESTONE_COPY[milestone] ?? "Consistency compounding."}</p>
      </div>
      <div className="flex w-full gap-2">
        <Button size="sm" className="flex-1" onClick={share}>
          {shared ? (
            <>
              <Check className="size-4" /> Copied
            </>
          ) : (
            <>
              <Share2 className="size-4" /> Share
            </>
          )}
        </Button>
        <Button size="sm" variant="secondary" onClick={onDismiss}>
          Keep going
        </Button>
      </div>
    </Card>
  );
}
