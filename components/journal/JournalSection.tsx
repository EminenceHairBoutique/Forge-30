"use client";

import { useEffect, useMemo, useState } from "react";
import { BookLock, Lock, Mic, NotebookPen, Play, Search, Sparkle, Trash2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { summarizeJournal } from "@/lib/engine/journalRules";
import { addDays, toISODate } from "@/lib/utils";
import type { JournalConsent, JournalNote } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckItem } from "@/components/ui/checkbox";
import { NoteComposerSheet } from "./NoteComposerSheet";
import { VoiceNoteSheet } from "./VoiceNoteSheet";

const KIND_LABEL = { freewrite: "Entry", thoughtRecord: "Thought record", voice: "Voice" } as const;

/** Text shown in the list for any note kind. */
function preview(note: JournalNote): string {
  if (note.kind === "thoughtRecord") {
    return note.reframe || note.automaticThought || note.situation || "Thought record";
  }
  if (note.kind === "voice") {
    return note.text || `Voice note · ${Math.round((note.durationSec ?? 0) / 60) || "<1"} min`;
  }
  return note.text;
}

/**
 * The journal (E6): free-write, CBT thought records, and voice notes, with
 * search/filter, the deterministic weekly reflection, and the privacy card
 * (per-consumer consent, default off; per-entry private always wins;
 * delete-everything). Entries live in IndexedDB and count toward the MVD.
 */
export function JournalSection() {
  const { adapter, revision, touch } = useStorage();
  const today = toISODate();
  const [notes, setNotes] = useState<JournalNote[]>([]);
  const [consent, setConsent] = useState<JournalConsent | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [composer, setComposer] = useState<"freewrite" | "thoughtRecord" | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [playing, setPlaying] = useState<{ id: string; src: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adapter.listJournalNotes(addDays(today, -29), today),
      adapter.getJournalConsent(),
    ]).then(([n, c]) => {
      if (cancelled) return;
      setNotes(n.reverse()); // newest first
      setConsent(c);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, today, revision]);

  const weekSummary = useMemo(
    () => summarizeJournal(notes.filter((n) => n.date >= addDays(today, -6))),
    [notes, today]
  );

  const allTags = useMemo(() => {
    const t = new Set<string>();
    for (const n of notes) for (const tag of n.tags) t.add(tag.toLowerCase());
    return [...t].sort();
  }, [notes]);

  const visible = notes.filter((n) => {
    if (tagFilter && !n.tags.some((t) => t.toLowerCase() === tagFilter)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [preview(n), n.text, n.situation, n.automaticThought, n.reframe, ...n.tags]
      .filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(q));
  });

  const remove = async (id: string) => {
    await adapter.deleteJournalNote(id);
    touch();
  };

  const play = async (note: JournalNote) => {
    if (!note.audioId) return;
    if (playing?.id === note.id) {
      setPlaying(null);
      return;
    }
    const src = await adapter.getJournalAudio(note.audioId);
    if (src) setPlaying({ id: note.id, src });
  };

  const setConsentKey = async (key: keyof JournalConsent, value: boolean) => {
    if (!consent) return;
    const next = { ...consent, [key]: value };
    setConsent(next);
    await adapter.saveJournalConsent(next);
  };

  const wipe = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      return;
    }
    await adapter.deleteAllJournalData();
    setConfirmWipe(false);
    touch();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Journal</CardTitle>
          <span className="text-xs text-muted">counts toward your Minimum Viable Day</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" className="h-auto flex-col gap-1 py-3" onClick={() => setComposer("freewrite")}>
              <NotebookPen className="size-5 text-gold" />
              <span className="text-xs">Write</span>
            </Button>
            <Button variant="secondary" className="h-auto flex-col gap-1 py-3" onClick={() => setComposer("thoughtRecord")}>
              <Sparkle className="size-5 text-gold" />
              <span className="text-xs">Thought record</span>
            </Button>
            <Button variant="secondary" className="h-auto flex-col gap-1 py-3" onClick={() => setVoiceOpen(true)}>
              <Mic className="size-5 text-gold" />
              <span className="text-xs">Voice</span>
            </Button>
          </div>

          {/* Weekly reflection — deterministic counts, observations only. */}
          {weekSummary.entryCount > 0 && (
            <div className="rounded-(--radius-control) border border-gold/25 bg-gold/5 px-3 py-2.5">
              <p className="microlabel text-gold">
                This week
              </p>
              {weekSummary.lines.map((line) => (
                <p key={line} className="mt-1 text-sm text-ivory">
                  {line}
                </p>
              ))}
            </div>
          )}

          {notes.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                <Input
                  placeholder="Search entries"
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search journal"
                />
              </div>
              {allTags.length > 0 && (
                <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
                  {allTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tagFilter === t}
                      onClick={() => setTagFilter(tagFilter === t ? null : t)}
                      className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium ${
                        tagFilter === t
                          ? "border-gold/60 bg-gold/10 text-ivory"
                          : "border-line bg-surface text-muted"
                      }`}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {visible.length === 0 && (
              <p className="py-1 text-sm text-muted">
                {notes.length === 0
                  ? "Nothing here yet. The page doesn't judge."
                  : "No entries match that search."}
              </p>
            )}
            {visible.slice(0, 20).map((n) => (
              <div key={n.id} className="rounded-(--radius-control) bg-elevated px-3 py-2">
                <div className="flex items-center gap-2 microlabel text-muted">
                  <span>{n.date}</span>
                  <span className="text-gold">{KIND_LABEL[n.kind]}</span>
                  {n.private && <Lock className="size-3 text-gold" aria-label="Private entry" />}
                  <span className="flex-1" />
                  {n.kind === "voice" && (
                    <button
                      type="button"
                      aria-label={playing?.id === n.id ? "Hide player" : "Play voice note"}
                      onClick={() => void play(n)}
                      className="flex size-9 items-center justify-center rounded-full text-muted active:text-gold"
                    >
                      <Play className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Delete entry"
                    onClick={() => void remove(n.id)}
                    className="flex size-9 items-center justify-center rounded-full text-muted active:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ivory">{preview(n)}</p>
                {n.tags.length > 0 && (
                  <p className="mt-1 text-xs text-muted">{n.tags.map((t) => `#${t}`).join(" ")}</p>
                )}
                {playing?.id === n.id && (
                   
                  <audio controls autoPlay src={playing.src} className="mt-2 w-full" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Privacy — consent per consumer, default off; private flag always wins. */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <BookLock className="size-4 text-gold" />
          <CardTitle>Journal privacy</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Your journal is private by default — nothing reads it unless you allow it here, and
            entries marked private stay out no matter what. Anything journal-informed is labeled.
          </p>
          {consent && (
            <div className="rounded-(--radius-card) border border-line bg-surface p-1">
              <CheckItem
                variant="toggle"
                label="AI Coach may see themes"
                sublabel="recurring topics only — never your words"
                checked={consent.coach}
                onCheckedChange={(v) => void setConsentKey("coach", v)}
              />
              <CheckItem
                variant="toggle"
                label="Assessments may use entries"
                sublabel="for the self-insight reports (later update)"
                checked={consent.assessments}
                onCheckedChange={(v) => void setConsentKey("assessments", v)}
              />
              <CheckItem
                variant="toggle"
                label="LifeGraph may use entries"
                sublabel="for cross-domain patterns (later update)"
                checked={consent.lifeGraph}
                onCheckedChange={(v) => void setConsentKey("lifeGraph", v)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Your data</Label>
            <p className="text-xs text-muted">
              Journal entries and audio ride the full backup in Settings → Data. Deleting here
              removes every entry and every recording from this device.
            </p>
            <Button variant="destructive" size="sm" className="self-start" onClick={wipe}>
              <Trash2 className="size-4" />
              {confirmWipe ? "Tap again to delete all journal data" : "Delete all journal data"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {composer && (
        <NoteComposerSheet
          open={!!composer}
          onOpenChange={(o) => !o && setComposer(null)}
          mode={composer}
          onSaved={() => setComposer(null)}
        />
      )}
      <VoiceNoteSheet open={voiceOpen} onOpenChange={setVoiceOpen} onSaved={() => setVoiceOpen(false)} />
    </>
  );
}
