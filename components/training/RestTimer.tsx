"use client";

import { useEffect, useRef, useState } from "react";
import { TimerReset, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Rest timer that pops up above the bottom nav after a set is completed.
 * Uses an end-timestamp so backgrounding the PWA doesn't drift the countdown.
 */
export function RestTimer({
  startedAt,
  seconds = 90,
  onDismiss,
}: {
  /** Change this value (Date.now()) to (re)start the timer. */
  startedAt: number | null;
  seconds?: number;
  onDismiss: () => void;
}) {
  const [remaining, setRemaining] = useState(0);
  const endRef = useRef(0);

  useEffect(() => {
    if (!startedAt) return;
    endRef.current = startedAt + seconds * 1000;
    setRemaining(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)));
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [startedAt, seconds]);

  if (!startedAt || remaining <= 0) return null;

  const bump = (delta: number) => {
    endRef.current += delta * 1000;
    setRemaining(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)));
  };

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-full max-w-lg px-4 pb-safe">
      <div className="flex items-center justify-between gap-3 rounded-(--radius-card) border border-gold/40 bg-elevated/95 px-4 py-2 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2">
          <TimerReset className="size-5 text-gold" />
          <span className="display-num text-2xl text-ivory">
            {mm}:{ss}
          </span>
          <span className="text-xs text-muted">rest</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => bump(-30)}>
            −30
          </Button>
          <Button variant="secondary" size="sm" onClick={() => bump(30)}>
            +30
          </Button>
          <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss rest timer">
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
