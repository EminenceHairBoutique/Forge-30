"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        // 44pt touch target via padding around the visual track.
        "relative inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-40",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex h-7 w-12 items-center rounded-full border border-line px-0.5 transition-colors",
          checked ? "bg-gold" : "bg-elevated"
        )}
      >
        <span
          className={cn(
            "size-6 rounded-full bg-ivory shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </span>
    </button>
  );
}

export { Switch };
