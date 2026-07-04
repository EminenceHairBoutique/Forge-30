import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-elevated text-muted border border-line",
        gold: "bg-gold/15 text-gold border border-gold/30",
        success: "bg-success/10 text-success border border-success/25",
        /* Caution tier (§2): danger family at reduced weight — pair with
           an icon + explicit text label at the call site. */
        caution: "bg-danger/10 text-danger border border-danger/30",
        danger: "bg-danger/10 text-danger border border-danger/25",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
