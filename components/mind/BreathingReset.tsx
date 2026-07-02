"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * 60-second animated breathing reset: one 8s scale cycle ≈ 4s in / 4s out.
 * Calls onComplete once when the full minute finishes.
 */
export function BreathingReset({ onComplete }: { onComplete: () => void }) {
  const DURATION = 60;
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(DURATION);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const end = Date.now() + remaining * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        setRunning(false);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="relative flex size-48 items-center justify-center">
        <div
          className={`absolute inset-0 rounded-full bg-gold/15 ${running ? "animate-breathe" : "scale-75"} transition-transform`}
        />
        <div
          className={`absolute inset-6 rounded-full bg-gold/25 ${running ? "animate-breathe" : "scale-75"} transition-transform`}
        />
        <span className="display-num relative text-4xl text-ivory">
          {running ? remaining : completedRef.current ? "✓" : "60"}
        </span>
      </div>
      <p className="text-center text-sm text-muted">
        {running
          ? "Breathe in as the circle grows. Out as it falls. Nothing else."
          : completedRef.current
            ? "Reset complete. Logged."
            : "One minute. In for 4, out for 4."}
      </p>
      {!running && !completedRef.current && (
        <Button
          size="lg"
          onClick={() => {
            setRemaining(DURATION);
            setRunning(true);
          }}
        >
          Start 60-second reset
        </Button>
      )}
    </div>
  );
}
