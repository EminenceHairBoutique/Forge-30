"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Flag,
  Info,
  OctagonX,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RestTimer } from "@/components/training/RestTimer";
import { SubSheet } from "./SubSheet";
import { ExerciseDetailSheet } from "./ExerciseDetailSheet";
import { useStorage } from "@/lib/storage/provider";
import { cn } from "@/lib/utils";
import { hybridDayById, hybridExerciseById } from "@/lib/data/hybridProgram";
import {
  plannedSets,
  readinessAdjustment,
  resolveSlotExercise,
  sessionToWorkoutEntry,
  type MesoWeek,
} from "@/lib/engine/hybridTraining";
import type { HybridSessionState, HybridSetLog, HybridSettings } from "@/lib/types";

/**
 * Workout execution mode (HT Phase 8): distraction-free runner over the
 * in-flight HybridSessionState. Every mutation persists through the adapter
 * immediately, so closing or refreshing the app resumes mid-set. Finishing
 * freezes the session into a canonical WorkoutEntry (PRs, volume, heat map,
 * exports all keep working) and remembers this session's substitutions.
 */

const BAND_CHIP: Record<string, { label: string; cls: string }> = {
  green: { label: "GREEN", cls: "border-success/40 text-success" },
  yellow: { label: "YELLOW — reduced", cls: "border-gold/40 text-gold" },
  orange: { label: "ORANGE — recovery", cls: "border-danger/40 text-danger" },
  red: { label: "RED — stop", cls: "border-danger/60 text-danger" },
};

export function SessionRunner({
  state,
  settings,
  mesoWeek,
  onUpdate,
  onDone,
}: {
  state: HybridSessionState;
  settings: HybridSettings;
  mesoWeek: MesoWeek;
  onUpdate: (s: HybridSessionState) => void;
  onDone: () => void;
}) {
  const { adapter, touch } = useStorage();
  const day = hybridDayById(state.dayId);
  const slots = useMemo(() => day?.exerciseIds ?? [], [day]);
  const [subOpen, setSubOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [restAt, setRestAt] = useState<number | null>(null);
  const [restSeconds, setRestSeconds] = useState(90);
  const [stopPrompt, setStopPrompt] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  // Set-entry fields
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [rir, setRir] = useState("");
  const [painBefore, setPainBefore] = useState("0");
  const [painAfter, setPainAfter] = useState("0");
  const [leftWeight, setLeftWeight] = useState("");
  const [rightWeight, setRightWeight] = useState("");
  const [isWarmup, setIsWarmup] = useState(false);
  const [failed, setFailed] = useState(false);
  const [setNote, setSetNote] = useState("");

  const idx = Math.min(state.currentIndex, Math.max(0, slots.length - 1));
  const slotId = slots[idx] ?? "";
  const slotDef = hybridExerciseById(slotId);
  const resolved = resolveSlotExercise(slotId, state.substitutions, {});
  const activeDef = hybridExerciseById(resolved.exerciseId) ?? slotDef;
  const subMeta = slotDef?.substitutions.find((s) => s.id === resolved.exerciseId);
  const activeName = activeDef?.name ?? subMeta?.name ?? slotId;

  const adjustment = readinessAdjustment(state.readinessBand);
  const target = slotDef ? plannedSets(slotDef, state.readinessBand, mesoWeek, state.setAdjustments[slotId] ?? 0) : 0;
  const logged = state.setLogs[slotId] ?? [];
  const workingLogged = logged.filter((s) => !s.isWarmup).length;

  const persist = (next: HybridSessionState) => {
    onUpdate(next);
    void adapter.saveHybridSessionState(next);
  };

  const completeSet = () => {
    const set: HybridSetLog = {
      setNumber: logged.length + 1,
      reps: Number(reps) || 0,
      weight: Number(weight) || 0,
      ...(slotDef?.perSide && leftWeight ? { leftWeight: Number(leftWeight) || 0 } : {}),
      ...(slotDef?.perSide && rightWeight ? { rightWeight: Number(rightWeight) || 0 } : {}),
      rpe: Number(rpe) || 0,
      ...(rir !== "" ? { rir: Number(rir) || 0 } : {}),
      painBefore: Number(painBefore) || 0,
      painAfter: Number(painAfter) || 0,
      isWarmup,
      failed,
      note: setNote,
    };
    const next: HybridSessionState = {
      ...state,
      setLogs: { ...state.setLogs, [slotId]: [...logged, set] },
    };
    persist(next);
    setPainBefore(painAfter);
    setSetNote("");
    setFailed(false);
    setIsWarmup(false);
    if (!set.isWarmup && slotDef?.restSeconds) {
      setRestSeconds(slotDef.restSeconds[1]);
      setRestAt(Date.now());
    }
  };

  const removeSet = (setIndex: number) => {
    const next = {
      ...state,
      setLogs: { ...state.setLogs, [slotId]: logged.filter((_, i) => i !== setIndex) },
    };
    persist(next);
  };

  const adjustSets = (delta: number) => {
    persist({
      ...state,
      setAdjustments: { ...state.setAdjustments, [slotId]: (state.setAdjustments[slotId] ?? 0) + delta },
    });
  };

  const go = (delta: number) => {
    const next = Math.min(Math.max(idx + delta, 0), slots.length - 1);
    persist({ ...state, currentIndex: next });
  };

  const skip = () => {
    persist({ ...state, skipped: [...new Set([...state.skipped, slotId])], currentIndex: Math.min(idx + 1, slots.length - 1) });
  };

  const flagPain = () => {
    const flagged = state.painFlagged.includes(slotId)
      ? state.painFlagged.filter((s) => s !== slotId)
      : [...state.painFlagged, slotId];
    persist({ ...state, painFlagged: flagged });
  };

  const recordStop = () => {
    persist({
      ...state,
      stopReasons: { ...state.stopReasons, [slotId]: stopReason || "stopped" },
      currentIndex: Math.min(idx + 1, slots.length - 1),
    });
    setStopPrompt(false);
    setStopReason("");
  };

  const pickSub = (subId: string | null) => {
    const subs = { ...state.substitutions };
    if (subId === null) delete subs[slotId];
    else subs[slotId] = subId;
    persist({ ...state, substitutions: subs });
  };

  const finish = async () => {
    const entry = sessionToWorkoutEntry(state, new Date().toISOString());
    await adapter.saveWorkout(entry);
    // Remember this session's substitutions for future sessions.
    if (Object.keys(state.substitutions).length > 0) {
      const current = await adapter.getHybridSettings();
      await adapter.saveHybridSettings({
        ...current,
        preferredSubs: { ...current.preferredSubs, ...state.substitutions },
      });
    }
    await adapter.saveHybridSessionState(null);
    touch();
    onDone();
  };

  const discard = async () => {
    await adapter.saveHybridSessionState(null);
    touch();
    onDone();
  };

  if (!day || !slotDef) return null;

  const prevDef = idx > 0 ? hybridExerciseById(slots[idx - 1] ?? "") : undefined;
  const nextDef = idx < slots.length - 1 ? hybridExerciseById(slots[idx + 1] ?? "") : undefined;
  const band = BAND_CHIP[state.readinessBand]!;
  const totalDone = slots.filter((s) => (state.setLogs[s] ?? []).some((x) => !x.isWarmup) || state.skipped.includes(s)).length;

  return (
    <div className="space-y-4 pb-40">
      {/* Header */}
      <div className="hull-cut border border-line bg-elevated p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="microlabel text-muted">EXECUTION MODE</p>
            <h2 className="font-display text-lg font-bold text-ivory">{day.label}</h2>
          </div>
          <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider", band.cls)}>
            {band.label}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className="plasma-bar h-full transition-all"
            style={{ width: `${slots.length ? Math.round((totalDone / slots.length) * 100) : 0}%` }}
            aria-hidden
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          {totalDone} of {slots.length} movements · week {mesoWeek.week}/{mesoWeek.totalWeeks} {mesoWeek.label}
          {adjustment.rpeCap ? ` · effort capped at RPE ${adjustment.rpeCap}` : ""}
        </p>
      </div>

      {/* Prev / next strip */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="min-w-0 flex-1 truncate">{prevDef ? `← ${prevDef.name}` : ""}</span>
        <span className="min-w-0 flex-1 truncate text-right">{nextDef ? `${nextDef.name} →` : "last one"}</span>
      </div>

      {/* Current exercise */}
      <div className="rounded-(--radius-card) border border-line bg-elevated p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-xl font-bold text-ivory">{activeName}</h3>
            {resolved.substituted && (
              <p className="text-xs text-gold">substituted for {slotDef.name}</p>
            )}
            <p className="mt-0.5 text-sm text-muted">
              {target > 0 ? `${target} sets` : "recovery"} × {slotDef.reps}
              {slotDef.perSide ? " per side" : ""}
              {slotDef.tempo ? ` · ${slotDef.tempo}` : ""}
              {slotDef.rpe ? ` · RPE ${adjustment.rpeCap ? `≤ ${adjustment.rpeCap}` : slotDef.rpe}` : ""}
            </p>
            {slotDef.explosive && adjustment.dropExplosive && (
              <p className="mt-1 text-xs text-gold">
                Reduced readiness: skip maximal explosive work today — smooth technique reps only.
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" aria-label="Exercise details" onClick={() => setDetailId(resolved.exerciseId)}>
              <Info className="size-5" />
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setSubOpen(true)}>
            <ArrowLeftRight className="size-4" /> Substitute
          </Button>
          <Button variant="secondary" size="sm" onClick={skip}>
            <SkipForward className="size-4" /> Skip
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={flagPain}
            aria-pressed={state.painFlagged.includes(slotId)}
            className={state.painFlagged.includes(slotId) ? "text-danger" : ""}
          >
            <Flag className="size-4" /> {state.painFlagged.includes(slotId) ? "Pain-flagged" : "Flag pain"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setStopPrompt(true)}>
            <OctagonX className="size-4" /> Stop
          </Button>
        </div>

        {stopPrompt && (
          <div className="mt-3 space-y-2 rounded-(--radius-control) bg-safety p-3">
            <p className="text-xs text-ivory">Why are you stopping this movement?</p>
            <Textarea
              value={stopReason}
              onChange={(e) => setStopReason(e.target.value)}
              placeholder="e.g. sharp shoulder pain at the bottom"
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={recordStop}>
                Record + next exercise
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStopPrompt(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Logged sets */}
        {logged.length > 0 && (
          <div className="mt-3 space-y-1">
            {logged.map((s, i) => (
              <button
                key={`${s.setNumber}-${i}`}
                type="button"
                onClick={() => removeSet(i)}
                className="flex w-full min-h-9 items-center justify-between rounded-lg border border-line/60 px-2.5 text-sm"
                aria-label={`Remove set ${i + 1}`}
              >
                <span className="text-muted">
                  {s.isWarmup ? "W" : `#${logged.slice(0, i + 1).filter((x) => !x.isWarmup).length}`}
                </span>
                <span className="text-ivory">
                  {s.leftWeight || s.rightWeight ? `L${s.leftWeight ?? 0}/R${s.rightWeight ?? 0}` : s.weight || "—"} × {s.reps}
                  {s.rpe > 0 ? ` @ ${s.rpe}` : ""}
                  {s.failed ? " ✕" : ""}
                </span>
                <span className={s.painAfter > 0 ? "text-danger" : "text-muted"}>pain {s.painAfter}</span>
              </button>
            ))}
            <p className="text-center text-[10px] text-muted">tap a set to remove it</p>
          </div>
        )}

        {/* Set entry */}
        {target > 0 && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="microlabel text-muted">{slotDef.perSide ? "Load (both)" : "Load"}</span>
                <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg/lb" className="mt-1" />
              </label>
              <label className="block">
                <span className="microlabel text-muted">Reps</span>
                <Input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder={slotDef.reps} className="mt-1" />
              </label>
              <label className="block">
                <span className="microlabel text-muted">RPE</span>
                <Input inputMode="decimal" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder={adjustment.rpeCap ? `≤${adjustment.rpeCap}` : "7"} className="mt-1" />
              </label>
            </div>

            <button
              type="button"
              className="text-xs text-muted underline-offset-2 min-h-9"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
            >
              {moreOpen ? "Hide options" : "More options (RIR, pain, warm-up, unilateral…)"}
            </button>

            {moreOpen && (
              <div className="space-y-2 rounded-(--radius-control) border border-line/60 p-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="microlabel text-muted">RIR</span>
                    <Input inputMode="numeric" value={rir} onChange={(e) => setRir(e.target.value)} className="mt-1" />
                  </label>
                  <label className="block">
                    <span className="microlabel text-muted">Pain before</span>
                    <Input inputMode="numeric" value={painBefore} onChange={(e) => setPainBefore(e.target.value)} className="mt-1" />
                  </label>
                  <label className="block">
                    <span className="microlabel text-muted">Pain after</span>
                    <Input inputMode="numeric" value={painAfter} onChange={(e) => setPainAfter(e.target.value)} className="mt-1" />
                  </label>
                </div>
                {slotDef.perSide && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="microlabel text-muted">Left load</span>
                      <Input inputMode="decimal" value={leftWeight} onChange={(e) => setLeftWeight(e.target.value)} className="mt-1" />
                    </label>
                    <label className="block">
                      <span className="microlabel text-muted">Right load</span>
                      <Input inputMode="decimal" value={rightWeight} onChange={(e) => setRightWeight(e.target.value)} className="mt-1" />
                    </label>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ivory">Warm-up set</span>
                  <Switch checked={isWarmup} onCheckedChange={setIsWarmup} aria-label="Warm-up set" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ivory">Set failed</span>
                  <Switch checked={failed} onCheckedChange={setFailed} aria-label="Set failed" />
                </div>
                <label className="block">
                  <span className="microlabel text-muted">Set note</span>
                  <Input value={setNote} onChange={(e) => setSetNote(e.target.value)} className="mt-1" />
                </label>
              </div>
            )}

            <Button className="w-full" onClick={completeSet}>
              Complete set {workingLogged + 1}
              {target > 0 ? ` of ${target}` : ""}
            </Button>

            <div className="flex justify-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => adjustSets(1)}>
                + add set
              </Button>
              <Button variant="ghost" size="sm" onClick={() => adjustSets(-1)} disabled={target <= 1}>
                − remove set
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation + finish */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous exercise">
          <ChevronLeft className="size-5" /> Prev
        </Button>
        <Button variant="secondary" onClick={() => go(1)} disabled={idx >= slots.length - 1} aria-label="Next exercise">
          Next <ChevronRight className="size-5" />
        </Button>
      </div>

      <Button className="w-full" onClick={finish}>
        Finish session
      </Button>
      <Button variant="ghost" className="w-full text-muted" onClick={discard}>
        Discard session (keeps nothing)
      </Button>

      <RestTimer startedAt={restAt} seconds={restSeconds} onDismiss={() => setRestAt(null)} />

      <SubSheet
        slot={slotDef}
        open={subOpen}
        onOpenChange={setSubOpen}
        equipment={settings.equipment}
        currentSubId={state.substitutions[slotId] ?? null}
        onPick={pickSub}
      />
      <ExerciseDetailSheet exerciseId={detailId} open={detailId !== null} onOpenChange={(o) => !o && setDetailId(null)} />
    </div>
  );
}
