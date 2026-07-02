import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Styled native select — the most reliable picker on iOS. */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="min-h-11 w-full appearance-none rounded-(--radius-control) border border-line bg-elevated px-3 py-2 pr-9 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export { Select };
