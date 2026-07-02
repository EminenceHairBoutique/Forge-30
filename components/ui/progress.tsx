import * as React from "react";
import { cn, clamp } from "@/lib/utils";

function Progress({
  value,
  max = 100,
  barClassName,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value: number;
  max?: number;
  barClassName?: string;
}) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-elevated", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          pct >= 100 ? "bg-success" : "bg-gold",
          barClassName
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
