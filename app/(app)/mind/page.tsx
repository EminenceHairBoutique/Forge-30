"use client";

import { useEffect, useState } from "react";
import { Wind, TimerOff, MessageCircleHeart, MoonStar, CheckCircle2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { DISCLAIMERS } from "@/lib/engine/safetyCopy";
import { toISODate, uid } from "@/lib/utils";
import type { JournalEntry } from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { JournalSection } from "@/components/journal/JournalSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScaleSlider } from "@/components/ui/scale-slider";
import { CheckItem } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BreathingReset } from "@/components/mind/BreathingReset";
import { PauseTimer } from "@/components/mind/PauseTimer";
import { BoundaryScript } from "@/components/mind/BoundaryScript";

const WIND_DOWN = [
  { id: "screens", label: "Screens off / night mode" },
  { id: "tomorrow", label: "Tomorrow's #1 task written down" },
  { id: "room", label: "Room dark and cool" },
  { id: "phone", label: "Phone out of arm's reach" },
] as const;

function emptyJournal(date: string): JournalEntry {
  return {
    id: uid(),
    date,
    mood: 0,
    stress: 0,
    anxietyAnger: 0,
    relationshipStress: false,
    mainTrigger: "",
    whatIControlled: "",
    whatToLetGo: "",
    boundaryPracticed: "",
    resetDone: false,
    windDownDone: false,
    thoughtDump: "",
    nightReflection: "",
    loggedAt: new Date().toISOString(),
  };
}

export default function MindPage() {
  const { adapter, touch } = useStorage();
  const today = toISODate();
  const [draft, setDraft] = useState<JournalEntry | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [windDownChecked, setWindDownChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    adapter.getJournal(today).then((j) => {
      if (cancelled) return;
      const entry = j ?? emptyJournal(today);
      setDraft(entry);
      if (entry.windDownDone) setWindDownChecked(new Set(WIND_DOWN.map((w) => w.id)));
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, today]);

  if (!draft) return null;

  const set = (patch: Partial<JournalEntry>) => setDraft({ ...draft, ...patch });

  const persist = async (patch: Partial<JournalEntry> = {}) => {
    const entry = { ...draft, ...patch, loggedAt: new Date().toISOString() };
    setDraft(entry);
    await adapter.saveJournal(entry);
    touch();
    setSavedAt(new Date().toLocaleTimeString());
  };

  const checkInComplete = draft.mood > 0 && draft.stress > 0;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Mind"
        subtitle="Check in, reset, let go."
        action={
          checkInComplete ? (
            <Badge variant="success">
              <CheckCircle2 className="size-3" /> checked in
            </Badge>
          ) : undefined
        }
      />

      {/* Tools */}
      <div className="grid grid-cols-2 gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="h-auto w-full flex-col gap-1 py-3">
              <Wind className="size-5 text-gold" />
              <span className="text-xs">60-sec reset</span>
              {draft.resetDone && <Badge variant="success">done</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent title="Breathing reset">
            <BreathingReset onComplete={() => void persist({ resetDone: true })} />
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="h-auto w-full flex-col gap-1 py-3">
              <TimerOff className="size-5 text-gold" />
              <span className="text-xs">Pause before reacting</span>
            </Button>
          </SheetTrigger>
          <SheetContent title="Pause before reacting">
            <PauseTimer />
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="h-auto w-full flex-col gap-1 py-3">
              <MessageCircleHeart className="size-5 text-gold" />
              <span className="text-xs">Boundary script</span>
            </Button>
          </SheetTrigger>
          <SheetContent title="Boundary script generator">
            <BoundaryScript />
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="h-auto w-full flex-col gap-1 py-3">
              <MoonStar className="size-5 text-gold" />
              <span className="text-xs">Wind-down</span>
              {draft.windDownDone && <Badge variant="success">done</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent title="Sleep wind-down">
            <div className="flex flex-col gap-2">
              {WIND_DOWN.map((item) => (
                <CheckItem
                  key={item.id}
                  label={item.label}
                  checked={windDownChecked.has(item.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(windDownChecked);
                    if (v) next.add(item.id);
                    else next.delete(item.id);
                    setWindDownChecked(next);
                    if (WIND_DOWN.every((w) => next.has(w.id))) void persist({ windDownDone: true });
                    else if (draft.windDownDone) void persist({ windDownDone: false });
                  }}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Daily check-in */}
      <Card>
        <CardHeader>
          <CardTitle>Daily check-in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Mood</Label>
            <ScaleSlider label="Mood" value={draft.mood} onChange={(v) => set({ mood: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Stress</Label>
            <ScaleSlider label="Stress" value={draft.stress} onChange={(v) => set({ stress: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Anxiety / anger</Label>
            <ScaleSlider
              label="Anxiety or anger"
              value={draft.anxietyAnger}
              onChange={(v) => set({ anxietyAnger: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-1">
            <span className="text-sm text-ivory">Relationship stress today</span>
            <Switch
              checked={draft.relationshipStress}
              onCheckedChange={(v) => set({ relationshipStress: v })}
              aria-label="Relationship stress"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mj-trigger">Main trigger today</Label>
            <Input
              id="mj-trigger"
              placeholder="What set you off (or almost did)?"
              value={draft.mainTrigger}
              onChange={(e) => set({ mainTrigger: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mj-controlled">What I controlled</Label>
            <Input
              id="mj-controlled"
              placeholder="One thing you handled well"
              value={draft.whatIControlled}
              onChange={(e) => set({ whatIControlled: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mj-letgo">What I need to let go</Label>
            <Input
              id="mj-letgo"
              placeholder="Not yours to carry"
              value={draft.whatToLetGo}
              onChange={(e) => set({ whatToLetGo: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mj-boundary">Boundary practiced</Label>
            <Input
              id="mj-boundary"
              placeholder="Said no to…, asked for…"
              value={draft.boundaryPracticed}
              onChange={(e) => set({ boundaryPracticed: e.target.value })}
            />
          </div>
          <Button size="lg" onClick={() => void persist()} disabled={!checkInComplete}>
            {checkInComplete ? "Save check-in" : "Set mood + stress to save"}
          </Button>
          {savedAt && <p className="text-center text-xs text-muted">Saved {savedAt}</p>}
        </CardContent>
      </Card>

      {/* Thought dump */}
      <Card>
        <CardHeader>
          <CardTitle>Thought dump</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            placeholder="Empty the head. No structure, no judgment."
            rows={4}
            value={draft.thoughtDump}
            onChange={(e) => set({ thoughtDump: e.target.value })}
            onBlur={() => void persist()}
          />
        </CardContent>
      </Card>

      {/* Night reflection */}
      <Card>
        <CardHeader>
          <CardTitle>Night reflection</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            placeholder="What would make tomorrow 1% calmer?"
            rows={3}
            value={draft.nightReflection}
            onChange={(e) => set({ nightReflection: e.target.value })}
            onBlur={() => void persist()}
          />
        </CardContent>
      </Card>

      {/* Journal (E6): free-write, thought records, voice — with privacy controls. */}
      <JournalSection />

      <p className="px-2 pb-2 text-center text-xs leading-relaxed text-muted">{DISCLAIMERS.mentalHealth}</p>
    </div>
  );
}
