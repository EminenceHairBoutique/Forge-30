"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Starship boot splash (S2): a one-time "systems online" sequence on cold
 * open — the single strongest "this is an operating system" signal. Shows
 * once per browser session (sessionStorage), fades out to reveal the app,
 * and is skipped ENTIRELY under reduced motion. Purely decorative: it never
 * blocks interaction (pointer-events cleared as it fades) and holds no data.
 */

const LINES = [
  "INIT CORE SYSTEMS",
  "SYNC BIOMETRICS",
  "LOAD COACH ENGINE",
  "CALIBRATE FORGE SCORE",
  "OPERATOR READY",
];

export function BootSequence() {
  const [phase, setPhase] = useState<"hidden" | "playing" | "done">("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) return;
    try {
      if (sessionStorage.getItem("forge30:booted") === "1") return;
      sessionStorage.setItem("forge30:booted", "1");
    } catch {
      return; // no sessionStorage → skip the splash rather than risk a loop
    }
    setPhase("playing");
    const fade = setTimeout(() => setPhase("done"), 2100);
    const gone = setTimeout(() => setPhase("hidden"), 2600);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col justify-center px-9"
      style={{
        background: "linear-gradient(168deg, #0c0a1c, #0a0818)",
        color: "#cfc8ff",
        fontFamily: "var(--font-mono)",
        pointerEvents: phase === "done" ? "none" : "auto",
        animation: phase === "done" ? "boot-out 0.5s ease forwards" : undefined,
      }}
    >
      <div
        className="mb-1 flex items-center gap-2.5 text-3xl font-bold text-white [font-family:var(--font-display)]"
        style={{ animation: "boot-fade-up 0.5s 0.1s both" }}
      >
        <span
          className="grid size-8 place-items-center"
          style={{
            background: "linear-gradient(150deg,#9b7bff,#4a2fd4)",
            clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
            boxShadow: "0 0 26px rgba(124,92,255,.7)",
          }}
        >
          ✦
        </span>
        FORGE
      </div>
      <div
        className="mb-6 text-xs tracking-[0.06em] text-[#6f68a8]"
        style={{ animation: "boot-fade-up 0.5s 0.25s both" }}
      >
        PERSONAL OPERATING SYSTEM
      </div>
      <div className="flex flex-col gap-2.5 text-[11px] tracking-[0.06em]">
        {LINES.map((line, i) => (
          <div
            key={line}
            className="flex justify-between"
            style={{ opacity: 0, animation: `boot-line-in 0.3s ${0.4 + i * 0.22}s forwards` }}
          >
            <span>{line}</span>
            <span className="text-[#00d4ff]">OK</span>
          </div>
        ))}
      </div>
      <div
        className="mt-6 h-[3px] overflow-hidden"
        style={{ background: "rgba(124,92,255,.2)", animation: "boot-fade-up 0.4s 0.4s both" }}
      >
        <i
          className="block h-full w-0"
          style={{
            background: "linear-gradient(90deg,#7c5cff,#00d4ff)",
            boxShadow: "0 0 12px #7c5cff",
            animation: "boot-load 1.35s 0.45s cubic-bezier(.4,0,.1,1) forwards",
          }}
        />
      </div>
    </div>
  );
}
