"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Count-up animation for HUD readouts (extracted from ScoreRing in the HUD
 * overhaul). Eased cubic, motion-safe: reduced motion renders the target
 * instantly. `duration` defaults to the stat-card spec (300ms); the score
 * ring passes 400ms.
 */
export function useCountUp(target: number, enabled = true, duration = 300): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled || prefersReducedMotion() || target === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, duration]);
  return value;
}
