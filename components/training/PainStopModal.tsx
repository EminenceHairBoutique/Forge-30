"use client";

import { OctagonAlert } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

/**
 * Shown the moment a set is completed with sharp pain (≥7/10) and a
 * thoracic/rib/scapular flag on the profile. Dismissible — but the pain
 * event is already logged on the set either way.
 */
export function PainStopModal({
  open,
  onOpenChange,
  exerciseName,
  painScore,
  onSwap,
  onReduce,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  painScore: number;
  onSwap: () => void;
  onReduce: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Sharp pain protocol">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-(--radius-control) border border-danger/30 bg-danger/10 p-3">
            <OctagonAlert className="mt-0.5 size-5 shrink-0 text-danger" />
            <p className="text-sm text-ivory">
              Pain {painScore}/10 logged on <strong>{exerciseName}</strong>. Protocol:
            </p>
          </div>
          <ol className="flex flex-col gap-2 text-sm text-ivory">
            <li>
              <strong className="text-danger">1. Stop the movement.</strong> Do not push through
              sharp thoracic, rib, or scapular pain.
            </li>
            <li>
              <strong className="text-gold">2. Log the pain.</strong> Done — it&apos;s on the set.
            </li>
            <li>
              <strong className="text-gold">3. Swap the exercise</strong> for a supported,
              pain-free variation.
            </li>
            <li>
              <strong className="text-gold">4. Reduce intensity for the day.</strong> Drop loads
              15–25% on everything that remains.
            </li>
          </ol>
          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={onSwap}>
              Swap this exercise
            </Button>
            <Button variant="secondary" onClick={onReduce}>
              Reduce intensity for the day
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Continue carefully
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
