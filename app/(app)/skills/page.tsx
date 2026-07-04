"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Flame, Sparkle, Undo2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { computeStreak } from "@/lib/engine/streaks";
import { recommendTracks } from "@/lib/engine/socialRules";
import { toISODate, clamp, daysBetween, uid } from "@/lib/utils";
import { SKILL_TRACKS, getDailySkillTask } from "@/lib/data/skills";
import { BOOK_PLAN } from "@/lib/data/books";
import { PROGRAM_LENGTH_DAYS } from "@/lib/data/defaults";
import type { AssessmentResult, SkillTask, SkillTrackDef } from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckItem } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const DEFAULT_ACTIVE_TRACKS = ["finance", "regulation", "movement"];

/** Per-track streak via the shared engine (freezes/earn-back included). */
function streakFor(tasks: SkillTask[], trackId: string, today: string): number {
  const days = tasks.filter((t) => t.trackId === trackId).map((t) => t.date);
  return computeStreak(`skill:${trackId}`, days, today).current;
}

export default function SkillsPage() {
  const { adapter, profile, saveProfile, revision, touch } = useStorage();
  const today = toISODate();
  const [tasks, setTasks] = useState<SkillTask[]>([]);
  const [checkedBooks, setCheckedBooks] = useState<number[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [completing, setCompleting] = useState<SkillTrackDef | null>(null);
  const [minutes, setMinutes] = useState("15");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    Promise.all([
      adapter.listSkillTasks(profile.startDate, today),
      adapter.getCheckedBooks(),
      adapter.listAssessmentResults(),
    ]).then(([t, b, r]) => {
      if (cancelled) return;
      setTasks(t);
      setCheckedBooks(b);
      setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, profile, today, revision]);

  const dayNumber = profile
    ? clamp(daysBetween(profile.startDate, today) + 1, 1, PROGRAM_LENGTH_DAYS)
    : 1;

  const xpByTrack = useMemo(() => {
    const xp: Record<string, number> = {};
    for (const t of tasks) xp[t.trackId] = (xp[t.trackId] ?? 0) + t.minutes;
    return xp;
  }, [tasks]);

  if (!profile) return null;

  const activeIds = profile.activeSkillTracks ?? DEFAULT_ACTIVE_TRACKS;
  const activeTracks = SKILL_TRACKS.filter((t) => activeIds.includes(t.id));
  // From the user's own assessment results (E10) — suggestions, not homework.
  const recommendations = recommendTracks(results).filter((r) => !activeIds.includes(r.trackId));

  const toggleTrack = async (id: string, on: boolean) => {
    const next = on ? [...activeIds, id] : activeIds.filter((t) => t !== id);
    await saveProfile({ ...profile, activeSkillTracks: next });
    touch();
  };

  const complete = async () => {
    if (!completing) return;
    await adapter.saveSkillTask({
      id: uid(),
      trackId: completing.id,
      date: today,
      taskLabel: getDailySkillTask(completing, dayNumber),
      minutes: Math.max(1, Math.round(Number(minutes) || 15)),
      note: note.trim(),
      completedAt: new Date().toISOString(),
    });
    touch();
    setCompleting(null);
    setMinutes("15");
    setNote("");
  };

  const undo = async (id: string) => {
    await adapter.deleteSkillTask(id);
    touch();
  };

  const toggleBook = async (week: number, checked: boolean) => {
    const next = checked ? [...checkedBooks, week] : checkedBooks.filter((w) => w !== week);
    setCheckedBooks(next);
    await adapter.saveCheckedBooks(next);
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Skills"
        subtitle={`Day ${dayNumber} — 10–20 minutes each`}
        action={
          <Button size="sm" variant="secondary" onClick={() => setManageOpen(true)}>
            Manage tracks
          </Button>
        }
      />

      {recommendations.length > 0 && (
        <Card className="border-gold/30 bg-gold/5">
          <CardHeader>
            <CardTitle>Recommended from your assessments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recommendations.map((rec) => {
              const track = SKILL_TRACKS.find((t) => t.id === rec.trackId);
              if (!track) return null;
              return (
                <div key={rec.trackId} className="flex items-center gap-2 rounded-(--radius-control) bg-elevated px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ivory">{track.name}</p>
                    <p className="text-xs text-muted">{rec.why}.</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void toggleTrack(rec.trackId, true)}>
                    Add
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {activeTracks.map((track) => {
        const todayTask = getDailySkillTask(track, dayNumber);
        const doneToday = tasks.filter((t) => t.trackId === track.id && t.date === today);
        const xp = xpByTrack[track.id] ?? 0;
        const streak = streakFor(tasks, track.id, today);
        const weekIndex = Math.min(Math.ceil(dayNumber / 7), track.weeklyMilestones.length);
        return (
          <Card key={track.id}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>{track.name}</CardTitle>
                <p className="mt-0.5 text-xs text-muted">{track.description}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="gold">
                  <Sparkle className="size-3" /> {xp} XP
                </Badge>
                {streak > 0 && (
                  <Badge variant="success">
                    <Flame className="size-3" /> {streak}-day streak
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="rounded-(--radius-control) border border-gold/30 bg-gold/5 px-3 py-2.5">
                <p className="microlabel text-gold">
                  Today's task
                </p>
                <p className="mt-0.5 text-sm font-medium text-ivory">{todayTask}</p>
              </div>
              {doneToday.length === 0 ? (
                <Button onClick={() => setCompleting(track)}>Complete today's task</Button>
              ) : (
                doneToday.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded-(--radius-control) bg-elevated px-3 py-2">
                    <span className="flex items-center gap-2 text-sm text-ivory">
                      <CheckCircle2 className="size-4 text-success" />
                      {t.minutes} min logged{t.note ? ` — ${t.note}` : ""}
                    </span>
                    <button
                      type="button"
                      aria-label="Undo completion"
                      onClick={() => undo(t.id)}
                      className="flex size-11 items-center justify-center rounded-full text-muted active:text-danger"
                    >
                      <Undo2 className="size-4" />
                    </button>
                  </div>
                ))
              )}
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-muted">
                  Week {weekIndex} milestone & all weekly milestones
                </summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {track.weeklyMilestones.map((m, i) => (
                    <li key={m} className="flex items-baseline gap-2 text-sm">
                      <span className={i + 1 === weekIndex ? "text-gold" : "text-muted"}>
                        W{i + 1}
                      </span>
                      <span className={i + 1 === weekIndex ? "text-ivory" : "text-muted"}>{m}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        );
      })}

      {/* Book plan */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <BookOpen className="size-4 text-gold" />
          <CardTitle>30-day book plan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {BOOK_PLAN.map((b) => (
            <CheckItem
              key={b.week}
              label={`${b.title} — ${b.author}`}
              sublabel={b.optional ? "Optional" : `Week ${b.week}`}
              checked={checkedBooks.includes(b.week)}
              onCheckedChange={(v) => toggleBook(b.week, v)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Completion sheet */}
      <Sheet open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <SheetContent title={completing ? `Log — ${completing.name}` : "Log skill time"}>
          {completing && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ivory">{getDailySkillTask(completing, dayNumber)}</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sk-min">Minutes</Label>
                <div className="flex gap-2">
                  {["10", "15", "20"].map((m) => (
                    <Button
                      key={m}
                      variant={minutes === m ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setMinutes(m)}
                    >
                      {m} min
                    </Button>
                  ))}
                  <Input
                    id="sk-min"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    className="w-20"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sk-note">Note (optional)</Label>
                <Input
                  id="sk-note"
                  placeholder="What did you actually do?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <Button size="lg" onClick={complete}>
                Log it
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {/* Manage tracks */}
      <Sheet open={manageOpen} onOpenChange={setManageOpen}>
        <SheetContent title="Your skill tracks">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Run 2–4 at a time — depth beats breadth. Progress on paused tracks is kept.
            </p>
            <div className="rounded-(--radius-card) border border-line bg-surface p-1">
              {SKILL_TRACKS.map((t) => (
                <CheckItem
                  key={t.id}
                  variant="toggle"
                  label={t.name}
                  sublabel={t.description}
                  checked={activeIds.includes(t.id)}
                  onCheckedChange={(v) => void toggleTrack(t.id, v)}
                />
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
