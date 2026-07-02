import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        // text-base = 16px: prevents iOS Safari zoom-on-focus.
        "flex min-h-11 w-full rounded-(--radius-control) border border-line bg-elevated px-3 py-2 text-base text-ivory placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-40",
        className
      )}
      {...props}
    />
  );
}

export { Input };
