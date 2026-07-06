import { cn } from "@/lib/utils";

/**
 * HUD timeline/log row (A2): left-rail tick + mono timestamp for history
 * views (spending entries, journal lists, incident logs, workout history).
 * Purely presentational — wrap existing row content in it.
 */
export function TimelineRow({
  time,
  children,
  className,
}: {
  /** Mono timestamp label, e.g. "14:32" or "JUL 04". */
  time: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative flex gap-3 pl-4", className)}>
      {/* Left rail + tick */}
      <span aria-hidden className="absolute top-0 bottom-0 left-1 w-px bg-(--stroke-hairline)" />
      <span aria-hidden className="absolute top-4 left-0 h-px w-2.5 bg-(--stroke-active)" />
      <span className="microlabel w-12 shrink-0 pt-3.5 text-muted">{time}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
