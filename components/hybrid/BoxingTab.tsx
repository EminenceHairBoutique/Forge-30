"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { useStorage } from "@/lib/storage/provider";
import { uid, toISODate, cn } from "@/lib/utils";
import { BOXING_SESSIONS, ROUND_PRESETS, boxingSessionById } from "@/lib/data/boxing";
import type { BoxingSessionEntry, BoxingSessionType } from "@/lib/types";

/**
 * Boxing module (HT Phase 12): four session types with round/rest timers.
 * Presets 2:1 / 3:1 / 30:30 plus custom. End-timestamp timing (backgrounding
 * doesn't drift); haptic + audio cues where the platform supports them
 * (navigator.vibrate is a no-op on iOS Safari — documented, not faked).
 */

type Phase = "idle" | "work" | "rest" | "done";

function cue() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(200);
    if (typeof window !== "undefined" && "AudioContext" in window) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => void ctx.close();
    }
  } catch {
    // Cues are best-effort — silence is an acceptable fallback.
  }
}

export function BoxingTab() {
  const { adapter, touch, revision } = useStorage();
  const [type, setType] = useState<BoxingSessionType>("technical");
  const [preset, setPreset] = useState("3-1");
  const [work, setWork] = useState(180);
  const [rest, setRest] = useState(60);
  const [rounds, setRounds] = useState(5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [recent, setRecent] = useState<BoxingSessionEntry[]>([]);
  const endRef = useRef(0);
  const pauseLeftRef = useRef(0);

  const def = boxingSessionById(type);

  useEffect(() => {
    const to = toISODate();
    const from = toISODate(new Date(Date.now() - 6 * 86400000));
    void adapter.listBoxingSessions(from, to).then((s) => setRecent(s.reverse()));
  }, [adapter, revision]);

  useEffect(() => {
    if (phase === "idle" || phase === "done" || paused) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0) return;
      cue();
      if (phase === "work") {
        if (round >= rounds) {
          setPhase("done");
        } else {
          setPhase("rest");
          endRef.current = Date.now() + rest * 1000;
          setRemaining(rest);
        }
      } else if (phase === "rest") {
        setRound((r) => r + 1);
        setPhase("work");
        endRef.current = Date.now() + work * 1000;
        setRemaining(work);
      }
    }, 250);
    return () => clearInterval(t);
  }, [phase, paused, round, rounds, work, rest]);

  const applyPreset = (id: string) => {
    setPreset(id);
    const p = ROUND_PRESETS.find((x) => x.id === id);
    if (p) {
      setWork(p.workSeconds);
      setRest(p.restSeconds);
    }
  };

  const start = () => {
    setRound(1);
    setPhase("work");
    setPaused(false);
    endRef.current = Date.now() + work * 1000;
    setRemaining(work);
    cue();
  };

  const togglePause = () => {
    if (paused) {
      endRef.current = Date.now() + pauseLeftRef.current * 1000;
      setPaused(false);
    } else {
      pauseLeftRef.current = remaining;
      setPaused(true);
    }
  };

  const reset = () => {
    setPhase("idle");
    setPaused(false);
    setRound(1);
  };

  const logSession = async (completedRounds: number) => {
    const entry: BoxingSessionEntry = {
      id: uid(),
      date: toISODate(),
      type,
      roundsPlanned: rounds,
      roundsCompleted: completedRounds,
      workSeconds: work,
      restSeconds: rest,
      note: "",
      completedAt: new Date().toISOString(),
    };
    await adapter.saveBoxingSession(entry);
    touch();
    reset();
  };

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <Segmented
        value={type}
        onChange={setType}
        options={BOXING_SESSIONS.map((s) => ({ value: s.id, label: s.name }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>{def.name} session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">{def.intent}</p>
          <ul className="list-disc pl-5 text-sm text-ivory">
            {def.blocks.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted">{def.guidance}</p>
        </CardContent>
      </Card>

      {/* Timer */}
      <Card>
        <CardHeader>
          <CardTitle>Round timer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {phase === "idle" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {ROUND_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    aria-pressed={preset === p.id}
                    className={cn(
                      "min-h-11 rounded-(--radius-control) border px-3 text-sm",
                      preset === p.id ? "border-gold/50 bg-gold/10 text-gold" : "border-line text-muted"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPreset("custom")}
                  aria-pressed={preset === "custom"}
                  className={cn(
                    "min-h-11 rounded-(--radius-control) border px-3 text-sm",
                    preset === "custom" ? "border-gold/50 bg-gold/10 text-gold" : "border-line text-muted"
                  )}
                >
                  Custom
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="microlabel text-muted">Work (s)</span>
                  <Input
                    inputMode="numeric"
                    value={String(work)}
                    onChange={(e) => {
                      setWork(Number(e.target.value) || 0);
                      setPreset("custom");
                    }}
                    className="mt-1"
                  />
                </label>
                <label className="block">
                  <span className="microlabel text-muted">Rest (s)</span>
                  <Input
                    inputMode="numeric"
                    value={String(rest)}
                    onChange={(e) => {
                      setRest(Number(e.target.value) || 0);
                      setPreset("custom");
                    }}
                    className="mt-1"
                  />
                </label>
                <label className="block">
                  <span className="microlabel text-muted">Rounds</span>
                  <Input
                    inputMode="numeric"
                    value={String(rounds)}
                    onChange={(e) => setRounds(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1"
                  />
                </label>
              </div>
              <Button className="w-full" onClick={start} disabled={work <= 0}>
                <Play className="size-4" /> Start {rounds} × {Math.floor(work / 60) > 0 ? `${Math.floor(work / 60)}:${String(work % 60).padStart(2, "0")}` : `${work}s`}
              </Button>
            </>
          )}

          {(phase === "work" || phase === "rest") && (
            <div className="text-center">
              <p
                className={cn(
                  "microlabel",
                  phase === "work" ? "text-gold" : "text-cyan"
                )}
              >
                {phase === "work" ? `ROUND ${round} OF ${rounds}` : `REST — ROUND ${round + 1} NEXT`}
              </p>
              <p
                className="display-num mt-1 text-6xl font-bold text-ivory"
                role="timer"
                aria-live="polite"
                aria-label={`${phase === "work" ? "Round" : "Rest"} time remaining ${mm}:${ss}`}
              >
                {mm}:{ss}
              </p>
              {paused && <Badge variant="default" className="mt-2">paused</Badge>}
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="secondary" onClick={togglePause} aria-label={paused ? "Resume" : "Pause"}>
                  {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
                </Button>
                <Button variant="secondary" onClick={reset} aria-label="Reset timer">
                  <RotateCcw className="size-5" />
                </Button>
                <Button variant="ghost" onClick={() => void logSession(phase === "work" ? round - 1 : round)}>
                  End + log
                </Button>
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="text-center">
              <p className="text-lg font-bold text-success">All {rounds} rounds complete</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button onClick={() => void logSession(rounds)}>Log session</Button>
                <Button variant="ghost" onClick={reset}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>This week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {recent.map((s) => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-muted">
                  {s.date} · {boxingSessionById(s.type).name}
                </span>
                <span className="text-ivory">
                  {s.roundsCompleted}/{s.roundsPlanned} rounds
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
