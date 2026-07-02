"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet built on Radix Dialog: slides up from the bottom on mobile,
 * centers as a modal card at the lg: breakpoint. All Forge30 modals use this
 * so safe-area padding is handled in one place.
 */

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  title,
  hideClose = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-(--radius-card) border border-line bg-surface pb-safe outline-none",
          "lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-(--radius-card)",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <DialogPrimitive.Title className="text-base font-bold text-ivory">
            {title}
          </DialogPrimitive.Title>
          {!hideClose && (
            <DialogPrimitive.Close
              className="flex size-11 items-center justify-center rounded-full text-muted active:text-ivory lg:hover:text-ivory"
              aria-label="Close"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          )}
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
