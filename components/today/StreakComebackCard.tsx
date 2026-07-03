"use client";

import { RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { StreakState } from "@/lib/types";

/**
 * Warm comeback prompt — shown when a streak has lapsed (current 0, but the
 * user has a history worth returning to). Never guilt: a break is just a
 * starting line. If the earn-back window is still open, it names the repair
 * path (two days back-to-back restores the old run).
 */
export function StreakComebackCard({ streak }: { streak: StreakState }) {
  return (
    <Card className="flex items-start gap-3 border-line bg-surface p-4">
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-elevated">
        <RotateCcw className="size-4 text-gold" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          Fresh start
        </p>
        <p className="mt-0.5 text-sm text-ivory">
          {streak.inRepairWindow
            ? `Your streak paused — but the window's still open. Hit the Minimum Viable Day two days running and your ${streak.longest}-day streak comes right back.`
            : `Every run starts with day one. Your best so far is ${streak.longest} days — today's a good day to start the next one.`}
        </p>
      </div>
    </Card>
  );
}
