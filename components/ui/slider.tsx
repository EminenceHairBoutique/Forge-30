"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** 1–10 style scale picker rendered as big tap targets (no tiny drag thumb). */
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
  const steps: number[] = [];
  for (let i = min; i <= max; i++) steps.push(i);
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1", className)}>
      {steps.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center rounded-lg border text-sm font-semibold tabular transition-colors",
            value === n
              ? "border-gold bg-gold/20 text-gold"
              : value >= n && value > 0
                ? "border-gold/40 bg-gold/10 text-gold/70"
                : "border-line bg-elevated text-muted"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export { ScaleSlider };
