"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Mic, Square, Trash2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { flagEnabled } from "@/lib/flags";
import { toISODate, uid, vibrate } from "@/lib/utils";
import type { JournalNote } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const MAX_SECONDS = 180;

function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Voice journal (E6) — records up to 3 minutes via MediaRecorder and stores
 * the audio as a data URL in the IndexedDB large store, so it rides
 * export/import like everything else and never leaves the device.
 * Transcription ships behind FLAG(transcription) once the AI-key decision
 * lands.
 */
export function VoiceNoteSheet({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { adapter, touch } = useStorage();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Leaving the sheet mid-recording stops the mic — never record in the background.
  useEffect(() => {
    if (!open && recorderRef.current?.state === "recording") stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => setDataUrl(String(reader.result));
        reader.readAsDataURL(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      vibrate(10);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone unavailable — check the browser permission.");
    }
  };

  const stop = () => {
    stopTimer();
    setRecording(false);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const discard = () => {
    setDataUrl(null);
    setSeconds(0);
    setCaption("");
  };

  const save = async () => {
    if (!dataUrl) return;
    const audioId = uid();
    await adapter.saveJournalAudio(audioId, dataUrl);
    const note: JournalNote = {
      id: uid(),
      date: toISODate(),
      kind: "voice",
      text: caption.trim(),
      tags: [],
      private: isPrivate,
      audioId,
      durationSec: seconds,
      createdAt: new Date().toISOString(),
    };
    await adapter.saveJournalNote(note);
    touch();
    discard();
    setIsPrivate(false);
    onSaved();
    onOpenChange(false);
  };

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Voice note">
        <div className="flex flex-col gap-4">
          {!recordingSupported() ? (
            <p className="text-sm text-muted">
              Voice recording isn’t available in this browser. The written journal is always
              here.
            </p>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 py-2">
                <p className="display-num text-3xl text-ivory" aria-live="polite">
                  {mmss}
                </p>
                {recording && (
                  <p
                    role="status"
                    className="microlabel flex items-center gap-1.5 rounded-full border border-danger/50 bg-danger/10 px-3 py-1 text-danger"
                  >
                    <span className="size-2 rounded-full bg-danger" aria-hidden /> REC · recording in progress
                  </p>
                )}
                {recording ? (
                  <Button size="lg" variant="secondary" onClick={stop}>
                    <Square className="size-5 text-danger" /> Stop
                  </Button>
                ) : dataUrl ? (
                   
                  <audio controls src={dataUrl} className="w-full" />
                ) : (
                  <Button size="lg" onClick={start}>
                    <Mic className="size-5" /> Record (max 3 min)
                  </Button>
                )}
                {error && <p className="text-sm text-muted">{error}</p>}
              </div>

              {dataUrl && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="vn-caption">Caption (optional)</Label>
                    <Input
                      id="vn-caption"
                      placeholder="What's this one about?"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-2">
                    <span className="flex items-center gap-2 text-sm text-ivory">
                      <Lock className="size-4 text-gold" /> Private — never leaves the journal
                    </span>
                    <Switch
                      checked={isPrivate}
                      onCheckedChange={setIsPrivate}
                      aria-label="Private entry"
                    />
                  </div>
                  {!flagEnabled("transcription") && (
                    <p className="text-xs text-muted">
                      Audio stays on this device. Transcription arrives in a later update.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button size="lg" className="flex-1" onClick={save}>
                      Save voice note
                    </Button>
                    <Button size="lg" variant="ghost" onClick={discard} aria-label="Discard recording">
                      <Trash2 className="size-5" />
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
