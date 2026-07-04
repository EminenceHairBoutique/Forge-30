"use client";

import { useState } from "react";
import { Check, MessageSquare, Plus, Repeat, Trash2, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ExerciseDef, ExerciseSet, LoggedExercise } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Strong-style exercise logger: big set rows, fast weight/rep entry, RPE,
 * per-set pain score, notes, and a swap button.
 */
export function ExerciseCard({
  exercise,
  def,
  flagOverhead,
  suggestSwap,
  onSetsChange,
  onSwapRequest,
  onSetComplete,
}: {
  exercise: LoggedExercise;
  def: ExerciseDef | undefined;
  /** Pain engine: flag this movement as heavy overhead pressing. */
  flagOverhead: boolean;
  /** Pain engine: suggest swapping to a supported variation. */
  suggestSwap: boolean;
  onSetsChange: (sets: ExerciseSet[]) => void;
  onSwapRequest: () => void;
  onSetComplete: (set: ExerciseSet) => void;
}) {
  const [noteOpenIdx, setNoteOpenIdx] = useState<number | null>(null);

  const update = (idx: number, patch: Partial<ExerciseSet>) => {
    onSetsChange(exercise.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addSet = () => {
    const last = exercise.sets[exercise.sets.length - 1];
    onSetsChange([
      ...exercise.sets,
      {
        exerciseId: exercise.exerciseId,
        weight: last?.weight ?? 0,
        reps: 0,
        rpe: last?.rpe ?? 8,
        painScore: 0,
        note: "",
      },
    ]);
  };

  const removeSet = (idx: number) => {
    onSetsChange(exercise.sets.filter((_, i) => i !== idx));
  };

  return (
    <Card className={cn(flagOverhead && "border-warning/40")}>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ivory">
            {exercise.name}{" "}
            <span className="font-normal text-muted">{def?.prescription ?? ""}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {def?.perSide && <Badge>per side</Badge>}
            {exercise.swappedFromId && <Badge variant="gold">swapped in</Badge>}
            {flagOverhead && (
              <Badge variant="warning">
                <TriangleAlert className="size-3" /> overhead — avoid today
              </Badge>
            )}
            {suggestSwap && !exercise.swappedFromId && (
              <Badge variant="gold">pain-safe swap suggested</Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onSwapRequest} aria-label={`Swap ${exercise.name}`}>
          <Repeat className="size-4" /> Swap
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <div className="grid grid-cols-[1.6rem_1fr_1fr_4.2rem_4.2rem_2.9rem_2.2rem] items-center gap-1.5 px-1 microlabel text-muted">
          <span>#</span>
          <span>lb</span>
          <span>reps</span>
          <span>rpe</span>
          <span>pain</span>
          <span />
          <span />
        </div>
        {exercise.sets.map((set, idx) => {
          const done = set.reps > 0;
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1.6rem_1fr_1fr_4.2rem_4.2rem_2.9rem_2.2rem] items-center gap-1.5">
                <span className="text-center text-sm font-bold text-muted tabular">{idx + 1}</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  aria-label={`Set ${idx + 1} weight`}
                  value={set.weight || ""}
                  placeholder="0"
                  className="px-2 text-center"
                  onChange={(e) => update(idx, { weight: Math.max(0, Number(e.target.value) || 0) })}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  aria-label={`Set ${idx + 1} reps`}
                  value={set.reps || ""}
                  placeholder="0"
                  className="px-2 text-center"
                  onChange={(e) => update(idx, { reps: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                />
                <Select
                  aria-label={`Set ${idx + 1} RPE`}
                  value={set.rpe}
                  onChange={(e) => update(idx, { rpe: Number(e.target.value) })}
                >
                  {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label={`Set ${idx + 1} pain score`}
                  value={set.painScore}
                  onChange={(e) => update(idx, { painScore: Number(e.target.value) })}
                  className={cn(set.painScore >= 7 && "[&_select]:border-danger [&_select]:text-danger")}
                >
                  {Array.from({ length: 11 }, (_, i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  aria-label={`Complete set ${idx + 1}`}
                  onClick={() => onSetComplete(set)}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-(--radius-control) border transition-colors",
                    done
                      ? "border-success/40 bg-success/15 text-success"
                      : "border-line bg-elevated text-muted active:text-ivory"
                  )}
                >
                  <Check className="size-5" strokeWidth={3} />
                </button>
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    aria-label={`Set ${idx + 1} note`}
                    onClick={() => setNoteOpenIdx(noteOpenIdx === idx ? null : idx)}
                    className={cn("p-1", set.note ? "text-gold" : "text-muted")}
                  >
                    <MessageSquare className="size-4" />
                  </button>
                  {exercise.sets.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Delete set ${idx + 1}`}
                      onClick={() => removeSet(idx)}
                      className="p-1 text-muted active:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
              {noteOpenIdx === idx && (
                <Input
                  placeholder="Set note (grip, tempo, how it felt…)"
                  value={set.note}
                  onChange={(e) => update(idx, { note: e.target.value })}
                />
              )}
            </div>
          );
        })}
        <Button variant="ghost" size="sm" className="self-start" onClick={addSet}>
          <Plus className="size-4" /> Add set
        </Button>
      </CardContent>
    </Card>
  );
}
