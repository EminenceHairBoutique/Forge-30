"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { filterSubstitutions } from "@/lib/engine/hybridTraining";
import type { EquipmentAccess, HybridExercise } from "@/lib/types";

/**
 * Substitution picker (HT Phase 6): options filtered to the user's equipment,
 * each with why-safer / goal-preserved / injury notes / kind. Picking null
 * returns to the programmed movement. The chosen sub is remembered for future
 * sessions when the session completes.
 */
export function SubSheet({
  slot,
  open,
  onOpenChange,
  equipment,
  currentSubId,
  onPick,
}: {
  slot: HybridExercise | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  equipment: EquipmentAccess;
  currentSubId: string | null;
  onPick: (subId: string | null) => void;
}) {
  if (!slot) return null;
  const options = filterSubstitutions(slot.substitutions, equipment);
  const hidden = slot.substitutions.length - options.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={`Substitute ${slot.name}`}>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              onPick(null);
              onOpenChange(false);
            }}
            className={`w-full rounded-(--radius-control) border p-3 text-left ${
              currentSubId === null ? "border-gold/50 bg-gold/5" : "border-line"
            }`}
          >
            <p className="text-sm font-semibold text-ivory">{slot.name}</p>
            <p className="text-xs text-muted">As programmed</p>
          </button>

          {options.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPick(s.id);
                onOpenChange(false);
              }}
              className={`w-full rounded-(--radius-control) border p-3 text-left ${
                currentSubId === s.id ? "border-gold/50 bg-gold/5" : "border-line"
              }`}
            >
              <p className="flex items-center justify-between gap-2 text-sm font-semibold text-ivory">
                {s.name}
                <span className="flex shrink-0 gap-1">
                  <Badge variant="default">{s.kind}</Badge>
                  <Badge variant="default">{"●".repeat(s.difficulty)}</Badge>
                </span>
              </p>
              <p className="mt-1 text-xs text-muted">{s.whySafer}</p>
              <p className="text-xs text-muted">Preserves: {s.preservesGoal}</p>
              <p className="text-xs text-muted">{s.injuryNotes}</p>
            </button>
          ))}

          {options.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">
              No substitutions fit the current equipment setting.
            </p>
          )}
          {hidden > 0 && (
            <p className="text-center text-xs text-muted">
              {hidden} more option{hidden > 1 ? "s" : ""} hidden by the equipment setting.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
