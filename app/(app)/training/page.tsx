"use client";

import { useEffect, useMemo, useState } from "react";
import { BedDouble, CheckCircle2, Dumbbell, History, Play, Trophy, TriangleAlert } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { useDay } from "@/lib/hooks/useDay";
import { toISODate, addDays, uid } from "@/lib/utils";
import { WARMUP_CHECKLIST, MVW_SESSION, allExercises } from "@/lib/data/workoutPlan";
import {
  calculateReadinessScore,
  computePersonalRecords,
  generateInjuryModification,
  getPainAwareWorkoutAdjustment,
  suggestDeload,
  weeklyVolumeByMuscle,
} from "@/lib/engine/trainingRules";
import { workoutForDate } from "@/lib/engine/workoutBuilder";
import type {
  CustomWorkoutPlan,
  ExerciseDef,
  ExerciseSet,
  LoggedExercise,
  WorkoutEntry,
} from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckItem } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ExerciseCard } from "@/components/training/ExerciseCard";
import { ReadinessCard } from "@/components/training/ReadinessCard";
import { BuilderSheet } from "@/components/training/BuilderSheet";
import { InjuryIntakeSheet } from "@/components/training/InjuryIntakeSheet";
import { RestTimer } from "@/components/training/RestTimer";
import { PainStopModal } from "@/components/training/PainStopModal";
import { SwapSheet } from "@/components/training/SwapSheet";
import { MuscleHeatMap } from "@/components/training/HeatMap";

export default function TrainingPage() {
  const { adapter, profile, touch, revision } = useStorage();
  const today = toISODate();
  const { snapshot } = useDay(today);
  const [customPlan, setCustomPlan] = useState<CustomWorkoutPlan | null>(null);
  const plan = workoutForDate(customPlan, today);
  const defs = useMemo(() => new Map(allExercises().map((e) => [e.id, e])), []);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [injuryOpen, setInjuryOpen] = useState(false);

  const [workout, setWorkout] = useState<WorkoutEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [warmupChecked, setWarmupChecked] = useState<Set<string>>(new Set());
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [painModal, setPainModal] = useState<{ exerciseId: string; painScore: number } | null>(null);
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkoutEntry[]>([]);

  // Load today's workout once (edits happen only on this page).
  useEffect(() => {
    let cancelled = false;
    adapter.getWorkout(today).then((w) => {
      if (cancelled) return;
      setWorkout(w);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, today]);

  // History, PRs, weekly volume, custom plan.
  useEffect(() => {
    let cancelled = false;
    Promise.all([adapter.listAllWorkouts(), adapter.getCustomWorkoutPlan()]).then(
      ([all, custom]) => {
        if (cancelled) return;
        setHistory(all.reverse());
        setCustomPlan(custom);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [adapter, revision]);

  const prs = useMemo(() => computePersonalRecords(history), [history]);
  const weekVolume = useMemo(
    () => weeklyVolumeByMuscle(history.filter((w) => w.date >= addDays(today, -6))),
    [history, today]
  );

  const sessionPain = useMemo(() => {
    if (!workout) return 0;
    return Math.max(
      workout.sessionPainScore,
      ...workout.exercises.flatMap((e) => e.sets.map((s) => s.painScore)),
      0
    );
  }, [workout]);

  const adjustment = getPainAwareWorkoutAdjustment({
    sessionPainScore: sessionPain,
    painFlags: profile?.painFlags ?? {
      thoracic: false,
      rib: false,
      scapular: false,
      upperTrapDominant: false,
      leftArmAggravation: false,
    },
  });

  // Readiness from today's log (E8-T) — only once something is logged.
  const log = snapshot?.log;
  const readiness =
    log && (log.sleepHours > 0 || log.mood > 0)
      ? calculateReadinessScore({
          sleepHours: log.sleepHours,
          stress: log.stress,
          mood: log.mood,
          painScore: log.painScore,
        })
      : null;
  const deload = useMemo(() => suggestDeload(history, today), [history, today]);

  // General injury engine (E8-T): user-added injuries; the v1 pain-flag
  // engine above keeps covering the seeded thoracic/rib/scapular case.
  const injuryMod = useMemo(
    () =>
      generateInjuryModification({
        injuries: profile?.injuries ?? [],
        sessionPainScore: sessionPain,
        plannedExercises: plan.exercises,
      }),
    [profile?.injuries, sessionPain, plan]
  );

  const save = async (w: WorkoutEntry) => {
    setWorkout(w);
    await adapter.saveWorkout(w);
    touch();
  };

  const startWorkout = async (warmupDone: boolean) => {
    const w: WorkoutEntry = {
      id: uid(),
      date: today,
      splitLabel: plan.label,
      status: "inProgress",
      warmupDone,
      startedAt: new Date().toISOString(),
      completedAt: null,
      sessionPainScore: 0,
      note: "",
      exercises: plan.exercises.map((ex) => ({
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: [{ exerciseId: ex.id, weight: 0, reps: 0, rpe: 8, painScore: 0, note: "" }],
      })),
    };
    await save(w);
  };

  const logMvw = async () => {
    await save({
      id: uid(),
      date: today,
      splitLabel: MVW_SESSION.label,
      status: "complete",
      warmupDone: true,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      sessionPainScore: 0,
      note: "Minimum Viable Workout — ten easy minutes, full credit.",
      exercises: MVW_SESSION.exercises.map((ex) => ({
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: [{ exerciseId: ex.id, weight: 0, reps: 1, rpe: 5, painScore: 0, note: "" }],
      })),
    });
  };

  const markRest = async () => {
    await save({
      id: uid(),
      date: today,
      splitLabel: "Rest",
      status: "rest",
      warmupDone: false,
      startedAt: null,
      completedAt: new Date().toISOString(),
      sessionPainScore: 0,
      note: "Long walk, light mobility, weekly review.",
      exercises: [],
    });
  };

  const updateExercise = (exerciseId: string, sets: ExerciseSet[]) => {
    if (!workout) return;
    const w = {
      ...workout,
      exercises: workout.exercises.map((e) => (e.exerciseId === exerciseId ? { ...e, sets } : e)),
    };
    w.sessionPainScore = Math.max(
      0,
      ...w.exercises.flatMap((e) => e.sets.map((s) => s.painScore))
    );
    void save(w);
  };

  const handleSetComplete = (exercise: LoggedExercise, set: ExerciseSet) => {
    setRestStartedAt(Date.now());
    if (set.painScore >= 7) {
      setPainModal({ exerciseId: exercise.exerciseId, painScore: set.painScore });
    }
  };

  const applySwap = (fromId: string, replacement: ExerciseDef) => {
    if (!workout) return;
    void save({
      ...workout,
      exercises: workout.exercises.map((e) =>
        e.exerciseId === fromId
          ? {
              exerciseId: replacement.id,
              name: replacement.name,
              muscleGroup: replacement.muscleGroup,
              sets: [
                { exerciseId: replacement.id, weight: 0, reps: 0, rpe: 8, painScore: 0, note: "" },
              ],
              swappedFromId: fromId,
            }
          : e
      ),
    });
  };

  // Pain engine: append prehab drills to the session (idempotent).
  useEffect(() => {
    if (!workout || !adjustment.active || workout.status !== "inProgress") return;
    const missing = adjustment.appendedDrills.filter(
      (d) => !workout.exercises.some((e) => e.exerciseId === d.id)
    );
    if (missing.length === 0) return;
    void save({
      ...workout,
      exercises: [
        ...workout.exercises,
        ...missing.map((d) => ({
          exerciseId: d.id,
          name: d.name,
          muscleGroup: d.muscleGroup,
          sets: [{ exerciseId: d.id, weight: 0, reps: 0, rpe: 6, painScore: 0, note: "" }],
        })),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustment.active, workout?.exercises.length, workout?.status]);

  const completeWorkout = async () => {
    if (!workout) return;
    await save({ ...workout, status: "complete", completedAt: new Date().toISOString() });
  };

  const swapExercise = swapTarget
    ? (workout?.exercises.find((e) => e.exerciseId === swapTarget) ?? null)
    : null;

  if (!loaded || !profile) return null;

  const allWarm = WARMUP_CHECKLIST.every((w) => warmupChecked.has(w.id));

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Training"
        subtitle={
          plan.isRest
            ? "Rest day"
            : customPlan
              ? `${plan.label} · your plan`
              : plan.label
        }
        action={
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm">
                <History className="size-4 text-gold" /> History
              </Button>
            </SheetTrigger>
            <SheetContent title="Workout history">
              <div className="flex flex-col gap-2">
                {history.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted">No workouts logged yet.</p>
                )}
                {history.map((w) => {
                  const setCount = w.exercises.reduce(
                    (n, e) => n + e.sets.filter((s) => s.reps > 0).length,
                    0
                  );
                  return (
                    <div key={w.id} className="rounded-(--radius-control) border border-line bg-elevated px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ivory">{w.splitLabel}</p>
                        <Badge
                          variant={
                            w.status === "complete" ? "success" : w.status === "rest" ? "gold" : "default"
                          }
                        >
                          {w.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted">
                        {w.date} · {setCount} sets
                        {w.sessionPainScore > 0 ? ` · pain ${w.sessionPainScore}/10` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={() => setBuilderOpen(true)}>
          Build my plan
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setInjuryOpen(true)}>
          Injuries & limits
        </Button>
      </div>

      <ReadinessCard
        readiness={readiness}
        deload={deload}
        onLogMvw={logMvw}
        mvwLogged={workout?.splitLabel === MVW_SESSION.label}
      />

      {injuryMod.active && (
        <Card className="border-gold/30">
          <CardHeader>
            <CardTitle>Built around your injuries</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {injuryMod.messages.map((msg) => (
              <p key={msg} className="text-sm leading-relaxed text-ivory">
                {msg}
              </p>
            ))}
            {injuryMod.swaps.length > 0 && (
              <ul className="flex flex-col gap-1.5 border-t border-line pt-2">
                {injuryMod.swaps.map((swap) => (
                  <li key={swap.avoid.id} className="text-sm text-muted">
                    <span className="font-semibold text-ivory">
                      {swap.avoid.name}
                      {swap.replaceWith ? ` → ${swap.replaceWith.name}` : " → skip today"}
                    </span>{" "}
                    — {swap.why}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pain adjustment banner */}
      {adjustment.active && (
        <Card className="border-danger/40 bg-safety p-4">
          <p className="microlabel flex items-center gap-1.5 text-danger">
            <TriangleAlert className="size-3.5" />
            Pain-aware adjustment active
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {adjustment.messages.map((m, i) => (
              <li key={i} className="text-sm text-ivory">
                {m}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Rest day */}
      {plan.isRest && !workout && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <BedDouble className="size-10 text-gold" />
          <div>
            <p className="text-lg font-bold text-ivory">Rest day</p>
            <p className="mt-1 text-sm text-muted">
              Long walk, light mobility, and the weekly review. Recovery is training.
            </p>
          </div>
          <Button size="lg" onClick={markRest}>
            Mark rest day done
          </Button>
        </Card>
      )}
      {plan.isRest && workout?.status === "rest" && (
        <Card className="flex items-center gap-3 border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="size-6 text-success" />
          <p className="text-sm text-ivory">Rest day complete. See you on Monday's push day.</p>
        </Card>
      )}

      {/* Warm-up gate */}
      {!plan.isRest && !workout && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Warm-up — required before the session</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col">
              {WARMUP_CHECKLIST.map((item) => (
                <CheckItem
                  key={item.id}
                  label={item.label}
                  checked={warmupChecked.has(item.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(warmupChecked);
                    if (v) next.add(item.id);
                    else next.delete(item.id);
                    setWarmupChecked(next);
                  }}
                />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Today — {plan.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {plan.exercises.map((ex) => (
                <div key={ex.id} className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-ivory">{ex.name}</span>
                  <span className="shrink-0 text-xs text-muted tabular">{ex.prescription}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Button size="lg" disabled={!allWarm} onClick={() => startWorkout(true)}>
            <Play className="size-5" /> {allWarm ? "Start workout" : "Finish warm-up to start"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => startWorkout(false)}>
            Skip warm-up (not recommended)
          </Button>
        </>
      )}

      {/* Session logger */}
      {workout && workout.status !== "rest" && (
        <>
          {workout.exercises.map((ex) => {
            const def = defs.get(ex.exerciseId);
            return (
              <ExerciseCard
                key={ex.exerciseId}
                exercise={ex}
                def={def}
                flagOverhead={adjustment.avoidOverheadPressing && !!def?.overheadPressing}
                suggestSwap={
                  adjustment.active &&
                  (ex.muscleGroup === "back" || ex.muscleGroup === "chest") &&
                  !adjustment.suggestedSwapIds.includes(ex.exerciseId)
                }
                onSetsChange={(sets) => updateExercise(ex.exerciseId, sets)}
                onSwapRequest={() => setSwapTarget(ex.exerciseId)}
                onSetComplete={(set) => handleSetComplete(ex, set)}
              />
            );
          })}
          {workout.status === "inProgress" ? (
            <Button size="lg" onClick={completeWorkout}>
              <Dumbbell className="size-5" /> Complete workout
            </Button>
          ) : (
            <Card className="flex items-center gap-3 border-success/30 bg-success/5 p-4">
              <CheckCircle2 className="size-6 text-success" />
              <p className="text-sm text-ivory">
                {plan.label} complete.{" "}
                {sessionPain > 6 ? "Pain ran high — tomorrow stays light." : "Strong work."}
              </p>
            </Card>
          )}
        </>
      )}

      {/* PRs */}
      {prs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Personal records</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {prs.map((pr) => (
              <div key={pr.exerciseId} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm text-ivory">
                  <Trophy className="size-3.5 text-gold" /> {pr.exerciseName}
                </span>
                <span className="text-sm font-semibold text-ivory tabular">
                  {pr.weight} lb × {pr.reps}
                  <span className="ml-2 text-xs font-normal text-muted">{pr.date}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <MuscleHeatMap volume={weekVolume} />

      <RestTimer startedAt={restStartedAt} onDismiss={() => setRestStartedAt(null)} />

      <PainStopModal
        open={!!painModal}
        onOpenChange={(o) => !o && setPainModal(null)}
        exerciseName={
          painModal
            ? (workout?.exercises.find((e) => e.exerciseId === painModal.exerciseId)?.name ?? "")
            : ""
        }
        painScore={painModal?.painScore ?? 0}
        onSwap={() => {
          if (painModal) setSwapTarget(painModal.exerciseId);
          setPainModal(null);
        }}
        onReduce={() => setPainModal(null)}
      />

      <SwapSheet
        open={!!swapTarget}
        onOpenChange={(o) => !o && setSwapTarget(null)}
        exercise={swapExercise}
        def={swapExercise ? defs.get(swapExercise.exerciseId) : undefined}
        painSafeIds={adjustment.suggestedSwapIds}
        onSwap={(replacement) => {
          if (swapTarget) applySwap(swapTarget, replacement);
        }}
      />
      <BuilderSheet open={builderOpen} onOpenChange={setBuilderOpen} hasCustomPlan={!!customPlan} />
      <InjuryIntakeSheet open={injuryOpen} onOpenChange={setInjuryOpen} />
    </div>
  );
}
