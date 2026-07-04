"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarHeart,
  Flame,
  Lightbulb,
  MessageCircleHeart,
  NotebookPen,
  Plus,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { weeklyStreak } from "@/lib/engine/streaks";
import { isolationSignal, weeklyChallenge } from "@/lib/engine/socialRules";
import { ACTIVITY_IDEAS, LOW_PRESSURE_SUGGESTIONS } from "@/lib/data/social";
import { addDays, toISODate, uid } from "@/lib/utils";
import type {
  DailyLog,
  OutreachChannel,
  OutreachEntry,
  ReconnectPerson,
  SocialReflection,
  SocialSettings,
} from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScaleSlider } from "@/components/ui/slider";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function SocialPage() {
  const { adapter, profile, revision, touch } = useStorage();
  const today = toISODate();
  const [outreach, setOutreach] = useState<OutreachEntry[]>([]);
  const [reconnect, setReconnect] = useState<ReconnectPerson[]>([]);
  const [reflections, setReflections] = useState<SocialReflection[]>([]);
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);

  const [logOpen, setLogOpen] = useState(false);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [person, setPerson] = useState("");
  const [channel, setChannel] = useState<OutreachChannel>("text");
  const [note, setNote] = useState("");
  const [newName, setNewName] = useState("");
  const [reflection, setReflection] = useState({ event: "", feltGood: 0, drained: false, remember: "" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adapter.listOutreach(addDays(today, -55), today),
      adapter.listReconnect(),
      adapter.listSocialReflections(),
      adapter.getSocialSettings(),
      adapter.listDailyLogs(addDays(today, -6), today),
    ]).then(([o, r, refl, s, l]) => {
      if (cancelled) return;
      setOutreach(o);
      setReconnect(r);
      setReflections(refl);
      setSettings(s);
      setLogs(l);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, today, revision]);

  const target = settings?.weeklyOutreachTarget ?? 3;
  const weekly = useMemo(
    () => weeklyStreak(outreach.map((o) => o.date), today, target),
    [outreach, today, target]
  );
  const moods = logs.filter((l) => l.mood > 0).map((l) => l.mood);
  const moodAvg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const isolation = useMemo(
    () => isolationSignal({ outreach, today, recentMoodAvg: moodAvg }),
    [outreach, today, moodAvg]
  );
  const challenge = weeklyChallenge(today);
  const suggestion = LOW_PRESSURE_SUGGESTIONS[outreach.length % LOW_PRESSURE_SUGGESTIONS.length];

  if (!profile || !settings) return null;

  const logOutreach = async (personName: string, ch: OutreachChannel, n: string) => {
    await adapter.saveOutreach({
      id: uid(),
      date: today,
      person: personName.trim(),
      channel: ch,
      note: n.trim(),
      createdAt: new Date().toISOString(),
    });
    // Keep the reconnect list's lastContact in sync when names match.
    const match = reconnect.find((p) => p.name.toLowerCase() === personName.trim().toLowerCase());
    if (match) {
      await adapter.saveReconnect(
        reconnect.map((p) => (p.id === match.id ? { ...p, lastContact: today } : p))
      );
    }
    touch();
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Social"
        subtitle="Friendships run on maintenance, not magic."
        action={
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <Send className="size-4" /> Log reach-out
          </Button>
        }
      />

      {/* Weekly outreach streak */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="size-4 text-gold" /> This week
          </CardTitle>
          <span className="text-xs text-muted">
            goal: {target}/week ·{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={async () => {
                const next = target >= 7 ? 1 : target + 1;
                const updated = { ...settings, weeklyOutreachTarget: next };
                setSettings(updated);
                await adapter.saveSocialSettings(updated);
              }}
            >
              change
            </button>
          </span>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <p className="display-num text-3xl text-ivory">
            {weekly.thisWeekCount}
            <span className="text-base text-muted"> / {target}</span>
          </p>
          <div className="min-w-0">
            <p className="text-sm text-ivory">
              {weekly.metThisWeek
                ? "Week counted. Anything more is gravy."
                : `${target - weekly.thisWeekCount} more reach-out${target - weekly.thisWeekCount === 1 ? "" : "s"} counts the week.`}
            </p>
            <p className="text-xs text-muted">
              {weekly.current > 0
                ? `${weekly.current}-week streak — the ${target}-a-week rule means travel and busy stretches don't wipe it.`
                : "A week counts when it hits the goal — consistency, not perfection."}
            </p>
          </div>
        </CardContent>
      </Card>

      {isolation.flagged && isolation.line && (
        <Card className="border-gold/30 bg-gold/5 p-4">
          <p className="text-sm leading-relaxed text-ivory">{isolation.line}</p>
        </Card>
      )}

      {/* Weekly challenge + low-pressure suggestion */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="flex items-start gap-3 p-4">
          <Trophy className="mt-0.5 size-5 shrink-0 text-gold" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
              This week&apos;s challenge
            </p>
            <p className="mt-0.5 text-sm text-ivory">{challenge}</p>
          </div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-gold" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
              Low-pressure move
            </p>
            <p className="mt-0.5 text-sm text-ivory">{suggestion}</p>
          </div>
        </Card>
      </div>

      {/* Friendship goal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircleHeart className="size-4 text-gold" /> Friendship goal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="e.g. one real conversation a week, rebuild the group chat crew"
            value={settings.friendshipGoal}
            onChange={(e) => setSettings({ ...settings, friendshipGoal: e.target.value })}
            onBlur={() => void adapter.saveSocialSettings(settings)}
            aria-label="Friendship goal"
          />
        </CardContent>
      </Card>

      {/* Reconnect list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-gold" /> Reconnect list
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {reconnect.length === 0 && (
            <p className="text-sm text-muted">
              People worth staying close to. Add a name; one tap logs the reach-out.
            </p>
          )}
          {reconnect.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-(--radius-control) bg-elevated px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ivory">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.lastContact ? `last contact ${p.lastContact}` : "no contact logged yet"}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void logOutreach(p.name, "text", "from reconnect list")}
              >
                Reached out
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="Add a name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="Add person to reconnect list"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!newName.trim()}
              aria-label="Add to reconnect list"
              onClick={async () => {
                const next = [...reconnect, { id: uid(), name: newName.trim(), note: "", lastContact: null }];
                setReconnect(next);
                setNewName("");
                await adapter.saveReconnect(next);
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity ideas + reflection */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarHeart className="size-4 text-gold" /> After you see people
          </CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setReflectOpen(true)}>
            <NotebookPen className="size-4 text-gold" /> Reflect
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {reflections.slice(0, 3).map((r) => (
            <div key={r.id} className="rounded-(--radius-control) bg-elevated px-3 py-2">
              <p className="text-sm text-ivory">
                {r.event} — felt {r.feltGood}/10{r.drained ? " · needed recovery after" : ""}
              </p>
              {r.remember && <p className="text-xs text-muted">remember: {r.remember}</p>}
            </div>
          ))}
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted">
              Activity ideas
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {ACTIVITY_IDEAS.map((a) => (
                <li key={a} className="text-sm text-ivory">
                  · {a}
                </li>
              ))}
            </ul>
          </details>
        </CardContent>
      </Card>

      {/* Log outreach sheet */}
      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetContent title="Log a reach-out">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="so-person">Who</Label>
              <Input id="so-person" placeholder="Name" value={person} onChange={(e) => setPerson(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="so-channel">How</Label>
              <Select id="so-channel" value={channel} onChange={(e) => setChannel(e.target.value as OutreachChannel)}>
                <option value="text">Text / message</option>
                <option value="call">Call / voice memo</option>
                <option value="inPerson">In person</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="so-note">Note (optional)</Label>
              <Input id="so-note" placeholder="what it was about" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button
              size="lg"
              disabled={!person.trim()}
              onClick={async () => {
                await logOutreach(person, channel, note);
                setPerson("");
                setNote("");
                setLogOpen(false);
              }}
            >
              Log it
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Post-event reflection sheet */}
      <Sheet open={reflectOpen} onOpenChange={setReflectOpen}>
        <SheetContent title="Post-event reflection">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sr-event">What was it?</Label>
              <Input
                id="sr-event"
                placeholder="dinner with…, call with…"
                value={reflection.event}
                onChange={(e) => setReflection({ ...reflection, event: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>How did it feel overall?</Label>
              <ScaleSlider
                label="How it felt"
                value={reflection.feltGood}
                onChange={(v: number) => setReflection({ ...reflection, feltGood: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-2">
              <span className="text-sm text-ivory">Needed recovery after (that&apos;s fine)</span>
              <Switch
                checked={reflection.drained}
                onCheckedChange={(v) => setReflection({ ...reflection, drained: v })}
                aria-label="Needed recovery after"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sr-remember">One thing to remember about them</Label>
              <Input
                id="sr-remember"
                placeholder="job interview Tuesday, kid's name is Maya…"
                value={reflection.remember}
                onChange={(e) => setReflection({ ...reflection, remember: e.target.value })}
              />
            </div>
            <Button
              size="lg"
              disabled={!reflection.event.trim()}
              onClick={async () => {
                await adapter.saveSocialReflection({
                  id: uid(),
                  date: today,
                  ...reflection,
                  createdAt: new Date().toISOString(),
                });
                touch();
                setReflection({ event: "", feltGood: 0, drained: false, remember: "" });
                setReflectOpen(false);
              }}
            >
              Save reflection
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
