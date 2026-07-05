"use client";

import Link from "next/link";
import { LifeBuoy, Wind } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { MvdStatus } from "@/lib/engine/dayPhase";
import type { DailyLog } from "@/lib/types";

/**
 * Hard Day mode — one tap collapses today to the Minimum Viable Day and
 * switches the coach to recovery framing. No guilt copy anywhere in this
 * flow; leaving the mode is just as easy as entering it.
 */
export function HardDaySheet({
  open,
  onOpenChange,
  log,
  mvd,
  onSetHardDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: DailyLog;
  /** Today's Minimum Viable Day status, per the user's own definition. */
  mvd: MvdStatus;
  onSetHardDay: (hardDay: boolean) => Promise<void>;
}) {
  const active = log.hardDay === true;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={active ? "Hard day mode is on" : "Having a hard day?"}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-(--radius-control) border border-gold/30 bg-gold/5 p-3">
            <LifeBuoy className="mt-0.5 size-5 shrink-0 text-gold" />
            <p className="text-sm text-ivory">
              {active
                ? "Today's only assignment is the Minimum Viable Day. Everything else is optional and nothing is being audited."
                : "Hard days happen. Switch today to your Minimum Viable Day. The coach moves to recovery framing, and nothing counts against you."}
            </p>
          </div>

          <div className="rounded-(--radius-control) bg-elevated px-3 py-2 text-sm">
            <p className="font-semibold text-ivory">The whole plan for today:</p>
            {mvd.met ? (
              <p className="mt-1 text-xs text-success">
                Minimum Viable Day already met. You’re done.
              </p>
            ) : (
              <ul className="mt-1 flex flex-col gap-0.5 text-muted">
                {mvd.remaining.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/mind"
            className="flex min-h-11 items-center justify-center gap-2 rounded-(--radius-control) border border-line bg-elevated text-sm font-semibold text-ivory active:border-gold/50"
            onClick={() => onOpenChange(false)}
          >
            <Wind className="size-4 text-gold" /> 60-second breathing reset
          </Link>

          {active ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={async () => {
                await onSetHardDay(false);
                onOpenChange(false);
              }}
            >
              Feeling steadier — back to the full day
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={async () => {
                await onSetHardDay(true);
                onOpenChange(false);
              }}
            >
              Switch today to the Minimum Viable Day
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
