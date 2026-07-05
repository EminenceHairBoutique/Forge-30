import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-(--radius-control) border border-line bg-elevated px-3 py-2 text-base text-ivory placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-40",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
