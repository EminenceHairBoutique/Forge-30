import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-control) text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:pointer-events-none disabled:opacity-40 select-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gold text-base active:bg-gold/85 lg:hover:bg-gold/90",
        secondary: "bg-elevated text-ivory border border-line active:bg-elevated/70 lg:hover:border-gold/40",
        ghost: "text-muted active:text-ivory lg:hover:text-ivory",
        outline: "border border-line bg-transparent text-ivory active:bg-elevated lg:hover:bg-elevated",
        destructive: "bg-danger/15 text-danger border border-danger/30 active:bg-danger/25",
        success: "bg-success/15 text-success border border-success/30 active:bg-success/25",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
