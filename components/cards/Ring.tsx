import { clamp } from "@/lib/utils";

/**
 * SVG progress ring. Track is a recessive elevated tone; the data arc is thin
 * (per mark specs) with a rounded cap, gold while in progress and success
 * green only at 100%.
 */
export function Ring({
  value,
  max,
  size = 64,
  stroke = 6,
  color,
  children,
  label,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  /** Override arc color (defaults to gold, success at 100%). */
  color?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const pct = max > 0 ? clamp(value / max, 0, 1) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = color ?? (pct >= 1 ? "var(--accent-success)" : "var(--accent-gold)");
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(pct * 100)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-elevated)"
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
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
