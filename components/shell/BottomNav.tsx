"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  UtensilsCrossed,
  Dumbbell,
  Brain,
  Wallet,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/today", label: "Today", icon: Flame },
  { href: "/nutrition", label: "Food", icon: UtensilsCrossed },
  { href: "/training", label: "Train", icon: Dumbbell },
  { href: "/mind", label: "Mind", icon: Brain },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/progress", label: "Progress", icon: CalendarRange },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-base/90 backdrop-blur-lg pb-safe"
    >
      <div className="mx-auto flex h-18 max-w-lg items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                // ≥44×44pt targets: each tab is 1/6 of ≥375pt width, full height.
                "flex min-w-11 flex-1 flex-col items-center justify-center gap-1 transition-colors",
                active ? "text-gold" : "text-muted active:text-ivory"
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
