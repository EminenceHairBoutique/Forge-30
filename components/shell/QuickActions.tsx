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

/**
 * Sticky quick-action row: every logging flow is one tap from Today. Sits on
 * a full-bleed base-color gradient so content scrolling beneath it fades out
 * instead of colliding with the pills (live-build finding #1).
 */
export function QuickActions() {
  return (
    <div className="no-scrollbar sticky bottom-20 z-30 -mx-4 overflow-x-auto bg-gradient-to-t from-base via-base/95 to-transparent px-4 pt-5 pb-2">
      <div className="flex w-max gap-2">
        {ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="press-scale flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-ivory [background:var(--grad-glass),var(--bg-elevated-solid)] [box-shadow:inset_0_1px_0_rgba(255,244,228,0.14)] active:border-gold/50 lg:hover:border-gold/60"
          >
            <Icon className="size-4 text-gold" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
