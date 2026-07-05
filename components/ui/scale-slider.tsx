"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Full-width 1–10 scale slider (v3.3 C1) — a native range input (the iOS-
 * reliable primitive, per the design system's native-control rule) with a
 * large thumb, a big current-value readout, and ticks at 1/5/10. Drag or
 * tap-to-set; keyboard arrows work natively. `value === 0` means "not set":
 * the readout shows a dash and the first interaction commits a value.
 */
function ScaleSlider({
  value,
  onChange,
  min = 1,
  max = 10,
  className,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
  label?: string;
}) {
  const isSet = value >= min;
  const display = isSet ? value : Math.round((min + max) / 2);
  const pct = ((display - min) / (max - min)) * 100;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex-1 pb-4">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={display}
          aria-label={label}
          aria-valuetext={isSet ? `${value} of ${max}` : "Not set"}
          onChange={(e) => onChange(Number(e.target.value))}
          className="scale-slider w-full"
          style={{ "--fill": isSet ? `${pct}%` : "0%" } as React.CSSProperties}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[14px] bottom-0 flex justify-between"
        >
          <span className="microlabel text-muted">{min}</span>
          <span className="microlabel text-muted">{Math.round((min + max) / 2)}</span>
          <span className="microlabel text-muted">{max}</span>
        </div>
      </div>
      <span
        aria-hidden
        className={cn(
          "display-num w-10 shrink-0 text-right text-2xl",
          isSet ? "text-gold" : "text-muted"
        )}
      >
        {isSet ? value : "—"}
      </span>
    </div>
  );
}

export { ScaleSlider };
