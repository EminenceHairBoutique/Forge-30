"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { toISODate, uid } from "@/lib/utils";
import type { JournalNote } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const TAG_SUGGESTIONS = ["vent", "win", "gratitude", "trigger", "idea"];

/**
 * Journal composer (E6) — free-write, or the CBT thought record (situation →
 * automatic thought → emotion → evidence for/against → reframe). Both carry
 * tags and the per-entry private flag, which always beats every consent.
 */
export function NoteComposerSheet({
  open,
  onOpenChange,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "freewrite" | "thoughtRecord";
  onSaved: () => void;
}) {
  const { adapter, touch } = useStorage();
  const [text, setText] = useState("");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [customTag, setCustomTag] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [tr, setTr] = useState({
    situation: "",
    automaticThought: "",
    emotion: "",
    emotionIntensity: 5,
    evidenceFor: "",
    evidenceAgainst: "",
    reframe: "",
  });

  const reset = () => {
    setText("");
    setTags(new Set());
    setCustomTag("");
    setIsPrivate(false);
    setTr({ situation: "", automaticThought: "", emotion: "", emotionIntensity: 5, evidenceFor: "", evidenceAgainst: "", reframe: "" });
  };

  const canSave =
    mode === "freewrite"
      ? text.trim().length > 0
      : tr.situation.trim().length > 0 || tr.automaticThought.trim().length > 0;

  const save = async () => {
    const allTags = [...tags];
    if (customTag.trim()) allTags.push(customTag.trim().toLowerCase());
    const note: JournalNote = {
      id: uid(),
      date: toISODate(),
      kind: mode,
      text: text.trim(),
      tags: allTags,
      private: isPrivate,
      ...(mode === "thoughtRecord" ? tr : {}),
      createdAt: new Date().toISOString(),
    };
    await adapter.saveJournalNote(note);
    touch();
    reset();
    onSaved();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={mode === "freewrite" ? "Journal entry" : "Thought record"}>
        <div className="flex flex-col gap-4">
          {mode === "freewrite" ? (
            <Textarea
              placeholder="Whatever's there. No structure required."
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Journal entry"
            />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tr-situation">What happened?</Label>
                <Input
                  id="tr-situation"
                  placeholder="The situation, just the facts"
                  value={tr.situation}
                  onChange={(e) => setTr({ ...tr, situation: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tr-thought">The automatic thought</Label>
                <Input
                  id="tr-thought"
                  placeholder="What went through your head, verbatim"
                  value={tr.automaticThought}
                  onChange={(e) => setTr({ ...tr, automaticThought: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tr-emotion">Feeling</Label>
                  <Input
                    id="tr-emotion"
                    placeholder="angry, anxious, flat…"
                    value={tr.emotion}
                    onChange={(e) => setTr({ ...tr, emotion: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tr-intensity">Intensity (0–10)</Label>
                  <Input
                    id="tr-intensity"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="10"
                    value={tr.emotionIntensity}
                    onChange={(e) =>
                      setTr({
                        ...tr,
                        emotionIntensity: Math.min(10, Math.max(0, Math.round(Number(e.target.value) || 0))),
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tr-for">Evidence the thought is true</Label>
                <Input
                  id="tr-for"
                  placeholder="Facts only"
                  value={tr.evidenceFor}
                  onChange={(e) => setTr({ ...tr, evidenceFor: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tr-against">Evidence it isn't the whole story</Label>
                <Input
                  id="tr-against"
                  placeholder="What the thought leaves out"
                  value={tr.evidenceAgainst}
                  onChange={(e) => setTr({ ...tr, evidenceAgainst: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tr-reframe">A fairer way to say it</Label>
                <Textarea
                  id="tr-reframe"
                  placeholder="Same facts, less verdict"
                  rows={2}
                  value={tr.reframe}
                  onChange={(e) => setTr({ ...tr, reframe: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {TAG_SUGGESTIONS.map((t) => {
                const on = tags.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = new Set(tags);
                      if (on) next.delete(t);
                      else next.add(t);
                      setTags(next);
                    }}
                    className={`min-h-9 rounded-full border px-3 text-sm font-medium ${
                      on ? "border-gold/60 bg-gold/10 text-ivory" : "border-line bg-surface text-muted"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
              <Input
                placeholder="+ your own"
                className="h-9 w-28"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                aria-label="Custom tag"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-ivory">
              <Lock className="size-4 text-gold" /> Private — never leaves the journal
            </span>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} aria-label="Private entry" />
          </div>
          <p className="-mt-2 text-xs text-muted">
            Private entries are excluded from the coach and every analysis, even when journal
            sharing is on.
          </p>

          <Button size="lg" disabled={!canSave} onClick={save}>
            Save entry
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
