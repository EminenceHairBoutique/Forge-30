"use client";

import { useEffect, useState } from "react";
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
  Pill,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useStorage } from "@/lib/storage/provider";
import { cn } from "@/lib/utils";

/**
 * Navigation shell (spec §Navigation): five fixed items — Today · Log ·
 * Coach · Progress · More. Log opens a grid sheet to every logging domain;
 * More holds Settings and other sections. Starship S2 restyles this into a
 * floating hexagonal HUD dock with Coach as the protruding diamond core —
 * the routing model, LOG_PATHS, and aria-current logic are unchanged.
 *
 * Adding a destination here requires updating SHELL_ROUTES in
 * public/sw.template.js in the same commit.
 */

const LOG_DESTINATIONS: { href: string; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { href: "/nutrition", label: "Food", icon: UtensilsCrossed },
  { href: "/training", label: "Train", icon: Dumbbell },
  { href: "/hybrid", label: "Hybrid", icon: Swords },
  { href: "/mind", label: "Mind", icon: Brain },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/skills", label: "Skills", icon: GraduationCap },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/relationships", label: "Relationships", icon: HeartHandshake },
];

const MORE_DESTINATIONS: { href: string; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/social", label: "Social", icon: Users },
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
];

const LOG_PATHS = LOG_DESTINATIONS.filter((d) => !d.soon).map((d) => d.href);

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { adapter, revision } = useStorage();
  const [logOpen, setLogOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [protocolsEnabled, setProtocolsEnabled] = useState(false);

  // Protocols is invisible unless enabled (§6.0.6) — including here.
  useEffect(() => {
    void adapter.getProtocolSettings().then((s) => setProtocolsEnabled(s.enabled));
  }, [adapter, revision]);

  const moreItems = protocolsEnabled
    ? [...MORE_DESTINATIONS, { href: "/protocols", label: "Protocols", icon: Pill }]
    : MORE_DESTINATIONS;

  const navigate = (href: string, close: (o: boolean) => void) => {
    close(false);
    router.push(href);
  };

  const logActive = LOG_PATHS.some((p) => pathname.startsWith(p));

  /** One dock cell: icon over label, violet + top tick when active. */
  const DockItem = ({
    icon: Icon,
    label,
    active,
  }: {
    icon: LucideIcon;
    label: string;
    active: boolean;
  }) => (
    <span
      className={cn(
        "relative flex flex-col items-center gap-1 transition-colors",
        active ? "text-gold" : "text-muted"
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -top-2 h-0.5 w-5 bg-gold shadow-[0_0_10px_var(--accent-gold)]"
        />
      )}
      <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
      <span className="microlabel text-[9px]">{label}</span>
    </span>
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
            "hull-cut-sm corner-tick flex min-h-20 flex-col items-center justify-center gap-1.5 border border-line bg-elevated transition-colors",
            soon ? "opacity-45" : "active:border-(--stroke-active) lg:hover:border-(--stroke-active)"
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
      {/* Floating HUD dock. The wrapper is pointer-events-none so the page
          scrolls around it; the dock + core opt back in. */}
      <nav
        aria-label="Primary"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)]"
      >
        <div className="relative mx-auto max-w-lg">
          {/* The hexagon-clipped glass bar. The Coach core is a SIBLING (below)
              so the clip-path never crops its protrusion. */}
          <div
            className="glass pointer-events-auto flex h-16 items-center justify-between border border-(--stroke-active) px-4"
            style={{
              clipPath:
                "polygon(16px 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0 50%)",
              boxShadow: "0 -6px 30px rgba(74,47,212,0.22), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <Link
              href="/today"
              aria-current={pathname.startsWith("/today") ? "page" : undefined}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <DockItem icon={Flame} label="Today" active={pathname.startsWith("/today")} />
            </Link>

            <button
              type="button"
              onClick={() => setLogOpen(true)}
              aria-haspopup="dialog"
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <DockItem icon={SquarePen} label="Log" active={logActive} />
            </button>

            {/* Centre gap reserved for the protruding Coach core. */}
            <span className="w-12 shrink-0" aria-hidden />

            <Link
              href="/progress"
              aria-current={pathname.startsWith("/progress") ? "page" : undefined}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <DockItem icon={CalendarRange} label="Progress" active={pathname.startsWith("/progress")} />
            </Link>

            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <DockItem icon={Menu} label="More" active={pathname.startsWith("/settings")} />
            </button>
          </div>

          {/* Coach = the protruding diamond core. */}
          <Link
            href="/coach"
            aria-label="AI Coach"
            aria-current={pathname.startsWith("/coach") ? "page" : undefined}
            className="starship-core pointer-events-auto absolute -top-5 left-1/2 grid size-14 -translate-x-1/2 place-items-center text-white"
          >
            <Sparkles className="size-6" strokeWidth={2} />
          </Link>
        </div>
      </nav>

      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetContent title="Log">
          <DestinationGrid items={LOG_DESTINATIONS} close={setLogOpen} />
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent title="More">
          <DestinationGrid items={moreItems} close={setMoreOpen} />
        </SheetContent>
      </Sheet>
    </>
  );
}
