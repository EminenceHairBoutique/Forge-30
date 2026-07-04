"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, ShieldCheck, Square, Trash2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import {
  NOT_LEGAL_ADVICE,
  SPOKEN_NOTICE,
  getRecordingRequirement,
} from "@/lib/engine/recordingLaw";
import { RECORDING_JURISDICTIONS } from "@/lib/data/recordingLaw";
import { toISODate, uid, vibrate } from "@/lib/utils";
import type { Recording } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CheckItem } from "@/components/ui/checkbox";

const MAX_SECONDS = 1800; // 30 minutes

/**
 * Consensual recording flow (Phase NEXT C — FLAG(consensualRecording),
 * development-only until counsel review). Consent-first by construction:
 * jurisdiction → regime display (never legal advice) → on-screen
 * acknowledgment + the spoken notice to read aloud → capture with a
 * persistent, unmistakable REC indicator. No silent capture states exist.
 */
export function RecordingSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { adapter, profile, saveProfile, touch } = useStorage();
  const [jurisdiction, setJurisdiction] = useState<string>("");
  const [traveling, setTraveling] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setJurisdiction(profile?.recordingJurisdiction ?? "");
      setTraveling(false);
      setAcknowledged(false);
      setDataUrl(null);
      setSeconds(0);
      setLabel("");
      setError(null);
    }
  }, [open, profile]);

  // Closing the sheet mid-recording stops the mic — never record unseen.
  useEffect(() => {
    if (!open && recorderRef.current?.state === "recording") stopCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!profile) return null;

  const req = getRecordingRequirement(jurisdiction || undefined, { traveling });
  const canRecord = jurisdiction !== "" && acknowledged;

  const pickJurisdiction = async (code: string) => {
    setJurisdiction(code);
    setAcknowledged(false);
    await saveProfile({ ...profile, recordingJurisdiction: code });
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startCapture = async () => {
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
          if (s + 1 >= MAX_SECONDS) stopCapture();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone unavailable — check the browser permission.");
    }
  };

  const stopCapture = () => {
    stopTimer();
    setRecording(false);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const save = async () => {
    if (!dataUrl) return;
    const rec: Recording = {
      id: uid(),
      date: toISODate(),
      durationSec: seconds,
      jurisdiction,
      effectiveRegime: req.effectiveRegime,
      consentAcknowledged: true,
      spokenNoticeShown: true,
      label: label.trim() || "Conversation",
      audio: dataUrl,
      createdAt: new Date().toISOString(),
    };
    await adapter.saveRecording(rec);
    touch();
    onOpenChange(false);
  };

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Record a conversation — with consent">
        <div className="flex flex-col gap-4">
          {/* Persistent REC indicator: the first thing in the sheet, impossible
              to miss, present the entire time capture is live. */}
          {recording && (
            <p
              role="status"
              className="microlabel flex items-center justify-center gap-1.5 rounded-full border border-danger/60 bg-danger/10 px-3 py-2 text-danger"
            >
              <span className="size-2 rounded-full bg-danger" aria-hidden /> REC · RECORDING IN
              PROGRESS · {mmss}
            </p>
          )}

          {/* Step 1: jurisdiction */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rec-jur">Where are you? (sets the consent flow)</Label>
            <Select
              id="rec-jur"
              value={jurisdiction}
              onChange={(e) => void pickJurisdiction(e.target.value)}
              disabled={recording}
            >
              <option value="">Choose a location…</option>
              {RECORDING_JURISDICTIONS.map((j) => (
                <option key={j.code} value={j.code}>
                  {j.name}
                </option>
              ))}
            </Select>
            <CheckItem
              variant="toggle"
              label="I'm traveling, or this call crosses state or national lines"
              checked={traveling}
              onCheckedChange={(v) => {
                setTraveling(v);
                setAcknowledged(false);
              }}
            />
            <p className="text-xs leading-relaxed text-muted">
              Physical location and applicable law don&apos;t always coincide — calls across
              state lines can involve stricter rules, which is why unset or unclear locations
              use the most protective flow. {NOT_LEGAL_ADVICE}
            </p>
          </div>

          {/* Step 2: regime + consent capture */}
          {jurisdiction !== "" && (
            <>
              <div className="rounded-(--radius-control) border border-gold/30 bg-gold/5 px-3 py-2.5">
                <p className="microlabel flex items-center gap-1.5 text-gold">
                  <ShieldCheck className="size-3.5" />
                  {req.effectiveRegime === "all-party"
                    ? "Everyone's consent required"
                    : "One-party jurisdiction — consent still recommended"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ivory">{req.note}</p>
              </div>

              <div className="rounded-(--radius-control) bg-elevated px-3 py-2.5">
                <p className="microlabel text-muted">Say this out loud at the start</p>
                <p className="mt-1 text-base font-semibold leading-relaxed text-ivory">
                  &ldquo;{SPOKEN_NOTICE}&rdquo;
                </p>
                <p className="mt-1 text-xs text-muted">
                  Saying it on tape puts the consent on the recording itself.
                </p>
              </div>

              <CheckItem
                label="Everyone being recorded knows and has agreed"
                sublabel="Required before the record button appears — no silent capture, ever."
                checked={acknowledged}
                onCheckedChange={setAcknowledged}
              />
            </>
          )}

          {/* Step 3: capture — exists only after consent */}
          {canRecord && (
            <div className="flex flex-col items-center gap-3 py-1">
              {!recording && !dataUrl && (
                <Button size="lg" onClick={startCapture} className="w-full">
                  <Mic className="size-5" /> Start recording (says REC the whole time)
                </Button>
              )}
              {recording && (
                <Button size="lg" variant="secondary" onClick={stopCapture} className="w-full">
                  <Square className="size-5 text-danger" /> Stop
                </Button>
              )}
              {error && <p className="text-sm text-muted">{error}</p>}
              {dataUrl && (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={dataUrl} className="w-full" />
                  <div className="flex w-full flex-col gap-1.5">
                    <Label htmlFor="rec-label">Label</Label>
                    <Input
                      id="rec-label"
                      placeholder="e.g. Conversation about the move"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Audio stays on this device. When you have a transcript, paste it into the
                    thread analysis above for the same calm debrief as any conversation.
                  </p>
                  <div className="flex w-full gap-2">
                    <Button size="lg" className="flex-1" onClick={save}>
                      Save recording
                    </Button>
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={() => {
                        setDataUrl(null);
                        setSeconds(0);
                      }}
                      aria-label="Discard recording"
                    >
                      <Trash2 className="size-5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
