"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Simple segmented control. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex w-full gap-1 rounded-(--radius-control) border border-line bg-elevated p-1", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 flex-1 rounded-lg px-2 text-xs font-semibold transition-colors",
            value === o.value ? "bg-surface text-gold shadow" : "text-muted active:text-ivory"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { Segmented };
