"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary (v3.3 §1.10). The app shell (nav) survives —
 * this renders only in place of the failed page. Calm, adherence-neutral:
 * an error is a state, never a verdict.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Digest is Next's server-side reference for this error instance.
    console.error("Route error", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="microlabel text-muted">Something interrupted this screen</p>
      <p className="max-w-xs text-sm leading-relaxed text-ivory">
        Your data is safe on this device — this screen just hit an error while drawing.
      </p>
      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload the app
        </Button>
      </div>
    </div>
  );
}
