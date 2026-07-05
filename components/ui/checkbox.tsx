"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Checklist row with a full-width 44pt tap target.
 *
 * `variant="todo"` (default) strikes through checked labels — right for task
 * lists where checked = done. `variant="toggle"` keeps the label upright —
 * for preferences/settings, where checked = enabled and a strikethrough would
 * read backwards.
 */
function CheckItem({
  checked,
  onCheckedChange,
  label,
  sublabel,
  className,
  variant = "todo",
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  sublabel?: string;
  className?: string;
  variant?: "todo" | "toggle";
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-(--radius-control) px-2 py-2 text-left transition-colors active:bg-elevated lg:hover:bg-elevated",
        className
      )}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
          checked ? "border-success bg-success/20 text-success" : "border-line bg-elevated text-transparent"
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-medium",
            checked && variant === "todo" ? "text-muted line-through" : "text-ivory"
          )}
        >
          {label}
        </span>
        {sublabel && <span className="block text-xs text-muted">{sublabel}</span>}
      </span>
    </button>
  );
}

export { CheckItem };
