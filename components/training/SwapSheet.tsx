"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { allExercises } from "@/lib/data/workoutPlan";
import type { ExerciseDef, LoggedExercise } from "@/lib/types";

/**
 * Swap picker: the exercise's own listed swaps first, then pain-safe
 * suggestions, then everything else in the same muscle group.
 */
export function SwapSheet({
  open,
  onOpenChange,
  exercise,
  def,
  painSafeIds,
  onSwap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: LoggedExercise | null;
  def: ExerciseDef | undefined;
  painSafeIds: string[];
  onSwap: (replacement: ExerciseDef) => void;
}) {
  if (!exercise) return null;

  const all = allExercises();
  const listed = (def?.swaps ?? [])
    .map((id) => all.find((e) => e.id === id))
    .filter((e): e is ExerciseDef => !!e);
  const painSafe = all.filter(
    (e) => painSafeIds.includes(e.id) && e.id !== exercise.exerciseId && !listed.some((l) => l.id === e.id)
  );
  const sameGroup = all.filter(
    (e) =>
      e.muscleGroup === exercise.muscleGroup &&
      e.id !== exercise.exerciseId &&
      !listed.some((l) => l.id === e.id) &&
      !painSafe.some((p) => p.id === e.id)
  );

  const Row = ({ ex, badge }: { ex: ExerciseDef; badge?: string }) => (
    <button
      type="button"
      onClick={() => {
        onSwap(ex);
        onOpenChange(false);
      }}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-(--radius-control) border border-line bg-elevated px-3 py-2 text-left active:border-gold/50 lg:hover:border-gold/50"
    >
      <span>
        <span className="block text-sm font-semibold text-ivory">{ex.name}</span>
        <span className="block text-xs text-muted">
          {ex.prescription} · {ex.muscleGroup}
        </span>
      </span>
      {badge && <Badge variant="gold">{badge}</Badge>}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={`Swap ${exercise.name}`}>
        <div className="flex flex-col gap-2">
          {listed.map((ex) => (
            <Row key={ex.id} ex={ex} badge="recommended" />
          ))}
          {painSafe.map((ex) => (
            <Row key={ex.id} ex={ex} badge="pain-safe" />
          ))}
          {sameGroup.map((ex) => (
            <Row key={ex.id} ex={ex} />
          ))}
          {listed.length + painSafe.length + sameGroup.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">No alternates for this movement.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
