"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * "Pause before reacting" timer: a short forced gap before replying to a
 * message or walking into a charged conversation.
 */
export function PauseTimer() {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const end = Date.now() + remaining * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        setRunning(false);
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const start = (secs: number) => {
    setRemaining(secs);
    setRunning(true);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {running ? (
        <>
          <span className="display-num text-6xl text-gold">{remaining}</span>
          <p className="text-center text-sm text-muted">
            Don&apos;t type. Don&apos;t speak. Let the first reaction pass.
          </p>
        </>
      ) : (
        <>
          <p className="text-center text-sm text-muted">
            About to react? Buy yourself a gap first. The message can wait this long.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => start(10)}>
              10s
            </Button>
            <Button variant="secondary" onClick={() => start(30)}>
              30s
            </Button>
            <Button onClick={() => start(60)}>60s</Button>
          </div>
        </>
      )}
    </div>
  );
}
