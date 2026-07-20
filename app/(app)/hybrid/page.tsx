"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Settings2, Swords } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/tabs";
import { ReadinessSheet } from "@/components/hybrid/ReadinessSheet";
import { SessionRunner } from "@/components/hybrid/SessionRunner";
import { BoxingTab } from "@/components/hybrid/BoxingTab";
import { MobilityTab } from "@/components/hybrid/MobilityTab";
import { HybridSettingsSheet } from "@/components/hybrid/HybridSettingsSheet";
import { ExerciseDetailSheet } from "@/components/hybrid/ExerciseDetailSheet";
import { useStorage } from "@/lib/storage/provider";
import { addDays, toISODate } from "@/lib/utils";
import { hybridExerciseById, HYBRID_WEEK } from "@/lib/data/hybridProgram";
import {
  accessoryEmphasis,
  DEFAULT_HYBRID_SETTINGS,
  hybridDayForDate,
  mesocycleWeek,
  newSessionState,
  plannedSets,
  readinessAdjustment,
  weeklySchedule,
} from "@/lib/engine/hybridTraining";
import { computePersonalRecords, suggestDeload, weeklyVolumeByMuscle } from "@/lib/engine/trainingRules";
import type {
  HybridReadinessCheckin,
  HybridSessionState,
  HybridSettings,
  WorkoutEntry,
} from "@/lib/types";

/**
 * Hybrid Athletic Bodybuilding dashboard (HT Phase 17) + entry to execution
 * mode. Sections are explicitly labeled: informational trends, automated
 * training suggestions, and medical warnings never share a surface — the red
 * band renders on bg-safety per the §2 safety-color rule.
 */

type Tab = "today" | "program" | "boxing" | "mobility";

const DAY_KIND_BADGE: Record<string, string> = {
  strength: "Strength",
  athletic: "Athletic",
  recovery: "Recovery",
};

export default function HybridPage() {
  const { adapter, revision, touch } = useStorage();
  const today = toISODate();
  const [tab, setTab] = useState<Tab>("today");
  const [settings, setSettings] = useState<HybridSettings>(DEFAULT_HYBRID_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [checkin, setCheckin] = useState<HybridReadinessCheckin | null>(null);
  const [session, setSession] = useState<HybridSessionState | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      adapter.getHybridSettings(),
      adapter.getHybridReadiness(today),
      adapter.getHybridSessionState(),
      adapter.listWorkouts(addDays(today, -27), today),
    ]).then(([s, r, st, w]) => {
      if (cancelled) return;
      setSettings(s);
      setCheckin(r);
      setSession(st);
      setWorkouts(w.filter((x) => x.id.startsWith("hybrid-")));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, revision, today]);

  const day = hybridDayForDate(today, settings.daysPerWeek);
  const meso = mesocycleWeek(settings.mesoStartDate, today, settings.mesoWeeks, settings.repeatWeek);
  const band = checkin?.band ?? null;
  const adjustment = band ? readinessAdjustment(band) : null;

  const weekStart = useMemo(() => {
    const js = new Date(`${today}T00:00:00`).getDay();
    return addDays(today, -((js + 6) % 7));
  }, [today]);

  const thisWeek = useMemo(
    () => workouts.filter((w) => w.date >= weekStart && w.date <= today),
    [workouts, weekStart, today]
  );
  const volume = useMemo(() => weeklyVolumeByMuscle(thisWeek), [thisWeek]);
  const prs = useMemo(() => computePersonalRecords(workouts).slice(0, 4), [workouts]);
  const deload = useMemo(() => suggestDeload(workouts, today), [workouts, today]);

  const painTrend = useMemo(() => {
    const recent = workouts.filter((w) => w.date >= addDays(today, -6));
    const prior = workouts.filter((w) => w.date < addDays(today, -6) && w.date >= addDays(today, -13));
    const avg = (list: WorkoutEntry[]) =>
      list.length === 0 ? null : list.reduce((a, w) => a + w.sessionPainScore, 0) / list.length;
    return { recent: avg(recent), prior: avg(prior) };
  }, [workouts, today]);

  const startSession = useCallback(async () => {
    if (!band || band === "red") return;
    const state = newSessionState(today, day.id, band, new Date().toISOString(), settings.preferredSubs);
    await adapter.saveHybridSessionState(state);
    setSession(state);
    touch();
  }, [adapter, band, day.id, settings.preferredSubs, today, touch]);

  const schedule = weeklySchedule(settings.daysPerWeek);
  const emphasis = accessoryEmphasis(settings.aestheticPriorities, settings.avoidTrapEmphasis);

  if (!loaded) {
    return (
      <div className="space-y-3 pb-safe-nav">
        <PageHeader title="Hybrid" subtitle="Loading…" />
        <div className="h-32 animate-pulse rounded-(--radius-card) bg-elevated" aria-hidden />
        <div className="h-48 animate-pulse rounded-(--radius-card) bg-elevated" aria-hidden />
      </div>
    );
  }

  if (!settings.enabled) {
    return (
      <div className="pb-safe-nav">
        <PageHeader title="Hybrid" subtitle="Athletic bodybuilding + boxing" />
        <Card>
          <CardContent className="space-y-3 pt-5 text-center">
            <Swords className="mx-auto size-8 text-gold" aria-hidden />
            <p className="text-sm leading-relaxed text-ivory">
              A six-day hybrid system: aesthetic hypertrophy, functional strength, explosive
              power, boxing, and mobility — with daily readiness, injury-aware substitutions,
              and pain-aware volume built in.
            </p>
            <p className="text-xs text-muted">
              Structured 4–8 week cycles with a built-in deload. Every session adapts to how you
              actually feel today.
            </p>
            <Button className="w-full" onClick={() => setSettingsOpen(true)}>
              Set up hybrid training
            </Button>
          </CardContent>
        </Card>
        <HybridSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={{ ...settings, enabled: true }}
          onSaved={setSettings}
        />
      </div>
    );
  }

  // Active session → execution mode replaces the dashboard.
  if (session) {
    return (
      <div className="pb-safe-nav">
        <PageHeader title="Hybrid" subtitle={`Week ${meso.week} · ${meso.label}`} />
        <SessionRunner
          state={session}
          settings={settings}
          mesoWeek={meso}
          onUpdate={setSession}
          onDone={() => setSession(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-safe-nav">
      <PageHeader
        title="Hybrid"
        subtitle={`Week ${meso.week}/${meso.totalWeeks} · ${meso.label}${meso.isDeload ? " — recovery emphasis" : ""}`}
        action={
          <Button variant="ghost" size="icon" aria-label="Hybrid settings" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-5" />
          </Button>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "today", label: "Today" },
          { value: "program", label: "Program" },
          { value: "boxing", label: "Boxing" },
          { value: "mobility", label: "Mobility" },
        ]}
      />

      {tab === "today" && (
        <>
          {/* Readiness — check-in state or result */}
          {band === "red" ? (
            <div className="rounded-(--radius-card) border border-danger/50 bg-safety p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-danger">
                <AlertTriangle className="size-4" aria-hidden /> Red readiness — do not train today
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ivory">
                Based on today&rsquo;s check-in, training is paused. If symptoms are severe or
                worsening — chest pain, breathing difficulty, numbness, loss of coordination —
                seek medical evaluation now. This app does not diagnose injuries or replace
                medical care.
              </p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => setReadinessOpen(true)}>
                Re-check readiness
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Readiness
                  {band && (
                    <Badge variant={band === "green" ? "success" : band === "yellow" ? "gold" : "caution"}>
                      {band === "orange" && <AlertTriangle className="size-3" aria-hidden />}
                      {band}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {checkin ? (
                  <p className="text-sm text-muted">
                    Pain {checkin.painScore}/10 · sleep {checkin.sleepHours}h ·{" "}
                    {adjustment?.recoveryOnly
                      ? "recovery work only today"
                      : adjustment && adjustment.setsMultiplier < 1
                        ? `sets reduced ~25%, effort capped at RPE ${adjustment.rpeCap}`
                        : "full session as programmed"}
                  </p>
                ) : (
                  <p className="text-sm text-muted">
                    A 30-second check-in tunes today&rsquo;s session to how you actually feel.
                  </p>
                )}
                <Button
                  variant={checkin ? "secondary" : "default"}
                  size="sm"
                  className="mt-2"
                  onClick={() => setReadinessOpen(true)}
                >
                  {checkin ? "Update check-in" : "Check in"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Today's session */}
          <Card className="corner-tick">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {day.label}
                <Badge variant="default">{DAY_KIND_BADGE[day.kind]}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted">{day.focus.join(" · ")}</p>
              <div className="space-y-1">
                {day.exerciseIds.map((id) => {
                  const ex = hybridExerciseById(id);
                  if (!ex) return null;
                  const sets = band ? plannedSets(ex, band, meso) : ex.sets;
                  const dropped = band && readinessAdjustment(band).dropExplosive && ex.explosive;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDetailId(id)}
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-line/50 px-2.5 text-left text-sm"
                    >
                      <span className="min-w-0 truncate text-ivory">{ex.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {dropped ? "skip today" : `${sets > 0 ? `${sets} × ` : ""}${ex.reps}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {day.kind !== "recovery" ? (
                band && band !== "red" && !readinessAdjustment(band).recoveryOnly ? (
                  <Button className="w-full" onClick={() => void startSession()}>
                    Start session
                  </Button>
                ) : band === null ? (
                  <Button className="w-full" onClick={() => setReadinessOpen(true)}>
                    Check in to start
                  </Button>
                ) : band !== "red" ? (
                  <p className="text-xs text-muted">
                    Orange readiness: today becomes mobility, easy cardio, or pain-free technique
                    work — the Mobility and Boxing (technical) tabs have you covered.
                  </p>
                ) : null
              ) : (
                <p className="text-xs text-muted">
                  Recovery day — nothing here is mandatory. Gentle movement counts in full.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Informational trends */}
          <Card>
            <CardHeader>
              <CardTitle>This week</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="microlabel text-muted">INFORMATIONAL — TRENDS, NOT TARGETS</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-(--radius-control) border border-line p-2.5">
                  <p className="text-xs text-muted">Sessions</p>
                  <p className="display-num text-xl text-ivory">{thisWeek.length}</p>
                </div>
                <div className="rounded-(--radius-control) border border-line p-2.5">
                  <p className="text-xs text-muted">Hard sets</p>
                  <p className="display-num text-xl text-ivory">
                    {Object.values(volume).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
              </div>
              {Object.keys(volume).length > 0 && (
                <div className="space-y-1">
                  {Object.entries(volume)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([muscle, sets]) => (
                      <div key={muscle} className="flex items-center justify-between text-xs">
                        <span className="text-muted">{muscle}</span>
                        <span className="text-ivory">{sets} sets</span>
                      </div>
                    ))}
                </div>
              )}
              {painTrend.recent !== null && (
                <p className="text-xs text-muted">
                  Session pain: {painTrend.recent.toFixed(1)}/10 this week
                  {painTrend.prior !== null ? ` (was ${painTrend.prior.toFixed(1)})` : ""} — informational only.
                </p>
              )}
              {prs.length > 0 && (
                <div>
                  <p className="microlabel mt-1 text-muted">RECENT BESTS</p>
                  {prs.map((p) => (
                    <div key={p.exerciseId} className="flex justify-between text-xs">
                      <span className="text-muted">{p.exerciseName}</span>
                      <span className="text-ivory">
                        {p.weight > 0 ? `${p.weight} × ` : ""}
                        {p.reps}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Automated suggestions */}
          {(deload.suggested || meso.isDeload || emphasis.suppressed.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Suggestions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="microlabel text-muted">AUTOMATED TRAINING SUGGESTIONS — NEVER MEDICAL ADVICE</p>
                {meso.isDeload && (
                  <p className="text-sm text-ivory">
                    Deload week: volume ~{Math.round((1 - meso.volumeMultiplier) * 100)}% down,
                    loads ~{Math.round((1 - meso.intensityMultiplier) * 100)}% lighter. Movement
                    practice and mobility carry the week.
                  </p>
                )}
                {deload.suggested && !meso.isDeload && <p className="text-sm text-ivory">{deload.reason}</p>}
                {emphasis.suppressed.map((s) => (
                  <p key={s.priority} className="text-xs text-muted">
                    {s.reason}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "program" && (
        <div className="space-y-3">
          {HYBRID_WEEK.map((d) => {
            const scheduledId = schedule[d.weekday];
            const active = scheduledId === d.id;
            const shown = active ? d : null;
            const weekdayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d.weekday];
            if (!shown && d.weekday !== 6) {
              // Day replaced by the reduced schedule — show what it became.
              const replacement = HYBRID_WEEK.find((x) => x.id === scheduledId);
              return (
                <Card key={d.weekday}>
                  <CardContent className="flex items-center justify-between py-3">
                    <span className="text-sm text-muted">
                      {weekdayName} · {replacement?.label ?? "Recovery"}
                    </span>
                    <Badge variant="default">{settings.daysPerWeek}-day plan</Badge>
                  </CardContent>
                </Card>
              );
            }
            if (!shown) return null;
            return (
              <Card key={d.weekday} className={d.kind === "strength" ? "corner-tick" : undefined}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {weekdayName} — {d.label}
                    <Badge variant="default">{DAY_KIND_BADGE[d.kind]}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-xs text-muted">{d.focus.join(" · ")}</p>
                  {d.exerciseIds.map((id) => {
                    const ex = hybridExerciseById(id);
                    if (!ex) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDetailId(id)}
                        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-1 text-left text-sm"
                      >
                        <span className="min-w-0 truncate text-ivory">{ex.name}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {ex.sets > 1 ? `${ex.sets} × ` : ""}
                          {ex.reps}
                        </span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
          <p className="text-center text-xs text-muted">
            <Activity className="mr-1 inline size-3.5" aria-hidden />
            Tap any movement for instructions, cues, substitutions, and your history.
          </p>
        </div>
      )}

      {tab === "boxing" && <BoxingTab />}
      {tab === "mobility" && <MobilityTab />}

      <ReadinessSheet
        open={readinessOpen}
        onOpenChange={setReadinessOpen}
        settings={settings}
        onSaved={setCheckin}
      />
      <HybridSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSaved={setSettings}
      />
      <ExerciseDetailSheet
        exerciseId={detailId}
        open={detailId !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
}
