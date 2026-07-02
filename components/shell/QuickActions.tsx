"use client";

import Link from "next/link";
import { UtensilsCrossed, Dumbbell, Wallet, NotebookPen, Sparkles } from "lucide-react";

const ACTIONS = [
  { href: "/nutrition?add=1", label: "Add Meal", icon: UtensilsCrossed },
  { href: "/training", label: "Start Workout", icon: Dumbbell },
  { href: "/money?add=1", label: "Log Spending", icon: Wallet },
  { href: "/mind", label: "Journal", icon: NotebookPen },
  { href: "/coach", label: "AI Feedback", icon: Sparkles },
] as const;

/** Sticky quick-action row: every logging flow is one tap from Today. */
export function QuickActions() {
  return (
    <div className="no-scrollbar sticky bottom-20 z-30 -mx-4 overflow-x-auto px-4 py-2">
      <div className="flex w-max gap-2">
        {ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-11 items-center gap-2 rounded-full border border-gold/30 bg-elevated/95 px-4 text-sm font-semibold text-ivory shadow-lg backdrop-blur active:bg-gold/20 lg:hover:border-gold/60"
          >
            <Icon className="size-4 text-gold" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
