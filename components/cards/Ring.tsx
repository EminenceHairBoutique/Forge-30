"use client";

import { useId } from "react";
import { clamp } from "@/lib/utils";

/**
 * SVG progress ring. Track is the recessive --ring-track tone; the data arc
 * is thin (per mark specs) with a rounded cap, gold while in progress and
 * teal only at 100%.
 *
 * Gauge options: `ticks` draws instrument tick marks around a thin outer
 * track (majors every `majorEvery`); `glow` applies the rationed ember
 * drop-shadow (hero score ring, milestones, completed states only);
 * `pulse` renders the arc with the in-progress sweep-pulse animation;
 * `gradient` swaps the arc stroke for molten SVG gradient stops; `sweep`
 * slows the dashoffset transition to the 1.1s hero reveal. All motion is
 * reduced-motion-safe via the global .gauge-arc block.
 */
export function Ring({
  value,
  max,
  size = 64,
  stroke = 6,
  color,
  children,
  label,
  ticks = 0,
  majorEvery = 3,
  glow = false,
  pulse = false,
  gradient,
  sweep = false,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  /** Override arc color (defaults to gold, success at 100%). */
  color?: string;
  children?: React.ReactNode;
  label?: string;
  /** Number of instrument ticks around the gauge (0 = none). */
  ticks?: number;
  /** Every Nth tick renders as a major (longer, brighter). */
  majorEvery?: number;
  glow?: boolean;
  pulse?: boolean;
  /** Molten gradient stops for the arc stroke (top → bottom). */
  gradient?: [string, string, string];
  /** Hero reveal: 1.1s eased sweep instead of the default 700ms. */
  sweep?: boolean;
}) {
  const gradId = useId();
  const pct = max > 0 ? clamp(value / max, 0, 1) : 0;
  // With ticks on, the arc insets to leave an 8px outer band for the gauge.
  const r = (size - stroke) / 2 - (ticks > 0 ? 8 : 0);
  const c = 2 * Math.PI * r;
  const arc = gradient
    ? `url(#${gradId})`
    : (color ?? (pct >= 1 ? "var(--accent-success)" : "var(--accent-gold)"));

  // Tick geometry: drawn just outside the arc on a thin outer track.
  const tickOuter = size / 2 - 1;
  const tickMarks = Array.from({ length: ticks }, (_, i) => {
    const angle = (i / ticks) * 2 * Math.PI - Math.PI / 2;
    const major = i % majorEvery === 0;
    const len = major ? 5 : 3;
    return {
      key: i,
      major,
      x1: size / 2 + (tickOuter - len) * Math.cos(angle),
      y1: size / 2 + (tickOuter - len) * Math.sin(angle),
      x2: size / 2 + tickOuter * Math.cos(angle),
      y2: size / 2 + tickOuter * Math.sin(angle),
    };
  });

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(pct * 100)}%`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        style={glow ? { filter: "drop-shadow(0 0 12px rgba(255,138,61,0.35))" } : undefined}
      >
        {gradient && (
          <defs>
            {/* The svg is rotated -90°, so x-axis here reads top→bottom on screen. */}
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="50%" stopColor={gradient[1]} />
              <stop offset="100%" stopColor={gradient[2]} />
            </linearGradient>
          </defs>
        )}
        {ticks > 0 && (
          <>
            {/* Thin outer track ring behind the ticks. */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={tickOuter}
              fill="none"
              stroke="var(--stroke-hairline)"
              strokeWidth={1}
            />
            {tickMarks.map((t) => (
              <line
                key={t.key}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.major ? "rgba(255,244,228,0.35)" : "rgba(255,244,228,0.15)"}
                strokeWidth={1}
              />
            ))}
          </>
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arc}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={
            (sweep ? "gauge-arc gauge-arc-sweep" : "gauge-arc") +
            (pulse ? " animate-sweep-pulse" : "")
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
