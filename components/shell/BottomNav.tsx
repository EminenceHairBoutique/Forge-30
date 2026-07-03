"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Flame,
  SquarePen,
  Sparkles,
  CalendarRange,
  Menu,
  UtensilsCrossed,
  Dumbbell,
  Brain,
  Wallet,
  GraduationCap,
  HeartPulse,
  HeartHandshake,
  Settings,
  Users,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * v2 navigation shell (spec §Navigation): five fixed items — Today · Log ·
 * Coach · Progress · More. Log opens a grid sheet to every logging domain
 * (the 6-tab bar could not absorb Health/Relationships/Skills); More holds
 * Settings and upcoming sections. Today's quick actions keep every common
 * path at ≤2 taps.
 *
 * Adding a destination here requires updating SHELL_ROUTES in public/sw.js
 * (and bumping its VERSION) in the same commit.
 */

const LOG_DESTINATIONS: { href: string; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { href: "/nutrition", label: "Food", icon: UtensilsCrossed },
  { href: "/training", label: "Train", icon: Dumbbell },
  { href: "/mind", label: "Mind", icon: Brain },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/skills", label: "Skills", icon: GraduationCap },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/relationships", label: "Relationships", icon: HeartHandshake, soon: true },
];

const MORE_DESTINATIONS: { href: string; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/social", label: "Social", icon: Users, soon: true },
  { href: "/assessments", label: "Assessments", icon: ClipboardList, soon: true },
];

const LOG_PATHS = LOG_DESTINATIONS.filter((d) => !d.soon).map((d) => d.href);

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [logOpen, setLogOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const navigate = (href: string, close: (o: boolean) => void) => {
    close(false);
    router.push(href);
  };

  const tabClass = (active: boolean) =>
    cn(
      "flex min-w-11 flex-1 flex-col items-center justify-center gap-1 transition-colors",
      active ? "text-gold" : "text-muted active:text-ivory"
    );

  const DestinationGrid = ({
    items,
    close,
  }: {
    items: typeof LOG_DESTINATIONS;
    close: (o: boolean) => void;
  }) => (
    <div className="grid grid-cols-3 gap-2 pb-2">
      {items.map(({ href, label, icon: Icon, soon }) => (
        <button
          key={href}
          type="button"
          disabled={soon}
          onClick={() => navigate(href, close)}
          className={cn(
            "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-(--radius-card) border border-line bg-elevated transition-colors",
            soon ? "opacity-45" : "active:border-gold/50 lg:hover:border-gold/50"
          )}
        >
          <Icon className="size-6 text-gold" />
          <span className="text-xs font-semibold text-ivory">{label}</span>
          {soon && <span className="text-[10px] text-muted">coming soon</span>}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-base/90 backdrop-blur-lg pb-safe"
      >
        <div className="mx-auto flex h-18 max-w-lg items-stretch">
          <Link
            href="/today"
            aria-current={pathname.startsWith("/today") ? "page" : undefined}
            className={tabClass(pathname.startsWith("/today"))}
          >
            <Flame className="size-5" strokeWidth={pathname.startsWith("/today") ? 2.4 : 1.8} />
            <span className="text-[10px] font-semibold tracking-wide">Today</span>
          </Link>

          <button
            type="button"
            onClick={() => setLogOpen(true)}
            aria-haspopup="dialog"
            className={tabClass(LOG_PATHS.some((p) => pathname.startsWith(p)))}
          >
            <SquarePen
              className="size-5"
              strokeWidth={LOG_PATHS.some((p) => pathname.startsWith(p)) ? 2.4 : 1.8}
            />
            <span className="text-[10px] font-semibold tracking-wide">Log</span>
          </button>

          <Link
            href="/coach"
            aria-current={pathname.startsWith("/coach") ? "page" : undefined}
            className={tabClass(pathname.startsWith("/coach"))}
          >
            <Sparkles className="size-5" strokeWidth={pathname.startsWith("/coach") ? 2.4 : 1.8} />
            <span className="text-[10px] font-semibold tracking-wide">Coach</span>
          </Link>

          <Link
            href="/progress"
            aria-current={pathname.startsWith("/progress") ? "page" : undefined}
            className={tabClass(pathname.startsWith("/progress"))}
          >
            <CalendarRange
              className="size-5"
              strokeWidth={pathname.startsWith("/progress") ? 2.4 : 1.8}
            />
            <span className="text-[10px] font-semibold tracking-wide">Progress</span>
          </Link>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={tabClass(pathname.startsWith("/settings"))}
          >
            <Menu
              className="size-5"
              strokeWidth={pathname.startsWith("/settings") ? 2.4 : 1.8}
            />
            <span className="text-[10px] font-semibold tracking-wide">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetContent title="Log">
          <DestinationGrid items={LOG_DESTINATIONS} close={setLogOpen} />
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent title="More">
          <DestinationGrid items={MORE_DESTINATIONS} close={setMoreOpen} />
        </SheetContent>
      </Sheet>
    </>
  );
}
